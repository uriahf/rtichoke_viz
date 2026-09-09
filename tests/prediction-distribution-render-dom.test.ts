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
import type { ReportSpecV1_0, ReportSpecV1_1 } from "../src/spec/report.js";
import { RTICHOKE_BROWSER_THEME } from "../src/render/v2.js";

describe("PredictionDistribution Helper & DOM Rendering", () => {
  it("tests resolveConfusionCellColors pure helper for default theme and all four conditioning choices", () => {
    const defaultPdTheme = RTICHOKE_BROWSER_THEME.predictionDistribution;

    // 1. Predicted Positives: denominator TP + FP -> TP & FP emphasized
    const predPos = resolveConfusionCellColors(defaultPdTheme, "predicted_positives");
    expect(predPos.tp).toBe("#009E73"); // emphasized true
    expect(predPos.fp).toBe("#FAC8CD"); // emphasized false
    expect(predPos.tn).toBe("#F4FFF0"); // non-emphasized true
    expect(predPos.fn).toBe("#FFF7F8"); // non-emphasized false

    // 2. Predicted Negatives: denominator TN + FN -> TN & FN emphasized
    const predNeg = resolveConfusionCellColors(defaultPdTheme, "predicted_negatives");
    expect(predNeg.tn).toBe("#009E73"); // emphasized true
    expect(predNeg.fn).toBe("#FAC8CD"); // emphasized false
    expect(predNeg.tp).toBe("#F4FFF0"); // non-emphasized true
    expect(predNeg.fp).toBe("#FFF7F8"); // non-emphasized false

    // 3. Real Positives: denominator TP + FN -> TP & FN emphasized
    const realPos = resolveConfusionCellColors(defaultPdTheme, "real_positives");
    expect(realPos.tp).toBe("#009E73"); // emphasized true
    expect(realPos.fn).toBe("#FAC8CD"); // emphasized false
    expect(realPos.tn).toBe("#F4FFF0"); // non-emphasized true
    expect(realPos.fp).toBe("#FFF7F8"); // non-emphasized false

    // 4. Real Negatives: denominator TN + FP -> TN & FP emphasized
    const realNeg = resolveConfusionCellColors(defaultPdTheme, "real_negatives");
    expect(realNeg.tn).toBe("#009E73"); // emphasized true
    expect(realNeg.fp).toBe("#FAC8CD"); // emphasized false
    expect(realNeg.tp).toBe("#F4FFF0"); // non-emphasized true
    expect(realNeg.fn).toBe("#FFF7F8"); // non-emphasized false
  });
  it("directly tests preparePredictionDistributionPlotData helper for coordinates, heights, atom, cutoff, and count identity", () => {
    const spec = visualFixture as PredictionDistributionSpec;
    const evalId = "Model A";
    const digits = 3;

    // 1. Score-space mode (probability_threshold)
    const threshPrep = preparePredictionDistributionPlotData(
      spec,
      evalId,
      "probability_threshold",
      0.52,
      digits,
    );

    expect(threshPrep.xAxisLabel).toBe("Prediction Score");
    expect(threshPrep.yAxisLabel).toBe("Count density");
    expect(threshPrep.cutoffX).toBe(0.52);

    // Verify score-space lower/upper bounds for ordinary bins
    for (const d of threshPrep.ordinaryPlotData) {
      expect(d.x1).toBeGreaterThanOrEqual(0);
      expect(d.x2).toBeLessThanOrEqual(1);
      expect(d.x2).toBeGreaterThan(d.x1);
      // Density is raw count divided by interval width
      expect(d.density).toBeGreaterThan(0);
    }

    // Verify score-zero mass atom in threshold mode
    expect(threshPrep.zeroAtomPlotData.length).toBeGreaterThan(0);
    expect(threshPrep.zeroAtomPlotData[0].count).toBeGreaterThan(0);

    // 2. PPCR population rank mode (ppcr)
    const ppcrPrep = preparePredictionDistributionPlotData(
      spec,
      evalId,
      "ppcr",
      0.4,
      digits,
    );

    expect(ppcrPrep.xAxisLabel).toBe("Prediction rank percentile (low to high)");
    expect(ppcrPrep.yAxisLabel).toBe("Outcome fraction");

    // Cutoff position equal to 1 - realizedPpcr
    expect(ppcrPrep.cutoffX).toBeCloseTo(1 - ppcrPrep.realizedPpcr, 6);

    // Verify cumulative population bounds, interval widths, and total height = 1.0
    const evalBins = spec.bins
      .filter((b) => b.evaluationId === evalId)
      .sort((a, b) => a.lower - b.lower);

    const totalN = evalBins.reduce((sum, b) => sum + b.nPositive + b.nNegative, 0);
    expect(totalN).toBe(ppcrPrep.totalN);

    let cumCount = 0;
    for (const bin of evalBins) {
      const binTotal = bin.nPositive + bin.nNegative;
      const popLower = cumCount / totalN;
      const popUpper = (cumCount + binTotal) / totalN;
      cumCount += binTotal;

      if (binTotal === 0) {
        // Empty canonical bins have zero population width and are skipped in PPCR plot data
        const matches = ppcrPrep.ordinaryPlotData.filter(
          (d) => d.x1 === popLower && d.x2 === popUpper,
        );
        expect(matches.length).toBe(0);
      } else {
        // Non-empty bins: PPCR interval width = bin total / total N
        expect(popUpper - popLower).toBeCloseTo(binTotal / totalN, 6);

        const posDatum = ppcrPrep.ordinaryPlotData.find(
          (d) =>
            Math.abs(d.x1 - popLower) < 1e-6 &&
            Math.abs(d.x2 - popUpper) < 1e-6 &&
            d.category === "Observed Positives",
        );
        const negDatum = ppcrPrep.ordinaryPlotData.find(
          (d) =>
            Math.abs(d.x1 - popLower) < 1e-6 &&
            Math.abs(d.x2 - popUpper) < 1e-6 &&
            d.category === "Observed Negatives",
        );

        const posFrac = posDatum ? posDatum.density : 0;
        const negFrac = negDatum ? negDatum.density : 0;

        // Positive fraction plus negative fraction equals 1.0
        expect(posFrac + negFrac).toBeCloseTo(1.0, 6);
      }
    }

    // Score-zero mass is represented as an ordinary population-width interval in PPCR mode
    const zeroBin = evalBins.find((b) => b.lower === 0 && b.upper === 0)!;
    const zeroBinTotal = zeroBin.nPositive + zeroBin.nNegative;
    if (zeroBinTotal > 0) {
      const zeroAtomMatches = ppcrPrep.ordinaryPlotData.filter(
        (d) => d.x1 === 0 && Math.abs(d.x2 - zeroBinTotal / totalN) < 1e-6,
      );
      expect(zeroAtomMatches.length).toBeGreaterThan(0);
    }

    // Identical TP/TN/FP/FN totals across both coordinate modes for the same effective cutoff (cutoff = 0.52)
    const ppcrPrep052 = preparePredictionDistributionPlotData(
      spec,
      evalId,
      "ppcr",
      0.4, // cutoff for requested PPCR 0.4 in Model A is 0.52
      digits,
    );

    const threshPrep052 = preparePredictionDistributionPlotData(
      spec,
      evalId,
      "probability_threshold",
      0.52, // threshold 0.52 has cutoff 0.52
      digits,
    );

    expect(ppcrPrep052.cutoff).toBe(threshPrep052.cutoff);
    expect(ppcrPrep052.confusion).toEqual(threshPrep052.confusion);
  });

  it("renders threshold golden fixture and reconstructs exact classifications for cutoff 0.0", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    expect(el).toBeInstanceOf(HTMLElement);

    const table = el.querySelector(".rtichoke-prediction-distribution__table");
    expect(table).not.toBeNull();

    // Select cutoff 0.0 using slider
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "0"; // cutoff 0.0
    slider.dispatchEvent(new Event("input"));

    // At cutoff 0.0: TP=3, FP=3, TN=0, FN=0
    const tpCell = el.querySelector(".rtichoke-prediction-distribution__cell--tp");
    const fpCell = el.querySelector(".rtichoke-prediction-distribution__cell--fp");
    const tnCell = el.querySelector(".rtichoke-prediction-distribution__cell--tn");
    const fnCell = el.querySelector(".rtichoke-prediction-distribution__cell--fn");

    expect(tpCell?.textContent).toContain("TP = 3");
    expect(fpCell?.textContent).toContain("FP = 3");
    expect(tnCell?.textContent).toContain("TN = 0");
    expect(fnCell?.textContent).toContain("FN = 0");
  });

  it("reconstructs exact classifications for cutoff 0.2", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "1"; // cutoff 0.2
    slider.dispatchEvent(new Event("input"));

    // At cutoff 0.2: TP=2, FP=2, TN=1, FN=1
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tp")?.textContent).toContain("TP = 2");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fp")?.textContent).toContain("FP = 2");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tn")?.textContent).toContain("TN = 1");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fn")?.textContent).toContain("FN = 1");
  });

  it("reconstructs exact classifications for cutoff 0.5", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "2"; // cutoff 0.5
    slider.dispatchEvent(new Event("input"));

    // At cutoff 0.5: TP=1, FP=1, TN=2, FN=2
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tp")?.textContent).toContain("TP = 1");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fp")?.textContent).toContain("FP = 1");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tn")?.textContent).toContain("TN = 2");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fn")?.textContent).toContain("FN = 2");
  });

  it("reconstructs exact classifications for cutoff 1.0", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "3"; // cutoff 1.0
    slider.dispatchEvent(new Event("input"));

    // At cutoff 1.0: TP=0, FP=0, TN=3, FN=3
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tp")?.textContent).toContain("TP = 0");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fp")?.textContent).toContain("FP = 0");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--tn")?.textContent).toContain("TN = 3");
    expect(el.querySelector(".rtichoke-prediction-distribution__cell--fn")?.textContent).toContain("FN = 3");
  });

  it("renders PPCR tie fixture and displays requested vs realized PPCR separately", () => {
    const el = renderPredictionDistribution(
      ppcrTieFixture as PredictionDistributionSpec,
    );

    const summary = el.querySelector(".rtichoke-prediction-distribution__summary");
    expect(summary?.textContent).toContain("Requested PPCR");
    expect(summary?.textContent).toContain("0.500");
    expect(summary?.textContent).toContain("Effective Cutoff");
    expect(summary?.textContent).toContain("0.500");
    expect(summary?.textContent).toContain("Realized PPCR");
    expect(summary?.textContent).toContain("0.333");
  });

  it("supports interactive slider movement across multiple threshold operating points", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    expect(Number(slider.max)).toBeGreaterThanOrEqual(10);

    // Move to position 2
    slider.value = "2";
    slider.dispatchEvent(new Event("input"));
    const summaryPos2 = el.querySelector(".rtichoke-prediction-distribution__summary")?.textContent;

    // Move to position 6
    slider.value = "6";
    slider.dispatchEvent(new Event("input"));
    const summaryPos6 = el.querySelector(".rtichoke-prediction-distribution__summary")?.textContent;

    expect(summaryPos2).not.toEqual(summaryPos6);
  });

  it("supports evaluation switching with exact value preservation and deterministic fallback", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const evalSelect = el.querySelector<HTMLSelectElement>(
      ".rtichoke-prediction-distribution__select[aria-label='Evaluation']",
    );
    expect(evalSelect).not.toBeNull();

    // Select cutoff 0.52 (position 5 in Model A threshold ops)
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "5"; // value 0.52
    slider.dispatchEvent(new Event("input"));

    // Switch evaluation to Model B
    evalSelect!.value = "Model B";
    evalSelect!.dispatchEvent(new Event("change"));

    const valueSpan = el.querySelector(".rtichoke-operating-point-value");
    // Value 0.52 exists in Model B threshold ops, so exact value is preserved
    expect(valueSpan?.textContent).toBe("0.520");
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

  it("verifies default color mode is Confusion matrix cell and default conditioning is Predicted positives", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const colorModeSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Color bars by']",
    );
    const conditioningSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Condition on']",
    );

    expect(colorModeSelect?.value).toBe("confusion_matrix_cell");
    expect(conditioningSelect?.value).toBe("predicted_positives");

    // Conditioning select is visible in Confusion matrix cell mode
    const conditioningGroup = conditioningSelect?.parentElement;
    expect(conditioningGroup?.style.display).not.toBe("none");

    // Legend contains 4 classification swatches
    const legendLabels = Array.from(
      el.querySelectorAll(".rtichoke-legend-label"),
    ).map((span) => span.textContent);
    expect(legendLabels).toEqual([
      "True Positives (TP)",
      "False Positives (FP)",
      "True Negatives (TN)",
      "False Negatives (FN)",
    ]);
  });

  it("handles observed-outcome mode, hides conditioning control, and preserves conditioning on switch back", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const colorModeSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Color bars by']",
    );
    const conditioningSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Condition on']",
    );
    const conditioningGroup = conditioningSelect?.parentElement;

    // Change conditioning to "real_positives"
    conditioningSelect!.value = "real_positives";
    conditioningSelect!.dispatchEvent(new Event("change"));
    expect(conditioningSelect!.value).toBe("real_positives");

    // Switch to "observed_outcome" mode
    colorModeSelect!.value = "observed_outcome";
    colorModeSelect!.dispatchEvent(new Event("change"));

    // Conditioning control is hidden
    expect(conditioningGroup?.style.display).toBe("none");

    // Legend shows only Observed Positives and Observed Negatives
    const legendLabelsObserved = Array.from(
      el.querySelectorAll(".rtichoke-legend-label"),
    ).map((span) => span.textContent);
    expect(legendLabelsObserved).toEqual([
      "Observed Positives",
      "Observed Negatives",
    ]);

    // Switch back to "confusion_matrix_cell" mode
    colorModeSelect!.value = "confusion_matrix_cell";
    colorModeSelect!.dispatchEvent(new Event("change"));

    // Conditioning control is visible again and preserved as "real_positives"
    expect(conditioningGroup?.style.display).toBe("inline-flex");
    expect(conditioningSelect!.value).toBe("real_positives");

    const legendLabelsRestored = Array.from(
      el.querySelectorAll(".rtichoke-legend-label"),
    ).map((span) => span.textContent);
    expect(legendLabelsRestored).toEqual([
      "True Positives (TP)",
      "False Positives (FP)",
      "True Negatives (TN)",
      "False Negatives (FN)",
    ]);
  });

  it("verifies cutoff-dependent classification membership and score-atom semantics in preparePredictionDistributionPlotData", () => {
    const spec = visualFixture as PredictionDistributionSpec;
    const digits = 3;

    // 1. Cutoff 0.0: every bin (including score-zero atom) is predicted positive
    const prep0 = preparePredictionDistributionPlotData(
      spec,
      "Model A",
      "probability_threshold",
      0.0,
      digits,
    );

    expect(prep0.cutoff).toBe(0.0);

    // Score-zero mass atom at cutoff 0.0:
    // pos atom = TP, neg atom = FP
    const posZeroAtom0 = prep0.zeroAtomPlotData.find(
      (d) => d.category === "Observed Positives",
    );
    const negZeroAtom0 = prep0.zeroAtomPlotData.find(
      (d) => d.category === "Observed Negatives",
    );
    expect(posZeroAtom0?.classificationCell).toBe("TP");
    expect(posZeroAtom0?.cellLabel).toBe("True Positive (TP)");
    expect(negZeroAtom0?.classificationCell).toBe("FP");
    expect(negZeroAtom0?.cellLabel).toBe("False Positive (FP)");

    // Ordinary bins at cutoff 0.0: all predicted positive
    for (const d of prep0.ordinaryPlotData) {
      if (d.category === "Observed Positives") {
        expect(d.classificationCell).toBe("TP");
      } else {
        expect(d.classificationCell).toBe("FP");
      }
    }

    // 2. Cutoff 0.52: bins with upper <= 0.52 are predicted negative; upper > 0.52 are predicted positive
    const prep052 = preparePredictionDistributionPlotData(
      spec,
      "Model A",
      "probability_threshold",
      0.52,
      digits,
    );

    expect(prep052.cutoff).toBe(0.52);

    // Score-zero mass atom at cutoff 0.52 (upper = 0.0 <= 0.52):
    // pos atom = FN, neg atom = TN
    const posZeroAtom052 = prep052.zeroAtomPlotData.find(
      (d) => d.category === "Observed Positives",
    );
    const negZeroAtom052 = prep052.zeroAtomPlotData.find(
      (d) => d.category === "Observed Negatives",
    );
    expect(posZeroAtom052?.classificationCell).toBe("FN");
    expect(posZeroAtom052?.cellLabel).toBe("False Negative (FN)");
    expect(negZeroAtom052?.classificationCell).toBe("TN");
    expect(negZeroAtom052?.cellLabel).toBe("True Negative (TN)");

    // Ordinary bins at cutoff 0.52:
    for (const d of prep052.ordinaryPlotData) {
      if (d.x2 <= 0.52) {
        // predicted negative
        if (d.category === "Observed Positives") {
          expect(d.classificationCell).toBe("FN");
        } else {
          expect(d.classificationCell).toBe("TN");
        }
      } else {
        // predicted positive
        if (d.category === "Observed Positives") {
          expect(d.classificationCell).toBe("TP");
        } else {
          expect(d.classificationCell).toBe("FP");
        }
      }
    }
  });

  it("verifies DOM table cell background colors and legend swatches for all four conditioning choices", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );

    const conditioningSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Condition on']",
    );

    const getCellBgHex = (selector: string) => {
      const cell = el.querySelector<HTMLElement>(selector);
      return cell?.style.backgroundColor ?? "";
    };

    const getLegendSwatchBgs = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(".rtichoke-legend-line"),
      ).map((span) => span.style.backgroundColor);

    // Helper to convert hex like #009E73 or rgb(...) for clean comparisons
    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const emphTrueRgb = hexToRgb("#009E73");
    const emphFalseRgb = hexToRgb("#FAC8CD");
    const nonEmphTrueRgb = hexToRgb("#F4FFF0");
    const nonEmphFalseRgb = hexToRgb("#FFF7F8");

    // 1. Predicted Positives: TP & FP emphasized
    conditioningSelect!.value = "predicted_positives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tp")).toBe(emphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fp")).toBe(emphFalseRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tn")).toBe(nonEmphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fn")).toBe(nonEmphFalseRgb);

    // Legend order is stable: TP, FP, TN, FN
    expect(getLegendSwatchBgs()).toEqual([
      emphTrueRgb,
      emphFalseRgb,
      nonEmphTrueRgb,
      nonEmphFalseRgb,
    ]);

    // 2. Predicted Negatives: TN & FN emphasized
    conditioningSelect!.value = "predicted_negatives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tn")).toBe(emphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fn")).toBe(emphFalseRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tp")).toBe(nonEmphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fp")).toBe(nonEmphFalseRgb);

    expect(getLegendSwatchBgs()).toEqual([
      nonEmphTrueRgb,
      nonEmphFalseRgb,
      emphTrueRgb,
      emphFalseRgb,
    ]);

    // 3. Real Positives: TP & FN emphasized
    conditioningSelect!.value = "real_positives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tp")).toBe(emphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fn")).toBe(emphFalseRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tn")).toBe(nonEmphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fp")).toBe(nonEmphFalseRgb);

    expect(getLegendSwatchBgs()).toEqual([
      emphTrueRgb,
      nonEmphFalseRgb,
      nonEmphTrueRgb,
      emphFalseRgb,
    ]);

    // 4. Real Negatives: TN & FP emphasized
    conditioningSelect!.value = "real_negatives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tn")).toBe(emphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fp")).toBe(emphFalseRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--tp")).toBe(nonEmphTrueRgb);
    expect(getCellBgHex(".rtichoke-prediction-distribution__cell--fn")).toBe(nonEmphFalseRgb);

    expect(getLegendSwatchBgs()).toEqual([
      nonEmphTrueRgb,
      emphFalseRgb,
      emphTrueRgb,
      nonEmphFalseRgb,
    ]);
  });

  it("verifies DOM interaction invariance for table values and exact SVG rect geometry attributes across conditioning and color mode toggles", () => {
    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );

    const conditioningSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Condition on']",
    );
    const colorModeSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Color bars by']",
    );

    // 1. Record initial table values and exact SVG rect geometry attributes
    const getTableValues = () => ({
      tp: el.querySelector(".rtichoke-prediction-distribution__cell--tp")?.textContent,
      fp: el.querySelector(".rtichoke-prediction-distribution__cell--fp")?.textContent,
      tn: el.querySelector(".rtichoke-prediction-distribution__cell--tn")?.textContent,
      fn: el.querySelector(".rtichoke-prediction-distribution__cell--fn")?.textContent,
    });

    const getSvgRectAttributes = () =>
      Array.from(
        el.querySelectorAll<SVGRectElement>(
          ".rtichoke-prediction-distribution__chart rect",
        ),
      ).map((rect) => ({
        x: rect.getAttribute("x"),
        y: rect.getAttribute("y"),
        width: rect.getAttribute("width"),
        height: rect.getAttribute("height"),
      }));

    const initialTable = getTableValues();
    const initialRects = getSvgRectAttributes();
    expect(initialRects.length).toBeGreaterThan(0);

    // 2. Change conditioning to "real_positives"
    conditioningSelect!.value = "real_positives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    // Cell colors change to real_positives mapping (TP emphasized, FN emphasized)
    const tpCell = el.querySelector<HTMLElement>(
      ".rtichoke-prediction-distribution__cell--tp",
    );
    expect(tpCell?.style.backgroundColor).toBe("rgb(0, 158, 115)");

    // Table values and exact SVG rect geometry attributes remain identical
    expect(getTableValues()).toEqual(initialTable);
    expect(getSvgRectAttributes()).toEqual(initialRects);

    // 3. Switch color mode to "observed_outcome"
    colorModeSelect!.value = "observed_outcome";
    colorModeSelect!.dispatchEvent(new Event("change"));

    // Table values and exact SVG rect geometry attributes remain identical again
    expect(getTableValues()).toEqual(initialTable);
    expect(getSvgRectAttributes()).toEqual(initialRects);
  });

  it("preserves component-local presentation state across cutoff movement, dimension, and evaluation switches", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const colorModeSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Color bars by']",
    );
    const conditioningSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Condition on']",
    );
    const evalSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Evaluation']",
    );
    const dimSelect = el.querySelector<HTMLSelectElement>(
      "select[aria-label='Operating point dimension']",
    );
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    );

    // Set conditioning to "real_negatives"
    conditioningSelect!.value = "real_negatives";
    conditioningSelect!.dispatchEvent(new Event("change"));

    // 1. Move slider cutoff
    slider!.value = "3";
    slider!.dispatchEvent(new Event("input"));
    expect(conditioningSelect!.value).toBe("real_negatives");

    // 2. Switch dimension to PPCR
    dimSelect!.value = "ppcr";
    dimSelect!.dispatchEvent(new Event("change"));
    expect(conditioningSelect!.value).toBe("real_negatives");

    // 3. Switch evaluation to Model B
    evalSelect!.value = "Model B";
    evalSelect!.dispatchEvent(new Event("change"));
    expect(conditioningSelect!.value).toBe("real_negatives");
  });

  it("supports custom theme overrides for predictionDistribution colors", () => {
    const customOptions = {
      theme: {
        predictionDistribution: {
          emphasizedTrue: "#112233",
          nonEmphasizedTrue: "#445566",
          emphasizedFalse: "#778899",
          nonEmphasizedFalse: "#AABBCC",
          observedPositive: "#DDEEFF",
          observedNegative: "#001122",
        },
      },
    };

    const el = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
      customOptions,
    );

    // Verify confusion table cells reflect custom colors
    const tpCell = el.querySelector<HTMLElement>(
      ".rtichoke-prediction-distribution__cell--tp",
    );
    expect(tpCell?.style.backgroundColor).toContain("rgb(17, 34, 51)"); // #112233 in RGB
  });

  it("directly consumes precomputed operatingPoint.performance values (Sens, Spec, PPV, NPV, TP, FP, TN, FN)", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    // Verify metric cards display precomputed values
    const metricsRow = el.querySelector(".rtichoke-pd-metrics-row");
    expect(metricsRow).not.toBeNull();
    expect(metricsRow?.textContent).toContain("Sens");
    expect(metricsRow?.textContent).toContain("Spec");
    expect(metricsRow?.textContent).toContain("PPV");
    expect(metricsRow?.textContent).toContain("NPV");

    // Move slider to cutoff position 0.52
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    slider.value = "5";
    slider.dispatchEvent(new Event("input"));

    // Verify precomputed performance values are consumed directly
    expect(metricsRow?.textContent).not.toBeNull();
  });

  it("supports Stacked vs Mirrored radio selection and preserves state across display switches", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const stackedRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='stacked']",
    );
    const mirroredRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='mirrored']",
    );

    expect(stackedRadio?.checked).toBe(true);
    expect(mirroredRadio?.checked).toBe(false);

    // Switch to Mirrored
    mirroredRadio!.checked = true;
    mirroredRadio!.dispatchEvent(new Event("change"));

    // Verify plot re-rendered in Mirrored mode (contains y=0 rule)
    const chart = el.querySelector(".rtichoke-prediction-distribution__chart");
    expect(chart).not.toBeNull();

    // Switch back to Stacked
    stackedRadio!.checked = true;
    stackedRadio!.dispatchEvent(new Event("change"));
    expect(stackedRadio?.checked).toBe(true);
  });

  it("integrates conditioning radio group into matrix headers with synchronized metric emphasis", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const allObsRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='all_observations']",
    );
    const predPosRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='predicted_positives']",
    );
    const realPosRadio = el.querySelector<HTMLInputElement>(
      "input[type='radio'][value='real_positives']",
    );

    expect(allObsRadio?.checked).toBe(true);

    // Select Predicted Positives
    predPosRadio!.checked = true;
    predPosRadio!.dispatchEvent(new Event("change"));

    // Verify PPV metric card is emphasized
    const cards = el.querySelectorAll(".rtichoke-pd-metric-card");
    const ppvCard = Array.from(cards).find((c) =>
      c.textContent?.includes("PPV"),
    );
    expect(ppvCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(
      true,
    );

    // Select Real Positives
    realPosRadio!.checked = true;
    realPosRadio!.dispatchEvent(new Event("change"));

    // Verify Sens metric card is emphasized
    const updatedCards = el.querySelectorAll(".rtichoke-pd-metric-card");
    const sensCard = Array.from(updatedCards).find((c) =>
      c.textContent?.includes("Sens"),
    );
    expect(sensCard?.classList.contains("rtichoke-pd-metric-card--emphasized")).toBe(
      true,
    );
  });

  it("renders Model and Population radio controls and hides single-option selectors", () => {
    // Multi-evaluation spec has Model and Population controls
    const multiEl = renderPredictionDistribution(
      multiFixture as PredictionDistributionSpec,
    );
    const modelGroup = multiEl.querySelector(
      "[role='radiogroup'][aria-label='Model']",
    );
    expect(modelGroup).not.toBeNull();

    // Single evaluation spec hides Model and Population controls
    const singleEl = renderPredictionDistribution(
      thresholdFixture as PredictionDistributionSpec,
    );
    const hiddenModelGroup = singleEl.querySelector(
      "[role='radiogroup'][aria-label='Model']",
    );
    expect(hiddenModelGroup).toBeNull();
  });
});
