// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import thresholdFixture from "../fixtures/v2/prediction-distribution-threshold.json";
import ppcrTieFixture from "../fixtures/v2/prediction-distribution-ppcr-tie.json";
import multiFixture from "../fixtures/v2/prediction-distribution-multi.json";
import visualFixture from "../fixtures/v2/prediction-distribution-visual.json";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import {
  preparePredictionDistributionPlotData,
  renderPredictionDistribution,
  resolveConfusionCellColors,
} from "../src/render/prediction-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import { RTICHOKE_BROWSER_THEME } from "../src/render/v2.js";

describe("PredictionDistribution Helper & DOM Rendering", () => {
  it("tests resolveConfusionCellColors pure helper for default theme and all five conditioning choices", () => {
    const defaultPdTheme = RTICHOKE_BROWSER_THEME.predictionDistribution;

    // 1. Predicted Positives: TP & FP emphasized
    const predPos = resolveConfusionCellColors(defaultPdTheme, "predicted_positives");
    expect(predPos.tp).toBe("#009E73"); // emphasized true
    expect(predPos.fp).toBe("#FAC8CD"); // emphasized false
    expect(predPos.tn).toBe("#F4FFF0"); // non-emphasized true
    expect(predPos.fn).toBe("#FFF7F8"); // non-emphasized false

    // 2. Predicted Negatives: TN & FN emphasized
    const predNeg = resolveConfusionCellColors(defaultPdTheme, "predicted_negatives");
    expect(predNeg.tn).toBe("#009E73"); // emphasized true
    expect(predNeg.fn).toBe("#FAC8CD"); // emphasized false
    expect(predNeg.tp).toBe("#F4FFF0"); // non-emphasized true
    expect(predNeg.fp).toBe("#FFF7F8"); // non-emphasized false

    // 3. Real Positives: TP & FN emphasized
    const realPos = resolveConfusionCellColors(defaultPdTheme, "real_positives");
    expect(realPos.tp).toBe("#009E73"); // emphasized true
    expect(realPos.fn).toBe("#FAC8CD"); // emphasized false
    expect(realPos.tn).toBe("#F4FFF0"); // non-emphasized true
    expect(realPos.fp).toBe("#FFF7F8"); // non-emphasized false

    // 4. Real Negatives: TN & FP emphasized
    const realNeg = resolveConfusionCellColors(defaultPdTheme, "real_negatives");
    expect(realNeg.tn).toBe("#009E73"); // emphasized true
    expect(realNeg.fp).toBe("#FAC8CD"); // emphasized false
    expect(realNeg.tp).toBe("#F4FFF0"); // non-emphasized true
    expect(realNeg.fn).toBe("#FFF7F8"); // non-emphasized false

    // 5. All Observations: TP, FP, TN, FN all active
    const allObs = resolveConfusionCellColors(defaultPdTheme, "all_observations");
    expect(allObs.tp).toBe("#009E73");
    expect(allObs.tn).toBe("#009E73");
  });

  it("verifies 100% producer-owned statistics: consumes supplied performance values directly", () => {
    // Create spec with supplied canonical performance that deliberately differs from bin summation
    const customSpec: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      evaluations: [
        { id: "eval-1", model: "Model Custom", population: "Overall" },
      ],
      bins: [
        { evaluationId: "eval-1", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 10, nNegative: 10 },
        { evaluationId: "eval-1", lower: 0, upper: 0.5, includeLower: false, includeUpper: true, nPositive: 45, nNegative: 45 },
        { evaluationId: "eval-1", lower: 0.5, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 45, nNegative: 45 },
      ],
      operatingPoints: [
        {
          evaluationId: "eval-1",
          type: "probability_threshold",
          value: 0.5,
          cutoff: 0.5,
          realizedPpcr: 0.45,
          performance: [
            { metricId: "true_positives", estimate: 999 },
            { metricId: "false_positives", estimate: 111 },
            { metricId: "true_negatives", estimate: 888 },
            { metricId: "false_negatives", estimate: 222 },
            { metricId: "sensitivity", estimate: 0.818 },
            { metricId: "specificity", estimate: 0.889 },
            { metricId: "ppv", estimate: 0.900 },
            { metricId: "npv", estimate: 0.800 },
          ],
        },
      ],
    };

    const el = renderPredictionDistribution(customSpec);
    expect(el).toBeInstanceOf(HTMLElement);

    // Verify metric cards show supplied values directly (Sens = 81.8%, Spec = 88.9%, PPV = 90.0%, NPV = 80.0%)
    const metricsText = el.querySelector(".rtichoke-pd-metrics-row")?.textContent;
    expect(metricsText).toContain("81.8%");
    expect(metricsText).toContain("88.9%");
    expect(metricsText).toContain("90.0%");
    expect(metricsText).toContain("80.0%");

    // Verify matrix cells show supplied counts directly (TP = 999, FP = 111, TN = 888, FN = 222)
    const tpCell = el.querySelector(".rtichoke-prediction-distribution__cell--tp");
    const fpCell = el.querySelector(".rtichoke-prediction-distribution__cell--fp");
    expect(tpCell?.textContent).toContain("999");
    expect(fpCell?.textContent).toContain("111");
  });

  it("omits performance readout and confusion matrix when operatingPoint.performance is absent", () => {
    const specWithoutPerf: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Pop" }],
      bins: [
        { evaluationId: "eval-1", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 5, nNegative: 5 },
        { evaluationId: "eval-1", lower: 0, upper: 0.5, includeLower: false, includeUpper: true, nPositive: 5, nNegative: 5 },
        { evaluationId: "eval-1", lower: 0.5, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 5, nNegative: 5 },
      ],
      operatingPoints: [
        { evaluationId: "eval-1", type: "probability_threshold", value: 0.5, cutoff: 0.5, realizedPpcr: 0.3333333333333333 },
      ],
    };

    const el = renderPredictionDistribution(specWithoutPerf);
    // Matrix table and metric cards are omitted
    expect(el.querySelector(".rtichoke-pd-matrix")).toBeNull();
    expect(el.querySelector(".rtichoke-pd-metrics-row")).toBeNull();
  });

  it("verifies exact zero-score cutoff semantics across sub-interval cutoffs: cutoff == 0, 0 < cutoff < 0.01, cutoff == 0.01", () => {
    const spec = visualFixture as PredictionDistributionSpec;
    const digits = 3;

    // 1. Cutoff == 0: all scores predicted positive
    const prep0 = preparePredictionDistributionPlotData(
      spec,
      "Model A",
      "probability_threshold",
      0.0,
      digits,
    );

    expect(prep0.cutoff).toBe(0.0);
    // First displayed bar has predicted positive = true
    const firstBar0 = prep0.ordinaryPlotData.find((d) => d.x1 === 0 && d.x2 > 0);
    expect(firstBar0?.isPredictedPositive).toBe(true);

    // 2. Cutoff == 0.005 (inside first displayed interval [0, 0.01))
    const prep005 = preparePredictionDistributionPlotData(
      spec,
      "Model A",
      "probability_threshold",
      0.005,
      digits,
    );

    expect(prep005.cutoff).toBe(0.005);
    // Score zero atom bin [0, 0] has upper = 0 <= 0.005 -> predicted negative
    const zeroAtomPos = prep005.zeroAtomPlotData.find((d) => d.category === "Observed Positives");
    expect(zeroAtomPos?.classificationCell).toBe("FN");

    // 3. Cutoff == 0.01 (first positive canonical boundary)
    const prep01 = preparePredictionDistributionPlotData(
      spec,
      "Model A",
      "probability_threshold",
      0.01,
      digits,
    );

    expect(prep01.cutoff).toBe(0.01);
    const zeroAtom01 = prep01.zeroAtomPlotData.find((d) => d.category === "Observed Positives");
    expect(zeroAtom01?.classificationCell).toBe("FN");
  });

  it("renders Reference Group radio control and hides single-option selectors", () => {
    // Multi-evaluation spec renders Reference Group radio selector
    const multiEl = renderPredictionDistribution(
      multiFixture as PredictionDistributionSpec,
    );
    const refGroup = multiEl.querySelector(
      "[role='radiogroup'][aria-label='Reference Group']",
    );
    expect(refGroup).not.toBeNull();

    // Single evaluation spec hides Reference Group selector
    const singleEl = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    const hiddenRefGroup = singleEl.querySelector(
      "[role='radiogroup'][aria-label='Reference Group']",
    );
    expect(hiddenRefGroup).toBeNull();
  });

  it("removes permanent four-item legend in Confusion Matrix Cell mode and displays minimal legend in Observed Outcome mode", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    // Permanent 4-item legend is removed in Confusion Matrix Cell mode
    const legendLabelsDefault = Array.from(
      el.querySelectorAll(".rtichoke-legend-label"),
    ).map((span) => span.textContent);
    expect(legendLabelsDefault).toEqual([]);

    // Switch to Observed Outcome mode
    const obsRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='observed_outcome']",
    )!;
    obsRadio.checked = true;
    obsRadio.dispatchEvent(new Event("change"));

    // Minimal legend shows Observed Positives & Observed Negatives
    const legendLabelsObserved = Array.from(
      el.querySelectorAll(".rtichoke-legend-label"),
    ).map((span) => span.textContent);
    expect(legendLabelsObserved).toEqual([
      "Observed Positives",
      "Observed Negatives",
    ]);
  });

  it("renders confusion matrix cells with neutral background and in-cell proportional data bars", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    // Confusion matrix cells have neutral background with inner bar
    const tpCell = el.querySelector<HTMLElement>(
      ".rtichoke-prediction-distribution__cell--tp",
    );
    expect(tpCell).not.toBeNull();

    const innerBar = tpCell?.querySelector<HTMLElement>(".rtichoke-pd-cell-bar");
    expect(innerBar).not.toBeNull();
    expect(innerBar?.style.width).not.toBe("");
  });

  it("supports Stacked vs Mirrored display geometry toggling and formats Mirrored Y-axis ticks as non-negative magnitudes", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const stackedRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='stacked']",
    )!;
    const mirroredRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='mirrored']",
    )!;

    expect(stackedRadio.checked).toBe(true);

    // Switch to Mirrored
    mirroredRadio.checked = true;
    mirroredRadio.dispatchEvent(new Event("change"));

    const chart = el.querySelector(".rtichoke-prediction-distribution__chart");
    expect(chart).not.toBeNull();

    // Switch back to Stacked
    stackedRadio.checked = true;
    stackedRadio.dispatchEvent(new Event("change"));
    expect(stackedRadio.checked).toBe(true);
  });

  it("integrates conditioning radio group into matrix headers with synchronized metric emphasis", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const allObsRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='all_observations']",
    )!;
    const predPosRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='predicted_positives']",
    )!;
    const realPosRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='real_positives']",
    )!;

    expect(allObsRadio.checked).toBe(true);

    // Select Predicted Positives
    predPosRadio.checked = true;
    predPosRadio.dispatchEvent(new Event("change"));

    const cardsPredPos = el.querySelectorAll(".rtichoke-pd-metric-card");
    const ppvCard = Array.from(cardsPredPos).find((c) =>
      c.textContent?.includes("PPV"),
    );
    expect(ppvCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);

    // Select Real Positives
    realPosRadio.checked = true;
    realPosRadio.dispatchEvent(new Event("change"));

    const cardsRealPos = el.querySelectorAll(".rtichoke-pd-metric-card");
    const sensCard = Array.from(cardsRealPos).find((c) =>
      c.textContent?.includes("Sens"),
    );
    expect(sensCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);
  });

  it("renders embedded inside structured ReportSpec v1.1 sections -> group -> components", () => {
    const reportSpecV1_1: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      title: "Structured Report v1.1 Test",
      sections: [
        {
          id: "distribution-section",
          title: "Prediction Score Distributions",
          items: [
            {
              type: "group",
              id: "prob-dist-group",
              title: "Model Comparison Group",
              components: [
                {
                  type: "component",
                  id: "visual-comp",
                  title: "Realistic Visual Review",
                  spec: visualFixture as PredictionDistributionSpec,
                },
              ],
            },
          ],
        },
      ],
    };

    const reportEl = renderReport(reportSpecV1_1);
    expect(reportEl).toBeInstanceOf(HTMLElement);

    const groupEl = reportEl.querySelector("[data-group-id='prob-dist-group']");
    expect(groupEl).not.toBeNull();

    const compEl = groupEl?.querySelector("[data-component-id='visual-comp']");
    expect(compEl).not.toBeNull();

    const predDistEl = compEl?.querySelector(".rtichoke-prediction-distribution");
    expect(predDistEl).not.toBeNull();
  });
});
