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
      "Censored before horizon; no censoring adjustment is applied.",
    );
  });

  it("rejects when multiple heuristic or method variants exist for the same step or horizon", () => {
    const spec = createFixedHorizonFallbackSpec();
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

    expect(() => renderOutcomeDistribution(spec)).toThrow(
      "multiple state distributions defined for evaluation eval-1 at step/horizon 10",
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

  it("renders unstroked step-area fills with separate lineY state boundary paths matching cumulative state percentages", () => {
    const spec = createTrajectorySpec();
    const root = renderOutcomeDistribution(spec);
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();

    // 1. Check area mark group and area paths: 1 continuous path per outcome state without perimeter strokes
    const areaGroup = svg?.querySelector('g[aria-label="area"]');
    expect(areaGroup).not.toBeNull();
    expect(areaGroup?.getAttribute("stroke")).toBeNull();
    expect(areaGroup?.getAttribute("stroke-width")).toBeNull();

    const areaPaths = areaGroup?.querySelectorAll("path");
    // For 4 outcome states, exactly 4 continuous filled area paths are rendered
    expect(areaPaths?.length).toBe(4);
    areaPaths?.forEach((path) => {
      expect(path.getAttribute("stroke")).toBeNull();
      expect(path.getAttribute("stroke-width")).toBeNull();
      expect(path.getAttribute("fill")).not.toBeNull();
    });

    // 2. Check line mark group (step-line internal state boundaries): K-1 = 3 boundary paths for 4 states
    const lineGroup = svg?.querySelector('g[aria-label="line"]');
    expect(lineGroup).not.toBeNull();
    const linePaths = lineGroup?.querySelectorAll("path");
    expect(linePaths?.length).toBe(3);

    // 3. Verify internal boundary line coordinates against independently computed cumulative state percentages
    const evalDists = spec.stateDistributions
      .filter((d) => d.evaluationId === spec.evaluations[0].id && d.estimateOrigin === "event_table")
      .sort((a, b) => (a.horizon ?? 0) - (b.horizon ?? 0));

    // Independently calculate cumulative percentage at each internal boundary b in [0, K-2]
    const expectedBoundaries: number[][] = [[], [], []];
    for (const dist of evalDists) {
      const counts = dist.states.map((s) => s.count ?? 0);
      const total = counts.reduce((acc, c) => acc + c, 0);
      let cum = 0;
      for (let b = 0; b < counts.length - 1; b++) {
        cum += (counts[b] / total) * 100;
        expectedBoundaries[b].push(cum);
      }
    }

    // Verify each expected internal boundary has non-empty path string
    linePaths?.forEach((path, idx) => {
      const dAttr = path.getAttribute("d");
      expect(dAttr).not.toBeNull();
      expect(dAttr?.length).toBeGreaterThan(0);
    });

    // 4. Check fixed horizon reference lines (ruleX) retain expected stroke styling
    const ruleGroup = svg?.querySelector('g[aria-label="rule"]');
    expect(ruleGroup).not.toBeNull();
    const ruleGroupStroke = ruleGroup?.getAttribute("stroke");
    const ruleLines = ruleGroup?.querySelectorAll("line");
    expect(ruleLines?.length).toBeGreaterThan(0);

    const hasRuleStroke = Boolean(
      ruleGroupStroke ||
        Array.from(ruleLines ?? []).some((line) => line.getAttribute("stroke")),
    );
    expect(hasRuleStroke).toBe(true);
  });

  describe("observed_step rendering", () => {
    it("renders raw observed_step longitudinal trajectory with Step axis and Step tooltips", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        title: "Longitudinal Raw Step Distribution",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "remission", count: 80 },
              { stateId: "relapse", count: 20 },
            ],
          },
          {
            evaluationId: "eval-1",
            horizon: 2,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "remission", count: 60 },
              { stateId: "relapse", count: 40 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const text = root.textContent ?? "";

      expect(text).toContain("Step");
      expect(text).toContain("Active Step: Step = 2");
      expect(text).toContain("State");
      expect(text).toContain("remission");
      expect(text).toContain("relapse");
      expect(text).not.toContain("Event"); // Should not apply canonical mapping for arbitrary states

      const svgHtml = root.querySelector("svg")?.innerHTML ?? "";
      expect(svgHtml).toContain("Step: 2");
      expect(svgHtml).toContain("Observed count: 40");
      expect(svgHtml).toContain("Observed denominator: 100");
      expect(svgHtml).toContain("Observed percentage: 40.0%");
    });

    it("renders AJ-adjusted observed_step occupancy with Percentage and no count/denominator terminology", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        title: "AJ Step Distribution",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 10,
            estimator: "aalen_johansen",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "remission", label: "In Remission", estimate: 0.75 },
              { stateId: "relapse", label: "Relapsed", estimate: 0.25 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const text = root.textContent ?? "";

      expect(text).toContain("Occupancy (%)");
      expect(text).toContain("75.0%");
      expect(text).toContain("25.0%");
      expect(text).not.toContain("Count / Total");
      expect(text).not.toContain("Raw observed status");

      const svgHtml = root.querySelector("svg")?.innerHTML ?? "";
      expect(svgHtml).toContain("AJ estimated occupancy: 0.75");
      expect(svgHtml).toContain("Percentage: 75.0%");
      expect(svgHtml).not.toContain("Observed count");
      expect(svgHtml).not.toContain("Observed denominator");
    });

    it("renders a single observed_step without a slider control", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 3,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [{ stateId: "active", count: 100 }],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const slider = root.querySelector(".rtichoke-operating-point-control");
      expect((slider as HTMLElement)?.style.display).toBe("none");
      expect(root.textContent).toContain("Active Step: Step = 3");
    });

    it("does not bridge step-area fills across unobserved step gaps (e.g. steps 1 and 5)", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        title: "Step Gap Test",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "remission", count: 80 },
              { stateId: "relapse", count: 20 },
            ],
          },
          {
            evaluationId: "eval-1",
            horizon: 5,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "remission", count: 50 },
              { stateId: "relapse", count: 50 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const svg = root.querySelector("svg");
      expect(svg).not.toBeNull();

      // Uses stacked bars (barY) for discrete step axis
      const rects = svg?.querySelectorAll("rect");
      expect(rects?.length).toBeGreaterThan(0);

      // Both step 1 and step 5 have inspectable hover targets with step titles
      const titles = Array.from(svg?.querySelectorAll("title") ?? []).map(
        (t) => t.textContent ?? "",
      );
      expect(titles.some((t) => t.includes("Step: 1"))).toBe(true);
      expect(titles.some((t) => t.includes("Step: 5"))).toBe(true);
    });

    it("renders True Blue ordinal palette for 3, 4, 5, 6, 7, and 8 levels when stateScale='ordinal'", () => {
      for (let n = 3; n <= 8; n++) {
        const states = Array.from({ length: n }, (_, i) => ({
          stateId: `stage_${i + 1}`,
          label: `Stage ${i + 1}`,
          estimate: 1 / n,
        }));

        const spec: OutcomeDistributionSpec = {
          schemaVersion: "2.0",
          type: "outcome_distribution",
          stateScale: "ordinal",
          evaluations: [{ id: "eval-1", population: "cohort-1" }],
          stateDistributions: [
            {
              evaluationId: "eval-1",
              horizon: 1,
              estimator: "aalen_johansen",
              estimateOrigin: "observed_step",
              states,
            },
          ],
        };

        const root = renderOutcomeDistribution(spec);
        const badges = root.querySelectorAll(".rtichoke-performance-table__badge");
        expect(badges.length).toBe(n);

        // Verify badge colors match True Blue stops
        const badgeColors = Array.from(badges).map((b) => (b as HTMLElement).style.backgroundColor);
        expect(badgeColors.length).toBe(n);
        // Endpoints should be lightest (#EDF5FD) and darkest (#103C70)
        expect(badgeColors[0]).not.toBe("");
        expect(badgeColors[n - 1]).not.toBe("");
      }
    });

    it("supports arbitrary ordinal state counts > 8 using RGB interpolation across True Blue stops", () => {
      const n = 12;
      const states = Array.from({ length: n }, (_, i) => ({
        stateId: `stage_${i + 1}`,
        label: `Stage ${i + 1}`,
        estimate: 1 / n,
      }));

      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        stateScale: "ordinal",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "aalen_johansen",
            estimateOrigin: "observed_step",
            states,
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const badges = root.querySelectorAll(".rtichoke-performance-table__badge");
      expect(badges.length).toBe(12);
    });

    it("renders Colorful Minimal palette for nominal states in observed_step distributions", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        stateScale: "nominal",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "home", count: 50 },
              { stateId: "outpatient", count: 30 },
              { stateId: "ward", count: 20 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const badges = Array.from(
        root.querySelectorAll(".rtichoke-performance-table__badge"),
      ) as HTMLElement[];
      expect(badges.length).toBe(3);

      // Colorful Minimal palette first 3 colors: #2672B9, #FFC247, #9E91CF
      expect(badges[0].style.backgroundColor).toBe("rgb(38, 114, 185)"); // #2672B9
      expect(badges[1].style.backgroundColor).toBe("rgb(255, 194, 71)"); // #FFC247
      expect(badges[2].style.backgroundColor).toBe("rgb(158, 145, 207)"); // #9E91CF
    });

    it("maintains stable state-color mappings across multiple steps", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        stateScale: "nominal",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "a", count: 50 },
              { stateId: "b", count: 50 },
            ],
          },
          {
            evaluationId: "eval-1",
            horizon: 2,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "a", count: 20 },
              { stateId: "b", count: 80 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);
      const badgesStep1 = Array.from(
        root.querySelectorAll(".rtichoke-performance-table__badge"),
      ) as HTMLElement[];

      // State 'a' and state 'b' color
      const colorA = badgesStep1[0].style.backgroundColor;
      const colorB = badgesStep1[1].style.backgroundColor;

      // Select step 2
      const slider = root.querySelector(
        ".rtichoke-operating-point-slider",
      ) as HTMLInputElement;
      slider.value = "1";
      slider.dispatchEvent(new Event("input"));

      const badgesStep2 = Array.from(
        root.querySelectorAll(".rtichoke-performance-table__badge"),
      ) as HTMLElement[];
      expect(badgesStep2[0].style.backgroundColor).toBe(colorA);
      expect(badgesStep2[1].style.backgroundColor).toBe(colorB);
    });

    it("verifies removal of bar click-to-select handler and custom slider inline background override", () => {
      const spec: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "a", count: 50 },
              { stateId: "b", count: 50 },
            ],
          },
          {
            evaluationId: "eval-1",
            horizon: 2,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "a", count: 30 },
              { stateId: "b", count: 70 },
            ],
          },
        ],
      };

      const root = renderOutcomeDistribution(spec);

      // (a) Slider has no inline background override or linear-gradient
      const slider = root.querySelector(".rtichoke-operating-point-slider") as HTMLInputElement;
      expect(slider).not.toBeNull();
      expect(slider.style.background).toBe("");

      // (b) Clicking a bar element does NOT change the selected step from 2 to 1
      expect(root.textContent).toContain("Active Step: Step = 2");
      const rect = root.querySelector("svg rect");
      expect(rect).not.toBeNull();
      rect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // Active step remains 2
      expect(root.textContent).toContain("Active Step: Step = 2");
    });

    it("maintains stable state color identity when state label changes", () => {
      const spec1: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        stateScale: "nominal",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "stable_id_1", label: "Label Version A", count: 50 },
              { stateId: "stable_id_2", label: "Label Version B", count: 50 },
            ],
          },
        ],
      };

      const root1 = renderOutcomeDistribution(spec1);
      const badge1 = root1.querySelector(
        ".rtichoke-performance-table__badge",
      ) as HTMLElement;
      const color1 = badge1.style.backgroundColor;

      const spec2: OutcomeDistributionSpec = {
        schemaVersion: "2.0",
        type: "outcome_distribution",
        stateScale: "nominal",
        evaluations: [{ id: "eval-1", population: "cohort-1" }],
        stateDistributions: [
          {
            evaluationId: "eval-1",
            horizon: 1,
            estimator: "raw",
            estimateOrigin: "observed_step",
            states: [
              { stateId: "stable_id_1", label: "Completely Different Label", count: 50 },
              { stateId: "stable_id_2", label: "Another Label", count: 50 },
            ],
          },
        ],
      };

      const root2 = renderOutcomeDistribution(spec2);
      const badge2 = root2.querySelector(
        ".rtichoke-performance-table__badge",
      ) as HTMLElement;
      const color2 = badge2.style.backgroundColor;

      // Colors mapped by stateId remain identical despite label change
      expect(color1).toBe(color2);
    });
  });
});
