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
} from "../src/render/prediction-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_0, ReportSpecV1_1 } from "../src/spec/report.js";

describe("PredictionDistribution Helper & DOM Rendering", () => {
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
});
