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
      (s) => { s.stateOrder!.push("low"); },
      (s) => { s.stateDistributions[0].states.push({ ...s.stateDistributions[0].states[0] }); },
      (s) => { s.stateDistributions[0].states[0].stateId = "unknown"; },
      (s) => { s.stateDistributions[0].horizon = 0.5; },
      (s) => { s.stateDistributions[0].horizon = -1; },
      (s) => { s.stateDistributions[0].states[0].count = -1; },
      (s) => { s.stateDistributions[0].states.forEach((x) => (x.count = 0)); },
      (s) => { s.stateDistributions.push(structuredClone(s.stateDistributions[0])); },
      (s) => { s.stateDistributions[0].estimator = "aalen_johansen"; },
      (s) => { s.stateDistributions[0].estimateOrigin = "fixed_time_horizon"; },
      (s) => { s.stateDistributions[0].states[0].estimate = 0.99; },
    ];
    for (const mutate of mutations) {
      const s = clone();
      mutate(s);
      expect(() => assertOutcomeDistributionReferentialIntegrity(s)).toThrow();
    }
  });

  it("normalizes state labels consistently and rejects conflicting explicit nonempty labels", () => {
    const spec = clone();
    // Conflicting explicit label for "low" state across distributions
    spec.stateDistributions[1].states[0].label = "Conflicting Label";
    expect(() => assertOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /inconsistent state label across steps: low/,
    );
  });

  it("renders stable state order, absent state with zero count, accurate denominator, and does not invent step 1", () => {
    const root = renderOutcomeDistribution(clone());
    expect(root.querySelector("h3")?.textContent).toBe("Observed State Distribution");
    expect(root.textContent).toContain("Step");
    expect(root.textContent).toContain("10 / 70 (14.3%)");

    const legend = [...root.querySelectorAll(".rtichoke-legend-label")].map((x) => x.textContent);
    expect(legend).toEqual(["Low", "Moderate", "High", "Severe"]);

    const svg = root.querySelector("svg")!.innerHTML;
    expect(svg).toContain("N observed");
    expect(svg).toContain("Proportion");
    expect(svg).toContain("Step: 5");
    expect(svg).not.toContain("Step: 1");

    const slider = root.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));
    expect(root.textContent).toContain("0 / 80 (0.0%)");
  });

  it("does not synthesize baseline and isolates instances", () => {
    const s = structuredClone(withoutBaseline) as OutcomeDistributionSpec;
    const first = renderOutcomeDistribution(s);
    const second = renderOutcomeDistribution(s);
    expect(first.querySelector("svg")!.innerHTML).not.toContain("Step: 0");
    expect(first.querySelector("input")!.id).not.toEqual(second.querySelector("input")!.id);
  });

  it("strengthens multi-evaluation tests with disjoint step sets and verifies nearest-step selection on switch", () => {
    const spec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      xAxisKind: "step",
      stateOrder: ["low", "moderate", "high"],
      evaluations: [
        { id: "eval-A", model: "Model A", population: "Cohort A" },
        { id: "eval-B", model: "Model B", population: "Cohort B" },
      ],
      stateDistributions: [
        // Eval A steps: 2, 5, 10
        {
          evaluationId: "eval-A",
          horizon: 2,
          estimator: "raw",
          estimateOrigin: "observed_step",
          states: [
            { stateId: "low", label: "Low Risk", count: 80 },
            { stateId: "moderate", label: "Moderate Risk", count: 20 },
            { stateId: "high", label: "High Risk", count: 0 },
          ],
        },
        {
          evaluationId: "eval-A",
          horizon: 5,
          estimator: "raw",
          estimateOrigin: "observed_step",
          states: [
            { stateId: "low", label: "Low Risk", count: 50 },
            { stateId: "moderate", label: "Moderate Risk", count: 30 },
            { stateId: "high", label: "High Risk", count: 20 },
          ],
        },
        {
          evaluationId: "eval-A",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "observed_step",
          states: [
            { stateId: "low", label: "Low Risk", count: 20 },
            { stateId: "moderate", label: "Moderate Risk", count: 30 },
            { stateId: "high", label: "High Risk", count: 50 },
          ],
        },
        // Eval B steps: 3, 6
        {
          evaluationId: "eval-B",
          horizon: 3,
          estimator: "raw",
          estimateOrigin: "observed_step",
          states: [
            { stateId: "low", label: "Low Risk", count: 60 },
            { stateId: "moderate", label: "Moderate Risk", count: 30 },
            { stateId: "high", label: "High Risk", count: 10 },
          ],
        },
        {
          evaluationId: "eval-B",
          horizon: 6,
          estimator: "raw",
          estimateOrigin: "observed_step",
          states: [
            { stateId: "low", label: "Low Risk", count: 30 },
            { stateId: "moderate", label: "Moderate Risk", count: 40 },
            { stateId: "high", label: "High Risk", count: 30 },
          ],
        },
      ],
    };

    expect(() => assertOutcomeDistributionReferentialIntegrity(spec)).not.toThrow();

    const root = renderOutcomeDistribution(spec);
    const slider = root.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider")!;

    // Initial eval: Eval A (default step: last step = 10)
    expect(root.textContent).toContain("Active Step: Step = 10");
    expect(root.textContent).toContain("20 / 100 (20.0%)");

    // Select step 5 for Eval A
    slider.value = "1"; // index 1 is step 5
    slider.dispatchEvent(new Event("input"));
    expect(root.textContent).toContain("Active Step: Step = 5");

    // Switch to Eval B (available steps in B: 3, 6).
    // Target step was 5. Distance to 3 is 2; distance to 6 is 1. Nearest step in B is 6.
    const radioB = root.querySelector<HTMLInputElement>('input[value="eval-B"]')!;
    radioB.checked = true;
    radioB.dispatchEvent(new Event("change"));

    expect(root.textContent).toContain("Active Step: Step = 6");
    expect(root.textContent).toContain("30 / 100 (30.0%)");

    // Switch back to Eval A (available steps in A: 2, 5, 10).
    // Target step was 6. Distance to 5 is 1; distance to 10 is 4; distance to 2 is 4.
    // Nearest step in A is 5.
    const radioA = root.querySelector<HTMLInputElement>('input[value="eval-A"]')!;
    radioA.checked = true;
    radioA.dispatchEvent(new Event("change"));

    expect(root.textContent).toContain("Active Step: Step = 5");
  });
});
