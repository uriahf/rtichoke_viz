// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderOutcomeDistribution } from "../src/render/outcome-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";

describe("PR 3 — Coordinated Outcome Distribution & Excluded Observations Tests", () => {
  const fixturePath = join(
    process.cwd(),
    "fixtures/v2/fixture-a-heuristics-report.json",
  );
  const fixtureJson = readFileSync(fixturePath, "utf-8");
  const fixtureReport = JSON.parse(fixtureJson) as ReportSpecV1_1;

  it("1. Legacy standalone Outcome Distribution unchanged", () => {
    const legacySpec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "e1", population: "Pop 1" }],
      stateDistributions: [
        {
          evaluationId: "e1",
          horizon: 5,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [{ stateId: "s1", label: "State 1", count: 10, estimate: 1.0 }],
        },
      ],
    };

    const el = renderOutcomeDistribution(legacySpec);
    document.body.append(el);

    const panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b");
    expect(panelB).not.toBeNull();
    // Panel B should be hidden for legacy specs without exclusions
    expect((panelB as HTMLElement).style.display).toBe("none");

    const panelA = el.querySelector(".rtichoke-outcome-distribution__panel--a");
    expect(panelA).not.toBeNull();
    el.remove();
  });

  it("2. Existing reports without exclusion metadata unchanged", () => {
    const reportWithoutExclusions: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-1",
              title: "Outcome Distribution",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                evaluations: [{ id: "e1", population: "Pop 1" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    horizon: 5,
                    estimator: "raw",
                    estimateOrigin: "fixed_time_horizon",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const el = renderReport(reportWithoutExclusions);
    document.body.append(el);

    const panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b");
    expect(panelB).not.toBeNull();
    expect((panelB as HTMLElement).style.display).toBe("none");
    el.remove();
  });

  it("3, 4 & 5. Correct Panel B display for excluded:excluded (counts & N=8 denominator)", () => {
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "excluded:excluded";

    const el = renderReport(report);
    document.body.append(el);

    const panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b");
    expect(panelB).not.toBeNull();
    expect((panelB as HTMLElement).style.display).not.toBe("none");

    // Readout table for horizon 10 under excluded:excluded:
    // Censored excluded: 2 / 8 (25.0%)
    // Competing excluded: 2 / 8 (25.0%)
    // Total excluded: 4 / 8 (50.0%)
    const readoutTableText = el.querySelector(
      ".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout",
    )?.textContent;

    expect(readoutTableText).toContain("Censored excluded");
    expect(readoutTableText).toContain("2 / 8 (25.0%)");
    expect(readoutTableText).toContain("Competing excluded");
    expect(readoutTableText).toContain("2 / 8 (25.0%)");

    // Check slider to horizon 5 (index 1 in [0, 5, 10])
    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));

    // Horizon 5 under excluded:excluded:
    // Censored: 0 / 8 (0.0%)
    // Competing: 1 / 8 (12.5%)
    const readoutTableTextH5 = el.querySelector(
      ".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout",
    )?.textContent;

    expect(readoutTableTextH5).toContain("0 / 8 (0.0%)");
    expect(readoutTableTextH5).toContain("1 / 8 (12.5%)");

    el.remove();
  });

  it("6. Panel B hidden when exclusions are zero across every supplied horizon", () => {
    // adjusted:adjusted_as_negative has zero exclusions at horizon 5 and horizon 10
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "adjusted:adjusted_as_negative";

    const el = renderReport(report);
    document.body.append(el);

    const panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b");
    expect((panelB as HTMLElement).style.display).toBe("none");

    el.remove();
  });

  it("7. Panel B remains visible when current horizon exclusions are zero but another horizon has positive exclusions", () => {
    // excluded:adjusted_as_negative has exclusions at horizon 10 (censoredExcludedCount=2), but 0 at horizon 5
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "excluded:adjusted_as_negative";

    const el = renderReport(report);
    document.body.append(el);

    // Set slider to horizon 5 (index 1 in [0, 5, 10])
    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));

    const panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b");
    // Panel B MUST remain visible!
    expect((panelB as HTMLElement).style.display).not.toBe("none");

    // Readout for horizon 5 shows 0 / 8 (0.0%)
    const readoutText = el.querySelector(
      ".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout",
    )?.textContent;
    expect(readoutText).toContain("0 / 8 (0.0%)");

    el.remove();
  });

  it("8. Panel A expands to full width when Panel B is hidden", () => {
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "adjusted:adjusted_as_negative"; // Panel B hidden

    const el = renderReport(report);
    document.body.append(el);

    const panelsContainer = el.querySelector(".rtichoke-outcome-distribution__panels");
    expect(panelsContainer?.classList.contains("rtichoke-outcome-distribution__panels--two-col")).toBe(false);

    el.remove();
  });

  it("9, 10 & 11. Switching heuristic pairs, 2 vs 3 states, and shared horizon synchronization", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    // Default active: adjusted:adjusted_as_censored (2 state, zero exclusions) -> Panel B hidden
    let panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b") as HTMLElement;
    expect(panelB.style.display).toBe("none");

    // Move horizon slider to horizon 5 (index 1 in [0, 5, 10])
    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));

    // Switch to excluded:excluded by setting both radio buttons
    const censRadio = el.querySelector<HTMLInputElement>("input[name$='-censoring'][value='excluded']")!;
    censRadio.checked = true;
    censRadio.dispatchEvent(new Event("change"));

    const compRadio = el.querySelector<HTMLInputElement>("input[name$='-competing'][value='excluded']")!;
    compRadio.checked = true;
    compRadio.dispatchEvent(new Event("change"));

    panelB = el.querySelector(".rtichoke-outcome-distribution__panel--b") as HTMLElement;
    expect(panelB.style.display).not.toBe("none");

    // Check unified readout in Panel A
    const readoutAText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;

    expect(readoutAText).toContain("Time = 5.000");
    expect(readoutAText).toContain("1 / 8 (12.5%)");

    el.remove();
  });

  it("13. Multi-population exclusion selection and denominators", () => {
    const multiPopSpec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [
        { id: "eval-1", population: "Pop 1 (N=100)" },
        { id: "eval-2", population: "Pop 2 (N=500)" },
      ],
      stateDistributions: [
        {
          evaluationId: "eval-1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          censoringHeuristic: "excluded",
          competingHeuristic: "excluded",
          states: [{ stateId: "s1", count: 80, estimate: 0.8 }],
        },
        {
          evaluationId: "eval-2",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          censoringHeuristic: "excluded",
          competingHeuristic: "excluded",
          states: [{ stateId: "s1", count: 400, estimate: 0.8 }],
        },
      ],
      exclusions: [
        {
          evaluationId: "eval-1",
          originalSampleSize: 100,
          excludedCounts: [
            { horizon: 10, censoredExcludedCount: 10, competingExcludedCount: 10 },
          ],
        },
        {
          evaluationId: "eval-2",
          originalSampleSize: 500,
          excludedCounts: [
            { horizon: 10, censoredExcludedCount: 50, competingExcludedCount: 50 },
          ],
        },
      ],
    };

    const el = renderOutcomeDistribution(multiPopSpec);
    document.body.append(el);

    // Initial eval-1 selected: N=100, 10 / 100 (10.0%)
    let readoutText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;
    expect(readoutText).toContain("10 / 100 (10.0%)");

    // Switch to eval-2
    const radioEval2 = el.querySelector<HTMLInputElement>("input[name^='od-eval-'][value='eval-2']")!;
    radioEval2.checked = true;
    radioEval2.dispatchEvent(new Event("change"));

    readoutText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;
    expect(readoutText).toContain("50 / 500 (10.0%)");

    el.remove();
  });

  it("14. Explicit handling of incomplete exclusion metadata (missing exclusions array vs partial horizon coverage)", () => {
    // 14a. Spec with variant containing censoringHeuristic/competingHeuristic but missing exclusions payload
    const incompleteSpec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "e1", population: "Pop 1" }],
      stateDistributions: [
        {
          evaluationId: "e1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          censoringHeuristic: "excluded",
          competingHeuristic: "excluded",
          states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
        },
      ],
      // exclusions missing!
    };

    const el1 = renderOutcomeDistribution(incompleteSpec);
    document.body.append(el1);

    const incompleteMsg1 = el1.querySelector(".rtichoke-outcome-distribution__incomplete");
    expect(incompleteMsg1).not.toBeNull();
    expect(incompleteMsg1?.textContent).toContain("Exclusion metadata is incomplete or unavailable");
    el1.remove();

    // 14b. Spec with partial horizon coverage (horizon 5 state distribution exists, but exclusions array only contains horizon 10)
    const partialHorizonSpec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "e1", population: "Pop 1" }],
      stateDistributions: [
        {
          evaluationId: "e1",
          horizon: 5,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
        },
        {
          evaluationId: "e1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
        },
      ],
      exclusions: [
        {
          evaluationId: "e1",
          originalSampleSize: 100,
          excludedCounts: [
            // Horizon 5 record missing!
            { horizon: 10, censoredExcludedCount: 0, competingExcludedCount: 0 },
          ],
        },
      ],
    };

    const el2 = renderOutcomeDistribution(partialHorizonSpec);
    document.body.append(el2);

    // Panel B should be visible and show incomplete notice rather than 0
    const panelB = el2.querySelector(".rtichoke-outcome-distribution__panel--b");
    expect(panelB).not.toBeNull();
    expect((panelB as HTMLElement).style.display).not.toBe("none");

    const incompleteMsg2 = el2.querySelector(".rtichoke-outcome-distribution__incomplete");
    expect(incompleteMsg2).not.toBeNull();
    expect(incompleteMsg2?.textContent).toContain("Exclusion metadata is incomplete or unavailable");
    el2.remove();
  });

  it("15. Fixed-time horizon baseline Time = 0 readout and empirical zero exclusions", () => {
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "excluded:excluded";

    const el = renderReport(report);
    document.body.append(el);

    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;

    // Horizon 0 (Index 0 in [0, 5, 10])
    slider.value = "0";
    slider.dispatchEvent(new Event("input"));

    const readoutAText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;

    expect(readoutAText).toContain("Time = 0.000");
    expect(readoutAText).toContain("No outcome probability estimates are calculated at baseline");

    el.remove();
  });

  it("16. No duplicate sliders", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const sliders = el.querySelectorAll(".rtichoke-operating-point-slider");
    expect(sliders.length).toBe(1);

    el.remove();
  });

  it("Targeted regression test: exact-horizon censoring boundary oracle for Fixture A", () => {
    // Oracle verification for Fixture A:
    // Subject C (Time 5, Censored) -> NOT excluded at Horizon 5, EXCLUDED at Horizon 10 under censoring=excluded.
    // Subject E (Time 10, Competing) -> EXCLUDED at Horizon 10 under competing=excluded.
    const report = JSON.parse(JSON.stringify(fixtureReport));
    report.heuristics.active = "excluded:excluded";

    const el = renderReport(report);
    document.body.append(el);

    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;

    // Horizon 5 (Index 1 in [0, 5, 10])
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));

    let readoutText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;
    expect(readoutText).toContain("Censored excluded");
    expect(readoutText).toContain("0 / 8 (0.0%)"); // C is not excluded at Horizon 5!
    expect(readoutText).toContain("Competing excluded");
    expect(readoutText).toContain("1 / 8 (12.5%)"); // B (Time 4) is excluded

    // Horizon 10 (Index 2 in [0, 5, 10])
    slider.value = "2";
    slider.dispatchEvent(new Event("input"));

    readoutText = el.querySelector(".rtichoke-outcome-distribution__panel--a .rtichoke-outcome-distribution__readout")?.textContent;
    expect(readoutText).toContain("Censored excluded");
    expect(readoutText).toContain("2 / 8 (25.0%)"); // C (Time 5) & D (Time 7) excluded at Horizon 10
    expect(readoutText).toContain("Competing excluded");
    expect(readoutText).toContain("2 / 8 (25.0%)"); // B (Time 4) & E (Time 10) excluded at Horizon 10

    el.remove();
  });
});
