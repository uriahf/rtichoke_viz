// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import withBaseline from "../fixtures/v2/observed-steps.json" with { type: "json" };
import withoutBaseline from "../fixtures/v2/observed-steps-no-baseline.json" with { type: "json" };
import { OutcomeDistributionSpecSchema, type OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";
import { assertOutcomeDistributionReferentialIntegrity } from "../src/spec/v2/validate-outcome-distribution.js";
import { renderOutcomeDistribution } from "../src/render/outcome-distribution.js";

const clone = () => structuredClone(withBaseline) as OutcomeDistributionSpec;
describe("observed longitudinal steps", () => {
  it("accepts the step schema and preserves the 2.0 version", () => {
    expect(Value.Check(OutcomeDistributionSpecSchema, clone())).toBe(true);
    expect(() => assertOutcomeDistributionReferentialIntegrity(clone())).not.toThrow();
  });
  it("rejects duplicate states, orders, unknown states, coordinates, counts, and denominators", () => {
    const mutations: Array<(spec: OutcomeDistributionSpec) => void> = [
      s => { s.stateOrder!.push("low"); },
      s => { s.stateDistributions[0].states.push({...s.stateDistributions[0].states[0]}); },
      s => { s.stateDistributions[0].states[0].stateId = "unknown"; },
      s => { s.stateDistributions[0].horizon = 0.5; },
      s => { s.stateDistributions[0].horizon = -1; },
      s => { s.stateDistributions[0].states[0].count = -1; },
      s => { s.stateDistributions[0].states.forEach(x => x.count = 0); },
      s => { s.stateDistributions.push(structuredClone(s.stateDistributions[0])); },
      s => { s.stateDistributions[0].estimator = "aalen_johansen"; },
      s => { s.stateDistributions[0].estimateOrigin = "fixed_time_horizon"; },
      s => { s.stateDistributions[0].states[0].estimate = 0.99; },
    ];
    for (const mutate of mutations) {
      const s = clone(); mutate(s);
      expect(() => assertOutcomeDistributionReferentialIntegrity(s)).toThrow();
    }
  });
  it("renders stable state order, absent state, accurate denominator, and does not invent step 1", () => {
    const root = renderOutcomeDistribution(clone());
    expect(root.querySelector("h3")?.textContent).toBe("Observed State Distribution");
    expect(root.textContent).toContain("Step");
    expect(root.textContent).toContain("10 / 70 (14.3%)");
    const legend = [...root.querySelectorAll(".rtichoke-legend-label")].map(x => x.textContent);
    expect(legend).toEqual(["Low", "Moderate", "High", "Severe"]);
    const svg = root.querySelector("svg")!.innerHTML;
    expect(svg).toContain("N observed");
    expect(svg).toContain("Proportion:");
    expect(svg).toContain("Step: 5");
    expect(svg).not.toContain("Step: 1");
    const slider = root.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;
    slider.value = "1"; slider.dispatchEvent(new Event("input"));
    expect(root.textContent).toContain("0 / 80 (0.0%)");
  });
  it("does not synthesize baseline and isolates instances", () => {
    const s = structuredClone(withoutBaseline) as OutcomeDistributionSpec;
    const first = renderOutcomeDistribution(s);
    const second = renderOutcomeDistribution(s);
    expect(first.querySelector("svg")!.innerHTML).not.toContain("Step: 0");
    expect(first.querySelector("input")!.id).not.toEqual(second.querySelector("input")!.id);
  });
});