// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import thresholdFixture from "../fixtures/v2/prediction-distribution-threshold.json";
import ppcrTieFixture from "../fixtures/v2/prediction-distribution-ppcr-tie.json";
import multiFixture from "../fixtures/v2/prediction-distribution-multi.json";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import { renderPredictionDistribution } from "../src/render/prediction-distribution.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_0 } from "../src/spec/report.js";

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

  it("renders multi-evaluation spec with evaluation switcher control", () => {
    const el = renderPredictionDistribution(
      multiFixture as PredictionDistributionSpec,
    );

    const evalSelect = el.querySelector<HTMLSelectElement>(
      ".rtichoke-prediction-distribution__select[aria-label='Evaluation']",
    );
    expect(evalSelect).not.toBeNull();
    expect(evalSelect?.options.length).toBe(2);

    // Switch to Model B
    evalSelect!.value = "Model B";
    evalSelect!.dispatchEvent(new Event("change"));

    expect(el.querySelector(".rtichoke-prediction-distribution__summary")?.textContent).toContain("Cutoff");
  });

  it("renders inside ReportSpec v1.0 component wrapper", () => {
    const reportSpec: ReportSpecV1_0 = {
      schemaVersion: "1.0",
      type: "report",
      title: "Prediction Distribution Report",
      components: [
        {
          id: "pred-dist-comp",
          title: "Prediction Score Distribution",
          spec: thresholdFixture as PredictionDistributionSpec,
        },
      ],
    };

    const reportEl = renderReport(reportSpec);
    expect(reportEl).toBeInstanceOf(HTMLElement);

    const compContent = reportEl.querySelector(
      "[data-component-id='pred-dist-comp']",
    );
    expect(compContent).not.toBeNull();
    expect(compContent?.querySelector(".rtichoke-prediction-distribution")).not.toBeNull();
  });
});
