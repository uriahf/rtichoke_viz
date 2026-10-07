// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import canonicalFixture from "../fixtures/v2/outcome-distribution.json" with { type: "json" };
import { renderOutcomeDistribution } from "../src/render/outcome-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpec } from "../src/spec/report.js";
import type { OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";

function createTrajectorySpec(): OutcomeDistributionSpec {
  return structuredClone(canonicalFixture) as OutcomeDistributionSpec;
}

function createFixedHorizonFallbackSpec(): OutcomeDistributionSpec {
  return {
    schemaVersion: "2.0",
    type: "outcome_distribution",
    title: "Fixed Horizon Fallback Outcome Distribution",
    evaluations: [
      {
        id: "eval-1",
        model: "Model Fallback",
        population: "Test Cohort",
      },
    ],
    stateDistributions: [
      // Only fixed_time_horizon rows (no event_table rows)
      {
        evaluationId: "eval-1",
        horizon: 10,
        estimator: "aalen_johansen",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", label: "Target event", count: 2 },
          { stateId: "real_negative", label: "No target event", count: 8 },
        ],
      },
      {
        evaluationId: "eval-1",
        horizon: 30,
        estimator: "aalen_johansen",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", label: "Target event", count: 4 },
          { stateId: "real_negative", label: "No target event", count: 6 },
        ],
      },
      {
        evaluationId: "eval-1",
        horizon: 50,
        estimator: "aalen_johansen",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", label: "Target event", count: 6 },
          { stateId: "real_negative", label: "No target event", count: 4 },
        ],
      },
    ],
  };
}

describe("Outcome Distribution Renderer DOM and Wording", () => {
  it("renders trajectory mode with step-area plot, fixed horizon markers, slider, and readout from canonical fixture", () => {
    const spec = createTrajectorySpec();
    const root = renderOutcomeDistribution(spec);

    expect(root.className).toBe("rtichoke-outcome-distribution");
    expect(
      root.querySelector(".rtichoke-outcome-distribution__title")?.textContent,
    ).toBe("Outcome Distribution (Canonical Time Horizons Example)");

    // Readout card & table present
    const readoutCard = root.querySelector(
      ".rtichoke-outcome-distribution__readout-card",
    );
    expect(readoutCard).not.toBeNull();
    expect(readoutCard?.textContent).toContain("Active Horizon:");

    // Slider present
    const slider = root.querySelector(
      ".rtichoke-operating-point-slider",
    ) as HTMLInputElement;
    expect(slider).not.toBeNull();

    // Chart SVG present
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    const textContent = root.textContent ?? "";

    // Mandatory wording assertions
    expect(textContent).toContain("Outcome Distribution");
    expect(textContent).toContain("Time");
    expect(textContent).toContain("Percentage");
    expect(textContent).toContain("Outcome");
    expect(textContent).toContain("Target event");
    expect(textContent).toContain("Competing outcome");
    expect(textContent).toContain("No target event");
    expect(textContent).toContain("Unknown / excluded");

    // Must NOT show estimator jargon or internal state IDs
    expect(textContent).not.toContain("Aalen-Johansen");
    expect(textContent).not.toContain("aalen_johansen");
    expect(textContent).not.toContain("estimateOrigin");
    expect(textContent).not.toContain("real_positive");
    expect(textContent).not.toContain("real_competing");
    expect(textContent).not.toContain("real_negative");
  });

  it("renders fixed-horizon fallback mode with stacked bars when no event_table rows exist", () => {
    const spec = createFixedHorizonFallbackSpec();
    const root = renderOutcomeDistribution(spec);

    expect(root.className).toBe("rtichoke-outcome-distribution");
    const readoutCard = root.querySelector(
      ".rtichoke-outcome-distribution__readout-card",
    );
    expect(readoutCard).not.toBeNull();

    // Mandatory wording assertions
    const textContent = root.textContent ?? "";
    expect(textContent).toContain("Time");
    expect(textContent).toContain("Percentage");
    expect(textContent).toContain("Outcome");
    expect(textContent).toContain("Count");

    // Must NOT contain jargon
    expect(textContent).not.toContain("Aalen-Johansen");
    expect(textContent).not.toContain("estimateOrigin");
  });

  it("renders heuristic controls when multiple canonical heuristic combinations exist and filters correctly", () => {
    const spec = createTrajectorySpec();
    spec.stateDistributions.push(
      {
        evaluationId: "eval-canonical",
        horizon: 20,
        estimator: "aalen_johansen",
        estimateOrigin: "fixed_time_horizon",
        censoringHeuristic: "excluded",
        competingHeuristic: "adjusted_as_negative",
        states: [
          { stateId: "real_positive", label: "Target event", estimate: 0.15 },
          { stateId: "real_negative", label: "No target event", estimate: 0.85 },
        ],
      },
      {
        evaluationId: "eval-canonical",
        horizon: 20,
        estimator: "aalen_johansen",
        estimateOrigin: "fixed_time_horizon",
        censoringHeuristic: "adjusted",
        competingHeuristic: "adjusted_as_censored",
        states: [
          { stateId: "real_positive", label: "Target event", estimate: 0.10 },
          { stateId: "real_negative", label: "No target event", estimate: 0.90 },
        ],
      },
    );

    const root = renderOutcomeDistribution(spec);
    const controls = root.querySelector(
      ".rtichoke-outcome-distribution__controls",
    );
    expect(controls).not.toBeNull();
    const controlsText = controls?.textContent ?? "";

    expect(controlsText).toContain("Censoring:");
    expect(controlsText).toContain("Competing:");
    expect(controlsText).toContain("Adjusted");
    expect(controlsText).toContain("Excluded");
    expect(controlsText).toContain("As censored");

    // Must NOT contain raw enum names
    expect(controlsText).not.toContain("adjusted_as_censored");
    expect(controlsText).not.toContain("adjusted_as_negative");
  });

  it("renders active evaluation selector when multiple evaluations exist", () => {
    const spec = createTrajectorySpec();
    spec.evaluations.push({
      id: "eval-2",
      model: "Model 2",
      population: "Test Cohort",
    });
    spec.stateDistributions.push({
      evaluationId: "eval-2",
      horizon: 10,
      estimator: "raw",
      estimateOrigin: "fixed_time_horizon",
      states: [{ stateId: "real_positive", label: "Target event", count: 100 }],
    });

    const root = renderOutcomeDistribution(spec);
    const controlsText = root.querySelector(
      ".rtichoke-outcome-distribution__controls",
    )?.textContent ?? "";

    expect(controlsText).toContain("Evaluation:");
    expect(controlsText).toContain("Model A");
    expect(controlsText).toContain("Model 2");
  });

  it("integrates into ReportSpec v1.0 and v1.1 and renders via renderReport()", () => {
    const odSpec = createTrajectorySpec();

    const reportV1_0: ReportSpec = {
      schemaVersion: "1.0",
      type: "report",
      title: "Outcome Distribution Report v1.0",
      components: [
        {
          id: "comp-od",
          title: "Outcome Distribution Component",
          spec: odSpec,
        },
      ],
    };

    const root1_0 = renderReport(reportV1_0);
    expect(root1_0.className).toBe("rtichoke-report");
    expect(
      root1_0.querySelector(".rtichoke-outcome-distribution"),
    ).not.toBeNull();

    const reportV1_1: ReportSpec = {
      schemaVersion: "1.1",
      type: "report",
      title: "Outcome Distribution Report v1.1",
      sections: [
        {
          id: "sec-od",
          title: "Outcome Section",
          items: [
            {
              type: "component",
              id: "comp-od-1",
              title: "Outcome Distribution Component v1.1",
              spec: odSpec,
            },
          ],
        },
      ],
    };

    const root1_1 = renderReport(reportV1_1);
    expect(root1_1.className).toBe("rtichoke-report");
    expect(
      root1_1.querySelector(".rtichoke-outcome-distribution"),
    ).not.toBeNull();
  });
});
