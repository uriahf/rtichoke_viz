// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { ContinuousOutcomeDistributionSpec } from "../src/spec/v2/continuous-outcome-distribution.js";
import { renderContinuousOutcomeDistribution } from "../src/render/continuous-outcome-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpec } from "../src/spec/report.js";

describe("renderContinuousOutcomeDistribution DOM & interaction tests", () => {
  const sampleSpec: ContinuousOutcomeDistributionSpec = {
    schemaVersion: "2.0",
    type: "continuous_outcome_distribution",
    title: "Longitudinal Outcome Test",
    xAxisKind: "step",
    estimator: "raw",
    binEdges: [0, 0.25, 0.5, 0.75, 1.0],
    evaluations: [
      { id: "train", population: "Train" },
      { id: "test", population: "Test" },
    ],
    distributions: [
      {
        evaluationId: "train",
        step: 0,
        referenceSampleSize: 100,
        observedCount: 95,
        unobservedCount: 5,
        binCounts: [10, 20, 40, 25],
      },
      {
        evaluationId: "train",
        step: 5,
        referenceSampleSize: 100,
        observedCount: 90,
        unobservedCount: 10,
        binCounts: [10, 15, 35, 30],
      },
      {
        evaluationId: "test",
        step: 5,
        referenceSampleSize: 80,
        observedCount: 80,
        unobservedCount: 0,
        binCounts: [5, 15, 35, 25],
      },
      {
        evaluationId: "test",
        step: 10,
        referenceSampleSize: 80,
        observedCount: 70,
        unobservedCount: 10,
        binCounts: [5, 10, 30, 25],
      },
    ],
  };

  it("renders basic container structure, title, heatmap, and controls", () => {
    const el = renderContinuousOutcomeDistribution(sampleSpec);
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains("rtichoke-continuous-outcome-distribution")).toBe(true);

    const title = el.querySelector(".rtichoke-outcome-distribution__title");
    expect(title?.textContent).toBe("Longitudinal Outcome Test");

    // Evaluation radio controls
    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios.length).toBe(2);
    expect(radios[0].value).toBe("train");
    expect(radios[0].checked).toBe(true);

    // Heatmap wrapper
    const heatmapWrapper = el.querySelector(".rtichoke-continuous-heatmap-wrapper");
    expect(heatmapWrapper?.querySelector("svg")).not.toBeNull();

    // Slider
    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");
    expect(slider).not.toBeNull();
    expect(slider?.value).toBe("0"); // Step 0 (first available step for Train)

    // Unobserved section should be rendered because unobservedCount > 0 exists
    const unobservedSection = el.querySelector(".rtichoke-continuous-unobserved-section");
    expect(unobservedSection?.textContent).toContain("Unobserved at step 0");
  });

  it("does NOT open histogram when clicking non-cell SVG space, but keyboard activation (Enter/Space) DOES open histogram", () => {
    const el = renderContinuousOutcomeDistribution(sampleSpec);
    const heatmapSvg = el.querySelector<SVGSVGElement>(".rtichoke-continuous-heatmap-wrapper svg");
    expect(heatmapSvg).not.toBeNull();

    // 1. Initially closed
    expect(el.querySelector(".rtichoke-continuous-hist-card")).toBeNull();

    // 2. Click directly on SVG element (non-cell background / empty space)
    heatmapSvg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Histogram MUST remain closed when clicking non-cell SVG space
    expect(el.querySelector(".rtichoke-continuous-hist-card")).toBeNull();

    // 3. Press Space on focused heatmap SVG element
    const spaceEvent = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(spaceEvent, "preventDefault");

    heatmapSvg?.dispatchEvent(spaceEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // Histogram detail card opens for current selected step (step 0)
    const histCard = el.querySelector(".rtichoke-continuous-hist-card");
    expect(histCard).not.toBeNull();
    expect(histCard?.textContent).toContain("Step 0 Detail Histogram");
  });

  it("selects steps cleanly via data-step attributes without regex-matching tooltip text", () => {
    const el = renderContinuousOutcomeDistribution(sampleSpec);
    const heatmapWrapper = el.querySelector(".rtichoke-continuous-heatmap-wrapper");
    const cellRects = heatmapWrapper?.querySelectorAll<SVGRectElement>("g[aria-label='rect'] rect");

    expect(cellRects?.length).toBeGreaterThan(0);
    // Verify rects have explicit data-step attributes
    const targetRect = Array.from(cellRects!).find((r) => r.getAttribute("data-step") === "5");
    expect(targetRect).toBeDefined();

    // Click on cell rect for step 5
    targetRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Selected step updates to 5
    const sliderVal = el.querySelector(".rtichoke-operating-point-value");
    expect(sliderVal?.textContent).toBe("5");

    const histCard = el.querySelector(".rtichoke-continuous-hist-card");
    expect(histCard?.textContent).toContain("Step 5 Detail Histogram");

    const unobservedReadout = el.querySelector(".rtichoke-continuous-unobserved-section");
    expect(unobservedReadout?.textContent).toContain("Unobserved at step 5");
  });

  it("supports sparse and nonconsecutive steps (e.g. steps 1, 5, 10, 20)", () => {
    const nonconsecutiveSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Nonconsecutive Steps Test",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [0, 0.5, 1.0],
      evaluations: [{ id: "train", population: "Train" }],
      distributions: [
        {
          evaluationId: "train",
          step: 1,
          referenceSampleSize: 100,
          observedCount: 90,
          unobservedCount: 10,
          binCounts: [40, 50],
        },
        {
          evaluationId: "train",
          step: 5,
          referenceSampleSize: 100,
          observedCount: 80,
          unobservedCount: 20,
          binCounts: [30, 50],
        },
        {
          evaluationId: "train",
          step: 10,
          referenceSampleSize: 100,
          observedCount: 70,
          unobservedCount: 30,
          binCounts: [20, 50],
        },
        {
          evaluationId: "train",
          step: 20,
          referenceSampleSize: 100,
          observedCount: 50,
          unobservedCount: 50,
          binCounts: [10, 40],
        },
      ],
    };

    const el = renderContinuousOutcomeDistribution(nonconsecutiveSpec);
    const slider = el.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");
    expect(slider?.max).toBe("3"); // 4 available steps (index 0..3)

    // Move slider to index 2 -> Step 10
    slider!.value = "2";
    slider!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(el.querySelector(".rtichoke-operating-point-value")?.textContent).toBe("10");
    expect(el.querySelector(".rtichoke-continuous-unobserved-section")?.textContent).toContain("Unobserved at step 10: 30 / 100");
  });

  it("switches evaluations and synchronizes heatmap, histogram, slider, and unobserved panel", () => {
    const el = renderContinuousOutcomeDistribution(sampleSpec);
    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    // Open histogram on step 0
    const cellRect0 = el.querySelector<SVGRectElement>(".rtichoke-continuous-heatmap-wrapper g[aria-label='rect'] rect");
    cellRect0?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(el.querySelector(".rtichoke-continuous-hist-card")?.textContent).toContain("Step 0 Detail Histogram");

    // Switch evaluation to Test (available steps 5 and 10)
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event("change", { bubbles: true }));

    // Selected step snaps to 5 (nearest available step to 0)
    expect(el.querySelector(".rtichoke-operating-point-value")?.textContent).toBe("5");
    // Histogram detail card updates synchronously to Step 5
    expect(el.querySelector(".rtichoke-continuous-hist-card")?.textContent).toContain("Step 5 Detail Histogram");
    // Unobserved panel updates synchronously to Step 5
    expect(el.querySelector(".rtichoke-continuous-unobserved-section")?.textContent).toContain("Unobserved at step 5");
  });

  it("visualizes bin probability mass for unequal-width bins and formats endpoint brackets correctly ([a, b) and [a, b])", () => {
    const unequalWidthSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Unequal Width Bins Test",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [0, 10, 50, 100], // Widths: 10, 40, 50
      evaluations: [{ id: "train", population: "Train" }],
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 100,
          unobservedCount: 0,
          binCounts: [50, 30, 20], // Narrow bin [0, 10) has 50% probability mass
        },
      ],
    };

    const el = renderContinuousOutcomeDistribution(unequalWidthSpec);
    const cellRect = el.querySelector(".rtichoke-continuous-heatmap-wrapper g[aria-label='rect'] rect");
    cellRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const histCard = el.querySelector(".rtichoke-continuous-hist-card");
    expect(histCard).not.toBeNull();
    const svgInnerHTML = histCard?.querySelector("svg")?.innerHTML ?? "";

    // Non-final bins use half-open brackets [0.000, 10.000) and [10.000, 50.000)
    expect(svgInnerHTML).toContain("[0.000, 10.000)");
    expect(svgInnerHTML).toContain("[10.000, 50.000)");
    // Final bin uses right-closed bracket [50.000, 100.000]
    expect(svgInnerHTML).toContain("[50.000, 100.000]");
  });

  it("embeds inside ReportSpec v1.1 alongside heuristic-aware components without being mutated by report-level heuristic controls", () => {
    const codSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Embedded Continuous Outcome Component",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [0, 50, 100],
      evaluations: [{ id: "train", population: "Train" }],
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 100,
          unobservedCount: 0,
          binCounts: [40, 60],
        },
      ],
    };

    const reportSpec: ReportSpec = {
      schemaVersion: "1.1",
      type: "report",
      heuristics: {
        active: "adjusted:adjusted_as_censored",
        available: [
          "excluded:excluded",
          "adjusted:adjusted_as_censored",
        ],
      },
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-cod",
              title: "Continuous Outcome",
              spec: codSpec,
            },
          ],
        },
      ],
    };

    const reportEl = renderReport(reportSpec);
    expect(reportEl.querySelector(".rtichoke-continuous-outcome-distribution")).not.toBeNull();

    // Toggle censoring radio option to 'excluded'
    const excludedRadio = reportEl.querySelector<HTMLInputElement>('input[type="radio"][value="excluded"]');
    expect(excludedRadio).not.toBeNull();
    excludedRadio?.click();

    // Continuous outcome distribution remains rendered and functional
    expect(reportEl.querySelector(".rtichoke-continuous-outcome-distribution")).not.toBeNull();
    expect(reportEl.querySelector(".rtichoke-report__unavailable")).toBeNull();
  });

  it("handles zero observed outcomes gracefully with an undefined distribution message", () => {
    const zeroObservedSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Zero Observed Test",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [0, 0.5, 1.0],
      evaluations: [{ id: "train", population: "Train" }],
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 0,
          unobservedCount: 100,
          binCounts: [0, 0],
        },
      ],
    };

    const el = renderContinuousOutcomeDistribution(zeroObservedSpec);
    const cellRect = el.querySelector(".rtichoke-continuous-heatmap-wrapper g[aria-label='rect'] rect");
    expect(cellRect).not.toBeNull();

    // Trigger step click on data cell rect to open histogram
    cellRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Check histogram detail card
    const histCard = el.querySelector(".rtichoke-continuous-hist-card");
    expect(histCard).not.toBeNull();
    expect(histCard?.textContent).toContain("No observed outcomes at this step");
    expect(histCard?.textContent).toContain("Empirical distribution is undefined");
  });

  it("hides unobserved panel completely when all steps have unobservedCount == 0", () => {
    const zeroUnobservedSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Zero Unobserved Test",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [0, 0.5, 1.0],
      evaluations: [{ id: "train", population: "Train" }],
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 100,
          unobservedCount: 0,
          binCounts: [40, 60],
        },
        {
          evaluationId: "train",
          step: 5,
          referenceSampleSize: 100,
          observedCount: 100,
          unobservedCount: 0,
          binCounts: [50, 50],
        },
      ],
    };

    const el = renderContinuousOutcomeDistribution(zeroUnobservedSpec);
    const unobservedSection = el.querySelector(".rtichoke-continuous-unobserved-section");
    expect(unobservedSection?.children.length).toBe(0);
  });

  it("renders nonuniform bin edges and negative outcome values faithfully", () => {
    const nonuniformSpec: ContinuousOutcomeDistributionSpec = {
      schemaVersion: "2.0",
      type: "continuous_outcome_distribution",
      title: "Nonuniform Bounds Test",
      xAxisKind: "step",
      estimator: "raw",
      binEdges: [-50, -10, 0, 10, 100],
      evaluations: [{ id: "val", population: "Validation" }],
      distributions: [
        {
          evaluationId: "val",
          step: 10,
          referenceSampleSize: 500,
          observedCount: 500,
          unobservedCount: 0,
          binCounts: [50, 100, 200, 150],
        },
      ],
    };

    const el = renderContinuousOutcomeDistribution(nonuniformSpec);
    const cellRect = el.querySelector(".rtichoke-continuous-heatmap-wrapper g[aria-label='rect'] rect");
    expect(cellRect).not.toBeNull();

    // Trigger step click to open histogram
    cellRect?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const histCard = el.querySelector(".rtichoke-continuous-hist-card");
    expect(histCard).not.toBeNull();
    expect(histCard?.textContent).toContain("Step 10 Detail Histogram");
  });

  it("prevents crosstalk between multiple component instances", () => {
    const el1 = renderContinuousOutcomeDistribution(sampleSpec);
    const el2 = renderContinuousOutcomeDistribution(sampleSpec);

    const slider1 = el1.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");
    const slider2 = el2.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");

    expect(slider1?.id).not.toBe(slider2?.id);
  });
});
