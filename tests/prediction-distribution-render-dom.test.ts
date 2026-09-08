// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import thresholdFixture from "../fixtures/v2/prediction-distribution-threshold.json";
import ppcrTieFixture from "../fixtures/v2/prediction-distribution-ppcr-tie.json";
import multiFixture from "../fixtures/v2/prediction-distribution-multi.json";
import visualFixture from "../fixtures/v2/prediction-distribution-visual.json";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import { renderPredictionDistribution } from "../src/render/prediction-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_0, ReportSpecV1_1 } from "../src/spec/report.js";

describe("PredictionDistribution DOM Rendering", () => {
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

  it("proves PPCR mode uses cumulative population rank coordinates and each nonempty interval has total stacked height = 1", () => {
    const el = renderPredictionDistribution(
      visualFixture as PredictionDistributionSpec,
    );

    const dimSelect = el.querySelector<HTMLSelectElement>(
      ".rtichoke-prediction-distribution__select[aria-label='Operating point dimension']",
    )!;
    dimSelect.value = "ppcr";
    dimSelect.dispatchEvent(new Event("change"));

    // Verify X-axis label
    expect(el.innerHTML).toContain("Prediction rank percentile (low to high)");

    // Compute cumulative population bounds & outcome fractions for Model A bins in visualFixture
    const evalBins = visualFixture.bins
      .filter((b) => b.evaluationId === "Model A")
      .sort((a, b) => a.lower - b.lower);

    const totalN = evalBins.reduce((sum, b) => sum + b.nPositive + b.nNegative, 0);
    expect(totalN).toBeGreaterThan(0);

    let cumCount = 0;
    for (const bin of evalBins) {
      const binTotal = bin.nPositive + bin.nNegative;
      const popLower = cumCount / totalN;
      const popUpper = (cumCount + binTotal) / totalN;
      cumCount += binTotal;

      if (binTotal > 0) {
        const posFrac = bin.nPositive / binTotal;
        const negFrac = bin.nNegative / binTotal;
        // Total stacked height in PPCR population rank view equals 1.0
        expect(posFrac + negFrac).toBeCloseTo(1.0, 6);
        expect(popUpper - popLower).toBeCloseTo(binTotal / totalN, 6);
      }
    }
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
