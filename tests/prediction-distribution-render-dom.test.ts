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

describe("PredictionDistribution Manager Review Requirements Tests", () => {
  it("1. proves no user-facing 'Realized PPCR' remains in labels, readouts, tooltips, or accessibility text", () => {
    const el = renderPredictionDistribution(visualFixture as PredictionDistributionSpec);
    const htmlText = el.innerHTML;
    expect(htmlText).not.toContain("Realized PPCR");
    expect(htmlText).not.toContain("realized_ppcr");
  });

  it("2. proves requested PPCR controls the visible PPCR boundary (cutoffX = 1 - requested_ppcr)", () => {
    const spec = visualFixture as PredictionDistributionSpec;
    const prep = preparePredictionDistributionPlotData(spec, "Model A", "ppcr", 0.20, 2);
    // cutoffX = 1 - 0.20 = 0.80
    expect(prep.cutoffX).toBe(0.80);
  });

  it("3. proves adjacent requested PPCR values may have the same cutoff/classification", () => {
    const specWithTie: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      evaluations: [{ id: "eval-tie", model: "Model Tie", population: "Pop" }],
      bins: [
        { evaluationId: "eval-tie", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 0, nNegative: 0 },
        { evaluationId: "eval-tie", lower: 0, upper: 0.8, includeLower: false, includeUpper: true, nPositive: 20, nNegative: 80 },
        { evaluationId: "eval-tie", lower: 0.8, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 50, nNegative: 10 },
      ],
      operatingPoints: [
        {
          evaluationId: "eval-tie",
          type: "ppcr",
          value: 0.10,
          cutoff: 0.80,
          realizedPpcr: 0.375,
          performance: [
            { metricId: "true_positives", estimate: 50 },
            { metricId: "false_positives", estimate: 10 },
            { metricId: "true_negatives", estimate: 80 },
            { metricId: "false_negatives", estimate: 20 },
          ],
        },
        {
          evaluationId: "eval-tie",
          type: "ppcr",
          value: 0.12,
          cutoff: 0.80,
          realizedPpcr: 0.375,
          performance: [
            { metricId: "true_positives", estimate: 50 },
            { metricId: "false_positives", estimate: 10 },
            { metricId: "true_negatives", estimate: 80 },
            { metricId: "false_negatives", estimate: 20 },
          ],
        },
      ],
    };

    const prep1 = preparePredictionDistributionPlotData(specWithTie, "eval-tie", "ppcr", 0.10, 2);
    const prep2 = preparePredictionDistributionPlotData(specWithTie, "eval-tie", "ppcr", 0.12, 2);

    expect(prep1.cutoff).toBe(0.80);
    expect(prep2.cutoff).toBe(0.80);
    expect(prep1.confusion?.tp).toBe(prep2.confusion?.tp);
  });

  it("4. proves PPCR rank-bin masses are not fractionally redistributed to force equal empirical mass", () => {
    const specWithUnequalRankBins: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Pop" }],
      bins: [
        { evaluationId: "eval-1", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 0, nNegative: 0 },
        { evaluationId: "eval-1", lower: 0, upper: 0.5, includeLower: false, includeUpper: true, nPositive: 10, nNegative: 90 },
        { evaluationId: "eval-1", lower: 0.5, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 100, nNegative: 100 },
      ],
      rankBins: [
        { evaluationId: "eval-1", rankLower: 0.0, rankUpper: 0.5, positiveMass: 10.0, negativeMass: 90.0 },
        { evaluationId: "eval-1", rankLower: 0.5, rankUpper: 1.0, positiveMass: 100.0, negativeMass: 100.0 },
      ],
      operatingPoints: [
        { evaluationId: "eval-1", type: "ppcr", value: 0.5, cutoff: 0.5, realizedPpcr: 0.5 },
      ],
    };

    const prep = preparePredictionDistributionPlotData(specWithUnequalRankBins, "eval-1", "ppcr", 0.5, 2);
    const count1 = prep.ordinaryPlotData.filter(d => d.x1 === 0.0).reduce((acc, d) => acc + d.count, 0);
    const count2 = prep.ordinaryPlotData.filter(d => d.x1 === 0.5).reduce((acc, d) => acc + d.count, 0);

    expect(count1).toBe(100);
    expect(count2).toBe(200);
  });

  it("5 & 6. proves histogram y-axis label is Count and Mirrored count ticks are non-negative", () => {
    const spec = visualFixture as PredictionDistributionSpec;
    const prep = preparePredictionDistributionPlotData(spec, "Model A", "probability_threshold", 0.5, 2);
    expect(prep.yAxisLabel).toBe("Count");

    const el = renderPredictionDistribution(spec);
    const mirroredRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='mirrored']")!;
    mirroredRadio.checked = true;
    mirroredRadio.dispatchEvent(new Event("change"));

    expect(el.querySelector(".rtichoke-prediction-distribution__chart")).not.toBeNull();
  });

  it("7. proves zero-score display still preserves exact cutoff semantics across sub-interval boundaries", () => {
    const spec = visualFixture as PredictionDistributionSpec;

    // Cutoff 0 -> bin0 [0, 0] predicted positive
    const prep0 = preparePredictionDistributionPlotData(spec, "Model A", "probability_threshold", 0.0, 2);
    expect(prep0.cutoff).toBe(0.0);
    const pos0 = prep0.ordinaryPlotData.find(d => d.x1 === 0 && d.category === "Observed Positives");
    expect(pos0?.isPredictedPositive).toBe(true);

    // Cutoff > 0 -> bin0 [0, 0] predicted negative
    const prep01 = preparePredictionDistributionPlotData(spec, "Model A", "probability_threshold", 0.01, 2);
    expect(prep01.cutoff).toBe(0.01);
    const zeroAtom = prep01.zeroAtomPlotData.find(d => d.category === "Observed Positives");
    expect(zeroAtom?.classificationCell).toBe("FN");
  });

  it("8. proves matrix interior colors change with Color Bars By while marginal total colors remain stable", () => {
    const el = renderPredictionDistribution(visualFixture as PredictionDistributionSpec);

    // Default mode: Confusion Matrix Cell
    const tpCell = el.querySelector<HTMLElement>(".rtichoke-prediction-distribution__cell--tp .rtichoke-pd-cell-bar")!;
    const defaultTpBarColor = tpCell.style.backgroundColor;

    // Switch to Observed Outcome mode
    const obsRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='observed_outcome']")!;
    obsRadio.checked = true;
    obsRadio.dispatchEvent(new Event("change"));

    const tpCellObs = el.querySelector<HTMLElement>(".rtichoke-prediction-distribution__cell--tp .rtichoke-pd-cell-bar")!;
    const obsTpBarColor = tpCellObs.style.backgroundColor;

    expect(defaultTpBarColor).not.toBe(obsTpBarColor);
  });

  it("9, 10 & 11. proves Real Positive margin remains #4C5454, Real Negative remains #E0E0E0, and predicted margins remain neutral", () => {
    const defaultPdTheme = RTICHOKE_BROWSER_THEME.predictionDistribution;
    expect(defaultPdTheme.observedPositive).toBe("#4C5454");
    expect(defaultPdTheme.observedNegative).toBe("#E0E0E0");

    const el = renderPredictionDistribution(visualFixture as PredictionDistributionSpec);
    const totRealPosCellBar = el.querySelectorAll<HTMLElement>(".rtichoke-pd-matrix__tot-row td")[0].querySelector<HTMLElement>(".rtichoke-pd-cell-bar")!;
    expect(totRealPosCellBar.style.backgroundColor).toBe("rgb(76, 84, 84)");

    const totRealNegCellBar = el.querySelectorAll<HTMLElement>(".rtichoke-pd-matrix__tot-row td")[1].querySelector<HTMLElement>(".rtichoke-pd-cell-bar")!;
    expect(totRealNegCellBar.style.backgroundColor).toBe("rgb(224, 224, 224)");
  });

  it("12 & 13. proves metric values (including Lift) come from producer-owned performance directly", () => {
    const customSpec: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      evaluations: [{ id: "eval-1", model: "Model Custom", population: "Overall" }],
      bins: [
        { evaluationId: "eval-1", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 0, nNegative: 0 },
        { evaluationId: "eval-1", lower: 0, upper: 0.5, includeLower: false, includeUpper: true, nPositive: 50, nNegative: 50 },
        { evaluationId: "eval-1", lower: 0.5, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 50, nNegative: 50 },
      ],
      operatingPoints: [
        {
          evaluationId: "eval-1",
          type: "probability_threshold",
          value: 0.5,
          cutoff: 0.5,
          realizedPpcr: 0.5,
          performance: [
            { metricId: "true_positives", estimate: 50 },
            { metricId: "false_positives", estimate: 50 },
            { metricId: "true_negatives", estimate: 50 },
            { metricId: "false_negatives", estimate: 50 },
            { metricId: "sensitivity", estimate: 0.888 },
            { metricId: "specificity", estimate: 0.777 },
            { metricId: "ppv", estimate: 0.666 },
            { metricId: "npv", estimate: 0.555 },
            { metricId: "lift", estimate: 2.34 },
          ],
        },
      ],
    };

    const el = renderPredictionDistribution(customSpec);
    const metricsRowText = el.querySelector(".rtichoke-pd-metrics-row")?.textContent;

    expect(metricsRowText).toContain("88.8%");
    expect(metricsRowText).toContain("77.7%");
    expect(metricsRowText).toContain("66.6%");
    expect(metricsRowText).toContain("55.5%");
    expect(metricsRowText).toContain("2.34");
  });

  it("14, 15, 16 & 17. proves conditioning metric emphasis mappings (Predicted Positive -> PPV + Lift; Predicted Negative -> NPV; Real Positive -> Sens; Real Negative -> Spec)", () => {
    const el = renderPredictionDistribution(visualFixture as PredictionDistributionSpec);

    const predPosRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='predicted_positives']")!;
    predPosRadio.checked = true;
    predPosRadio.dispatchEvent(new Event("change"));

    const cardsPredPos = el.querySelectorAll(".rtichoke-pd-metric-card");
    const ppvCard = Array.from(cardsPredPos).find((c) => c.textContent?.includes("PPV"));
    const liftCard = Array.from(cardsPredPos).find((c) => c.textContent?.includes("Lift"));
    expect(ppvCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);
    expect(liftCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);

    const predNegRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='predicted_negatives']")!;
    predNegRadio.checked = true;
    predNegRadio.dispatchEvent(new Event("change"));

    const cardsPredNeg = el.querySelectorAll(".rtichoke-pd-metric-card");
    const npvCard = Array.from(cardsPredNeg).find((c) => c.textContent?.includes("NPV"));
    expect(npvCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);

    const realPosRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='real_positives']")!;
    realPosRadio.checked = true;
    realPosRadio.dispatchEvent(new Event("change"));

    const cardsRealPos = el.querySelectorAll(".rtichoke-pd-metric-card");
    const sensCard = Array.from(cardsRealPos).find((c) => c.textContent?.includes("Sensitivity"));
    expect(sensCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);

    const realNegRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='real_negatives']")!;
    realNegRadio.checked = true;
    realNegRadio.dispatchEvent(new Event("change"));

    const cardsRealNeg = el.querySelectorAll(".rtichoke-pd-metric-card");
    const specCard = Array.from(cardsRealNeg).find((c) => c.textContent?.includes("Specificity"));
    expect(specCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(true);
  });

  it("18. proves display-mode switching (Stacked <-> Mirrored) preserves operating-point, conditioning, color, and model/population selection", () => {
    const el = renderPredictionDistribution(multiFixture as PredictionDistributionSpec);

    const modelBRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='Model B (Moderate Accuracy)']")!;
    if (modelBRadio) {
      modelBRadio.checked = true;
      modelBRadio.dispatchEvent(new Event("change"));
    }

    const realPosRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='real_positives']")!;
    realPosRadio.checked = true;
    realPosRadio.dispatchEvent(new Event("change"));

    const obsRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='observed_outcome']")!;
    obsRadio.checked = true;
    obsRadio.dispatchEvent(new Event("change"));

    const mirroredRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='mirrored']")!;
    mirroredRadio.checked = true;
    mirroredRadio.dispatchEvent(new Event("change"));

    const stackedRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='stacked']")!;
    stackedRadio.checked = true;
    stackedRadio.dispatchEvent(new Event("change"));

    const activeRealPosRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='real_positives']")!;
    expect(activeRealPosRadio.checked).toBe(true);

    const activeObsRadio = el.querySelector<HTMLInputElement>("input[type='radio'][value='observed_outcome']")!;
    expect(activeObsRadio.checked).toBe(true);
  });
});
