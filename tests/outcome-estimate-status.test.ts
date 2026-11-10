// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import fixture from "../fixtures/v2/outcome-distribution-estimate-status.json" with { type: "json" };
import { OutcomeDistributionSpecSchema, type OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";
import { assertOutcomeDistributionReferentialIntegrity, assertStateDistributionValid } from "../src/spec/v2/validate-outcome-distribution.js";
import { renderOutcomeDistribution } from "../src/render/outcome-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { HeuristicPairKey } from "../src/spec/v2/heuristics.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";

function spec(): OutcomeDistributionSpec {
  return structuredClone(fixture) as OutcomeDistributionSpec;
}
function selected(key = "excluded:excluded"): OutcomeDistributionSpec {
  const value = spec();
  const variant = value.variants![key as HeuristicPairKey]!;
  if (variant.status !== "available") throw Error("fixture must be available");
  return { ...value, stateDistributions: variant.stateDistributions, exclusions: variant.exclusions };
}
function report(): ReportSpecV1_1 {
  return {
    schemaVersion: "1.1", type: "report",
    heuristics: { active: "excluded:excluded", available: Object.keys(fixture.variants) as HeuristicPairKey[] },
    sections: [{ id: "outcome", title: "Outcome", items: [{ type: "component", id: "od", spec: selected() }] }],
  };
}
function readout(root: HTMLElement): HTMLElement {
  return root.querySelector(".rtichoke-outcome-distribution__readout")!;
}
function horizon(root: HTMLElement, index: number) {
  const slider = root.querySelector<HTMLInputElement>('input[type="range"]')!;
  slider.value = String(index);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
}
function choose(root: HTMLElement, selector: string) {
  const radio = root.querySelector<HTMLInputElement>(selector)!;
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("horizon-specific outcome estimate status", () => {
  it("keeps the additive contract on v2.0 and validates all variants", () => {
    expect(Value.Check(OutcomeDistributionSpecSchema, fixture)).toBe(true);
    expect(() => assertOutcomeDistributionReferentialIntegrity(spec())).not.toThrow();
    expect(fixture.schemaVersion).toBe("2.0");
  });

  it("rejects invalid status, contradictory numbers, and incomplete estimates", () => {
    const original = selected().stateDistributions.find((r) => r.estimateStatus === "undefined_empty_population")!;
    for (const bad of [
      { ...original, estimateStatus: "unknown" },
      { ...original, states: [{ stateId: "primary", estimate: 0 }] },
      { ...original, states: [{ stateId: "primary", estimate: null, count: 0 }] },
      { ...original, states: [{ stateId: "primary", estimate: null, mass: 0 }] },
      { ...original, states: [{ stateId: "primary", estimate: null, lower: 0 }] },
      { ...original, estimateStatus: "defined" },
      { ...original, estimateStatus: "beyond_support_plateau" },
      { ...original, states: [{ stateId: "primary" }] },
    ]) expect(() => assertStateDistributionValid(bad as any)).toThrow();
    const badSum = { ...original, estimateStatus: "defined", states: [{ stateId: "primary", estimate: 0.4 }] };
    expect(() => assertStateDistributionValid(badSum as any)).toThrow(/sum to 1/);
  });

  it("requires empty-population exclusions at the exact evaluation and horizon", () => {
    const missing = selected();
    delete missing.exclusions;
    expect(() => assertOutcomeDistributionReferentialIntegrity(missing)).toThrow(/matching exclusions/);
    const partial = selected();
    partial.exclusions![0].excludedCounts.find((c) => c.horizon === 3)!.censoredExcludedCount = 1;
    expect(() => assertOutcomeDistributionReferentialIntegrity(partial)).toThrow(/entire original population/);
    const badVariant = selected();
    const variant = badVariant.variants!["excluded:excluded"]!;
    if (variant.status !== "available") throw Error("available");
    variant.exclusions = [];
    expect(() => assertOutcomeDistributionReferentialIntegrity(badVariant)).toThrow(/matching exclusions/);
  });

  it("shows unavailable probabilities without zero bars and preserves original-N exclusions", () => {
    const root = renderOutcomeDistribution(selected());
    expect(readout(root).textContent).toContain("no subjects remain");
    const rows = readout(root).querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Unavailable");
    expect(rows[0].querySelector(".rtichoke-performance-table__bar")).toBeNull();
    expect(rows[1].textContent).toContain("Unavailable");
    expect(readout(root).textContent).toContain("2 / 2 (100.0%)");
    expect(root.querySelector<HTMLElement>(".rtichoke-outcome-distribution__panel--b")!.style.display).not.toBe("none");
    // No outcome rectangle is drawn for the unavailable horizon.
    const chart = root.querySelector(".rtichoke-outcome-distribution__panel--a svg")!;
    expect(chart.textContent).toContain("Time: 3");
    expect(chart.textContent).toContain("Unavailable");
    expect(chart.querySelectorAll('g[aria-label="bar"] rect')).toHaveLength(4);
    horizon(root, 1);
    expect(readout(root).textContent).not.toContain("Unavailable");
    expect(readout(root).textContent).toContain("1 / 2 (50.0%)");
  });

  it("keeps supplied plateau values and clearly labels their support", () => {
    const root = renderOutcomeDistribution(selected("adjusted:adjusted_as_negative"));
    expect(readout(root).textContent).toContain("estimator plateaus");
    expect(readout(root).textContent).toContain("100.0%");
    const titles = [...root.querySelectorAll("svg title")].map((t) => t.textContent).join(" ");
    expect(titles).toContain("Aalen–Johansen estimate");
    expect(titles).toContain("Beyond observed follow-up");
    expect(titles).not.toContain("Raw observed status");
    horizon(root, 0);
    expect(readout(root).textContent).not.toContain("estimator plateaus");
  });

  it("labels KM estimates and keeps legacy raw tooltips unchanged", () => {
    const km = renderOutcomeDistribution(selected("excluded:adjusted_as_censored"));
    expect(km.textContent).toContain("Estimated probability (%)");
    expect([...km.querySelectorAll("svg title")].map((t) => t.textContent).join(" ")).toContain("Kaplan–Meier estimate");
    const raw: OutcomeDistributionSpec = {
      schemaVersion: "2.0", type: "outcome_distribution", evaluations: [{ id: "e", population: "Legacy" }],
      stateDistributions: [{ evaluationId: "e", horizon: 0, estimator: "raw", estimateOrigin: "fixed_time_horizon", states: [{ stateId: "real_positive", count: 1 }, { stateId: "real_negative", count: 3 }] }],
    };
    const root = renderOutcomeDistribution(raw);
    expect(readout(root).textContent).toContain("1 / 4 (25.0%)");
    expect([...root.querySelectorAll("svg title")].map((t) => t.textContent).join(" ")).toContain("Raw observed status");
  });

  it("does not turn legacy all-null states into 0%", () => {
    const value = selected();
    delete value.variants;
    delete value.exclusions;
    value.stateDistributions = value.stateDistributions.filter((d) => d.evaluationId === "censored" && d.horizon === 3);
    delete value.stateDistributions[0].estimateStatus;
    const root = renderOutcomeDistribution(value);
    expect(readout(root).textContent).toContain("no outcome probability estimates were supplied");
    expect(readout(root).textContent).not.toContain("0.0%");
  });

  it("uses actual exclusion counts at supplied zero, including empty populations", () => {
    const value = selected();
    delete value.variants;
    value.stateDistributions = value.stateDistributions.filter((r) => r.evaluationId === "censored" && r.horizon === 3);
    value.stateDistributions[0].horizon = 0;
    value.exclusions = [{ evaluationId: "censored", originalSampleSize: 2, excludedCounts: [{ horizon: 0, censoredExcludedCount: 0, competingExcludedCount: 2 }] }];
    const root = renderOutcomeDistribution(value);
    expect(readout(root).textContent).toContain("no subjects remain");
    expect(readout(root).textContent).toContain("2 / 2 (100.0%)");
  });

  it("preserves horizon through all eight report pairs and isolates report instances", () => {
    const first = renderReport(report());
    const second = renderReport(report());
    for (const c of ["adjusted", "excluded"]) {
      choose(first, `input[name$='-censoring'][value='${c}']`);
      for (const k of ["excluded", "adjusted_as_censored", "adjusted_as_negative", "adjusted_as_composite"]) {
        choose(first, `input[name$='-competing'][value='${k}']`);
        expect(readout(first).textContent).toContain("Time = 3.000");
        expect(readout(first).textContent).toContain(c === "excluded" ? "no subjects remain" : "estimator plateaus");
      }
    }
    choose(first, 'input[value="complete"]');
    expect(readout(first).textContent).not.toContain("Unavailable");
    expect(readout(first).textContent).toContain("100.0%");
    expect(readout(second).textContent).toContain("no subjects remain");
  });

  it("leaves gaps in trajectories instead of connecting through missing estimates", () => {
    const value = selected();
    delete value.variants;
    value.evaluations = [value.evaluations[0]];
    value.exclusions = value.exclusions!.filter((e) => e.evaluationId === "censored");
    const rows = value.stateDistributions.filter((r) => r.evaluationId === "censored");
    // A deliberately nonmonotone availability fixture exercises generic trajectory gaps.
    const defined = structuredClone(rows[0]);
    defined.horizon = 4;
    value.stateDistributions = [rows[0], rows[1], rows[2], defined].map((r) => ({ ...r, estimateOrigin: "event_table" }));
    value.exclusions![0].excludedCounts.push({ horizon: 4, censoredExcludedCount: 0, competingExcludedCount: 0 });
    const root = renderOutcomeDistribution(value);
    const paths = root.querySelectorAll('.rtichoke-outcome-distribution__panel--a g[aria-label="area"] path');
    expect(paths.length).toBe(4); // Two states × two disjoint segments.
    horizon(root, 2);
    expect(readout(root).textContent).toContain("Unavailable");
  });
});
