// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import canonicalFixture from "../fixtures/v2/outcome-distribution.json" with { type: "json" };
import largeFixture from "../fixtures/v2/outcome-distribution-large.json" with { type: "json" };
import populationsFixture from "../fixtures/v2/outcome-distribution-populations.json" with { type: "json" };
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
      {
        evaluationId: "eval-1",
        horizon: 10,
        estimator: "raw",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", count: 2 },
          { stateId: "real_negative", count: 8 },
        ],
      },
      {
        evaluationId: "eval-1",
        horizon: 30,
        estimator: "raw",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", count: 4 },
          { stateId: "real_negative", count: 6 },
        ],
      },
      {
        evaluationId: "eval-1",
        horizon: 50,
        estimator: "raw",
        estimateOrigin: "fixed_time_horizon",
        states: [
          { stateId: "real_positive", count: 6 },
          { stateId: "real_negative", count: 4 },
        ],
      },
    ],
  };
}

describe("Outcome Distribution Renderer DOM and UX Polish", () => {
  it("renders trajectory mode with step-area plot, fixed horizon markers, slider, and count-first readout", () => {
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

    // Readout table header and count-first cell formatting
    const readoutTable = root.querySelector(
      ".rtichoke-outcome-distribution__readout-table",
    );
    expect(readoutTable).not.toBeNull();
    expect(readoutTable?.textContent).toContain("Count / Total (%)");

    // Check count-first format <count> / <total> (<pct>%) and in-cell bar with opacity 0.45
    const readoutCell = root.querySelector(
      ".rtichoke-outcome-distribution__readout-cell",
    );
    expect(readoutCell).not.toBeNull();
    const barFill = readoutCell?.querySelector(
      ".rtichoke-performance-table__bar-fill",
    ) as HTMLElement;
    expect(barFill).not.toBeNull();
    expect(barFill.style.backgroundColor).not.toBe("");
    expect(barFill.style.opacity).toBe("0.45");
    expect(readoutCell?.textContent).toMatch(/\d+ \/ \d+ \(\d+\.\d+%\)/);

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
    expect(textContent).toContain("Outcome");

    // Must NOT show estimator jargon or internal state IDs
    expect(textContent).not.toContain("Aalen-Johansen");
    expect(textContent).not.toContain("aalen_johansen");
    expect(textContent).not.toContain("estimateOrigin");
    expect(textContent).not.toContain("real_positive");
    expect(textContent).not.toContain("real_competing");
    expect(textContent).not.toContain("real_negative");
  });

  it("uses default canonical labels when label is omitted and custom labels when label is provided", () => {
    // 1. Spec with no custom labels -> should use default canonical labels ("Event", "Competing event", "Event-free", "Censored")
    const specDefault: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Test Cohort" }],
      stateDistributions: [
        {
          evaluationId: "eval-1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [
            { stateId: "real_positive", count: 60 },
            { stateId: "real_competing", count: 10 },
            { stateId: "real_negative", count: 20 },
            { stateId: "real_censored", count: 10 },
          ],
        },
      ],
    };

    const rootDefault = renderOutcomeDistribution(specDefault);
    const textDefault = rootDefault.textContent ?? "";

    expect(textDefault).toContain("Event");
    expect(textDefault).toContain("Competing event");
    expect(textDefault).toContain("Event-free");
    expect(textDefault).toContain("Censored");

    // 2. Spec with explicit custom labels -> custom labels must take precedence
    const specCustom: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Test Cohort" }],
      stateDistributions: [
        {
          evaluationId: "eval-1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [
            { stateId: "real_positive", label: "My Custom Event", count: 60 },
            { stateId: "real_negative", label: "My Custom Control", count: 40 },
          ],
        },
      ],
    };

    const rootCustom = renderOutcomeDistribution(specCustom);
    const textCustom = rootCustom.textContent ?? "";

    expect(textCustom).toContain("My Custom Event");
    expect(textCustom).toContain("My Custom Control");
  });

  it("renders fixed-horizon fallback mode with stacked bars and y-axis label 'Outcomes'", () => {
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
    expect(textContent).toContain("Outcome");

    // At active horizon 50 (last horizon by default): 6 / 10 (60.0%)
    expect(textContent).toContain("6 / 10 (60.0%)");

    // SVG y-axis label
    const yAxisLabel = root.querySelector('[aria-label$="axis label"]');
    expect(yAxisLabel?.textContent).toContain("Outcomes");

    // Must NOT contain jargon
    expect(textContent).not.toContain("Aalen-Johansen");
    expect(textContent).not.toContain("estimateOrigin");
  });

  it("renders explicit raw accounting and censoring notes in chart tooltip titles", () => {
    const spec: OutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "outcome_distribution",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Test Cohort" }],
      stateDistributions: [
        {
          evaluationId: "eval-1",
          horizon: 10,
          estimator: "raw",
          estimateOrigin: "fixed_time_horizon",
          states: [
            { stateId: "real_positive", count: 60 },
            { stateId: "real_censored", count: 40 },
          ],
        },
      ],
    };

    const root = renderOutcomeDistribution(spec);
    const svgInnerHTML = root.querySelector("svg")?.innerHTML ?? "";
    expect(svgInnerHTML).toContain("Horizon: 10");
    expect(svgInnerHTML).toContain("Outcome status:");
    expect(svgInnerHTML).toContain("Percent:");
    expect(svgInnerHTML).toContain("Accounting: Raw observed status");
    expect(svgInnerHTML).toContain(
      "Censored before or at horizon; no censoring adjustment is applied.",
    );
  });

  it("displays explicit unsupported message when multiple heuristic variants exist for the same horizon", () => {
    const spec = createFixedHorizonFallbackSpec();
    // Add a duplicate variant for the same horizon=10 and estimateOrigin='fixed_time_horizon'
    spec.stateDistributions.push({
      evaluationId: "eval-1",
      horizon: 10,
      estimator: "raw",
      estimateOrigin: "fixed_time_horizon",
      censoringHeuristic: "excluded",
      states: [
        { stateId: "real_positive", count: 3 },
        { stateId: "real_negative", count: 7 },
      ],
    });

    const root = renderOutcomeDistribution(spec);
    const text = root.textContent ?? "";

    expect(text).toContain(
      "Multiple heuristic/method variants detected for evaluation; unsupported data state.",
    );
  });

  it("renders active evaluation selector when multiple evaluations exist and omits selector when single evaluation exists", () => {
    // 1. Single evaluation -> no evaluation selector
    const specSingle = createTrajectorySpec();
    const rootSingle = renderOutcomeDistribution(specSingle);
    const controlsSingle = rootSingle.querySelector(
      ".rtichoke-outcome-distribution__controls",
    );
    expect(controlsSingle?.textContent).toBe("");

    // 2. Multiple evaluations -> evaluation selector group rendered
    const specMulti = createTrajectorySpec();
    specMulti.evaluations.push({
      id: "eval-2",
      model: "Model 2",
      population: "Test Cohort",
    });
    specMulti.stateDistributions.push({
      evaluationId: "eval-2",
      horizon: 10,
      estimator: "raw",
      estimateOrigin: "fixed_time_horizon",
      states: [{ stateId: "real_positive", label: "Event", count: 100 }],
    });

    const rootMulti = renderOutcomeDistribution(specMulti);
    const controlsMultiText =
      rootMulti.querySelector(".rtichoke-outcome-distribution__controls")
        ?.textContent ?? "";

    expect(controlsMultiText).toContain("Evaluation:");
    expect(controlsMultiText).toContain("Model A");
    expect(controlsMultiText).toContain("Model 2");
  });

  it("renders large sample size fixture (N = 3,000 observations) with count-first readout formatting", () => {
    const spec = structuredClone(largeFixture) as OutcomeDistributionSpec;
    const root = renderOutcomeDistribution(spec);

    expect(root.className).toBe("rtichoke-outcome-distribution");
    const readoutTable = root.querySelector(
      ".rtichoke-outcome-distribution__readout-table",
    );
    expect(readoutTable).not.toBeNull();
    const textContent = root.textContent ?? "";

    expect(textContent).toContain("1,257 / 3,000 (41.9%)");
    expect(textContent).toContain("342 / 3,000 (11.4%)");
  });

  it("renders multiple populations fixture with interactive evaluation radio group selector", () => {
    const spec = structuredClone(populationsFixture) as OutcomeDistributionSpec;
    const root = renderOutcomeDistribution(spec);

    expect(root.className).toBe("rtichoke-outcome-distribution");
    const controls = root.querySelector(".rtichoke-outcome-distribution__controls");
    expect(controls).not.toBeNull();
    const controlsText = controls?.textContent ?? "";

    expect(controlsText).toContain("Evaluation:");
    expect(controlsText).toContain("Train Cohort (N = 5,000)");
    expect(controlsText).toContain("Test Cohort (N = 3,000)");
    expect(controlsText).toContain("Validation Cohort (N = 2,000)");

    // Initial selected evaluation is Train Cohort
    expect(root.textContent).toContain("2,076 / 5,000 (41.5%)");

    // Select Test Cohort radio button
    const testRadio = root.querySelector<HTMLInputElement>(
      'input[type="radio"][value="eval-test"]',
    );
    expect(testRadio).not.toBeNull();
    testRadio!.checked = true;
    testRadio!.dispatchEvent(new Event("change"));

    // Readout updates to Test Cohort values (N = 3,000)
    expect(root.textContent).toContain("1,257 / 3,000 (41.9%)");
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
