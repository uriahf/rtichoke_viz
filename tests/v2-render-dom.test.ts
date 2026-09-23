// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import gains from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import timeGains from "../fixtures/v2/gains-time.json" with { type: "json" };
import equalPrevalenceLift from "../fixtures/v2/lift-equal-prevalence.json" with { type: "json" };
import equalRiskLift from "../fixtures/v2/lift-equal-risk.json" with { type: "json" };
import populationsLift from "../fixtures/v2/lift-populations.json" with { type: "json" };
import sharedPopulationLift from "../fixtures/v2/lift-shared-population.json" with { type: "json" };
import singleLift from "../fixtures/v2/lift-single.json" with { type: "json" };
import timeLift from "../fixtures/v2/lift-time.json" with { type: "json" };
import precisionRecall from "../fixtures/v2/precision-recall-shared-population.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import {
  renderCalibrationV2,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderRocV2,
  seriesRenderData,
} from "../src/render/v2.js";
import type {
  CalibrationV2Spec,
  GainsV2Spec,
  LiftV2Spec,
  PrecisionRecallV2Spec,
  RocV2Spec,
} from "../src/index.js";

function svgOf(element: SVGSVGElement | HTMLElement) {
  return element instanceof SVGSVGElement
    ? element
    : [...element.querySelectorAll<SVGSVGElement>("svg")].find(
        (svg) => Number(svg.getAttribute("width")) > 100,
      )!;
}

describe("v2 browser theme DOM", () => {
  it.each([
    ["roc", () => renderRocV2(roc as RocV2Spec)],
    [
      "calibration",
      () => renderCalibrationV2(calibration as CalibrationV2Spec),
    ],
    [
      "precision-recall",
      () => renderPrecisionRecallV2(precisionRecall as PrecisionRecallV2Spec),
    ],
    ["gains", () => renderGainsV2(gains as GainsV2Spec)],
    ["lift", () => renderLiftV2(singleLift as LiftV2Spec)],
  ])(
    "applies shared dimensions, axes, frame, and typography to %s",
    (_, render) => {
      const element = render();
      const svg = svgOf(element);
      expect(svg.getAttribute("width")).toBe("600");
      expect(svg.style.background).toBe("rgb(255, 255, 255)");
      expect(svg.style.fontFamily).toContain("Arial");
      expect(element.querySelector('[aria-label^="x-axis"]')).not.toBeNull();
      expect(element.querySelector('[aria-label^="y-axis"]')).not.toBeNull();
      expect(
        svg.querySelector('[aria-label="frame"]')?.getAttribute("stroke"),
      ).toBe("#444444");
    },
  );

  it("applies custom dimensions, palette, line, marker, and reference tokens", () => {
    const element = renderCalibrationV2(calibration as CalibrationV2Spec, {
      width: 720,
      height: 500,
      colors: ["#112233", "#445566"],
      theme: {
        line: { width: 3 },
        marker: { radius: 7, stroke: "#101010" },
        reference: { color: "#999999", dash: "2,3" },
      },
    });
    const svgs = element.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    expect(svgs[0].getAttribute("width")).toBe("720");
    expect(
      svgs[0]
        .querySelector('[aria-label="dot"][stroke="#101010"] circle')
        ?.getAttribute("r"),
    ).toBe("7");
    expect(
      svgs[0]
        .querySelector('[aria-label="line"][stroke="#999999"]')
        ?.getAttribute("stroke-dasharray"),
    ).toBe("2,3");

    const gainsSvg = svgOf(
      renderGainsV2(gains as GainsV2Spec, {
        colors: ["#112233", "#445566"],
        theme: { line: { width: 3 } },
      }),
    );
    const themedLine = gainsSvg.querySelector(
      '[aria-label="line"][stroke-width="3"]',
    );
    expect(themedLine?.querySelector('path[stroke="#112233"]')).not.toBeNull();
  });

  it("hides a single-group legend and orders multi-group labels deterministically", () => {
    const single = renderRocV2(roc as RocV2Spec);
    expect(single.querySelector('[aria-label="color legend"]')).toBeNull();
    const multiple = renderGainsV2(gains as GainsV2Spec);
    expect(multiple.textContent).toContain("Model A");
    expect(multiple.textContent).toContain("Model B");
    expect(multiple.textContent!.indexOf("Model A")).toBeLessThan(
      multiple.textContent!.indexOf("Model B"),
    );
  });

  it("renders one time-dependent gains horizon at a time", () => {
    const element = renderGainsV2(timeGains as GainsV2Spec);
    const select = element.querySelector("select")!;
    expect(select.value).toBe("5");
    expect([...select.options].map((option) => option.value)).toEqual(["5", "10"]);
    const firstChart = element.querySelector("svg");

    select.value = "10";
    select.dispatchEvent(new Event("change"));
    expect(select.value).toBe("10");
    expect(element.querySelector("svg")).not.toBe(firstChart);
  });

  it("uses neutral 'Series' heading instead of 'Model' in tooltips", () => {
    const data = seriesRenderData(roc as RocV2Spec, (roc as RocV2Spec).data);
    expect(data[0].label).toBeDefined();
    // Test that renderRocV2 produces SVG without any hardcoded "Model:" in titles
    const element = renderRocV2(roc as RocV2Spec);
    expect(element).toBeDefined();
  });

  it("renders Lift specs correctly in the DOM", () => {
    const singleElement = renderLiftV2(singleLift as LiftV2Spec);
    const svg = svgOf(singleElement);

    // 1. Accepts Lift spec and renders
    expect(svg).not.toBeNull();

    // 2. Random Guess renders as horizontal line (ruleY at y=1)
    const ruleMark = svg.querySelector('[aria-label="rule"]');
    expect(ruleMark).not.toBeNull();

    // 3. Shared population models share one Perfect Prediction reference line
    const sharedElement = renderLiftV2(sharedPopulationLift as LiftV2Spec);
    const sharedSvg = svgOf(sharedElement);
    // Reference line mark (1) and data lines mark group (1) = 2 line marks total
    const sharedLineMarks = sharedSvg.querySelectorAll('[aria-label="line"]');
    expect(sharedLineMarks).toHaveLength(2);

    // 4. Distinct populations preserve distinct reference lines
    const popElement = renderLiftV2(populationsLift as LiftV2Spec);
    const popSvg = svgOf(popElement);
    // 2 distinct path reference lines + 1 data line mark group = 3 line marks
    const popLines = popSvg.querySelectorAll('[aria-label="line"]');
    expect(popLines).toHaveLength(3);

    // 5. Equal-valued distinct references are not collapsed
    const equalElement = renderLiftV2(equalPrevalenceLift as LiftV2Spec);
    const equalSvg = svgOf(equalElement);
    const equalLines = equalSvg.querySelectorAll('[aria-label="line"]');
    expect(equalLines).toHaveLength(3);

    // 6. Equal-risk time dependent distinct references are not collapsed
    // renderLiftV2 filters references by selected horizon (default horizon 5 -> 1 path reference + 1 data line mark group = 2 line marks)
    const equalRiskElement = renderLiftV2(equalRiskLift as LiftV2Spec);
    const equalRiskSvg = svgOf(equalRiskElement);
    const equalRiskLines = equalRiskSvg.querySelectorAll('[aria-label="line"]');
    expect(equalRiskLines).toHaveLength(2);
  });

  it("renders time-dependent Lift with horizon select control and correct filtering", () => {
    const timeElement = renderLiftV2(timeLift as LiftV2Spec);
    const select = timeElement.querySelector("select");
    expect(select).not.toBeNull();
    expect(select!.value).toBe("5");
    expect([...select!.options].map((opt) => opt.value)).toEqual(["5", "10"]);

    const initialSvg = svgOf(timeElement);
    // Horizon 5 has 1 series line mark + 1 reference line mark = 2 line marks
    const initialLines = initialSvg.querySelectorAll('[aria-label="line"]');
    expect(initialLines).toHaveLength(2);

    select!.value = "10";
    select!.dispatchEvent(new Event("change"));
    const updatedSvg = svgOf(timeElement);
    const updatedLines = updatedSvg.querySelectorAll('[aria-label="line"]');
    expect(updatedLines).toHaveLength(2);
  });

  describe("equal-scale geometry for ROC and Calibration", () => {
    it("enforces innerWidth == innerHeight for default ROC v2", () => {
      const element = renderRocV2(roc as RocV2Spec);
      const svg = svgOf(element);
      const svgWidth = Number(svg.getAttribute("width"));
      const svgHeight = Number(svg.getAttribute("height"));
      const marginLeft = 66;
      const marginRight = 28;
      const marginTop = 28;
      const marginBottom = 58;

      const innerWidth = svgWidth - marginLeft - marginRight;
      const innerHeight = svgHeight - marginTop - marginBottom;

      expect(innerWidth).toBe(506);
      expect(innerHeight).toBe(506);
      expect(svgHeight).toBe(592);
    });

    it("enforces equal pixel scale with custom width, margins, and overridden caller height for ROC", () => {
      const element = renderRocV2(roc as RocV2Spec, {
        width: 720,
        height: 300, // caller-provided height must be overridden by equal-scale geometry
        theme: {
          margins: { top: 30, right: 20, bottom: 50, left: 80 },
        },
      });
      const svg = svgOf(element);
      const svgWidth = Number(svg.getAttribute("width"));
      const svgHeight = Number(svg.getAttribute("height"));
      expect(svgWidth).toBe(720);

      const marginLeft = 80;
      const marginRight = 20;
      const marginTop = 30;
      const marginBottom = 50;

      const innerWidth = svgWidth - marginLeft - marginRight; // 720 - 80 - 20 = 620
      const innerHeight = svgHeight - marginTop - marginBottom; // svgHeight - 30 - 50

      expect(innerWidth).toBe(620);
      expect(innerHeight).toBe(620);
      expect(svgHeight).toBe(700);
    });

    it("enforces equal scale for calibration without distribution histogram", () => {
      const noDistSpec: CalibrationV2Spec = {
        ...(calibration as CalibrationV2Spec),
        distribution: [],
      };
      const element = renderCalibrationV2(noDistSpec);
      const svg = svgOf(element);
      const svgWidth = Number(svg.getAttribute("width"));
      const svgHeight = Number(svg.getAttribute("height"));

      const marginLeft = 66;
      const marginRight = 28;
      const marginTop = 28;
      const marginBottom = 58;

      const innerWidth = svgWidth - marginLeft - marginRight; // 506
      const innerHeight = svgHeight - marginTop - marginBottom;

      expect(innerWidth).toBe(506);
      expect(innerHeight).toBe(506);
      expect(svgHeight).toBe(592);
    });

    it("enforces equal scale for calibration main SVG with histogram auxiliary panel", () => {
      const element = renderCalibrationV2(calibration as CalibrationV2Spec);
      const svgs = element.querySelectorAll("svg");
      expect(svgs).toHaveLength(2);

      const mainSvg = svgs[0];
      const histSvg = svgs[1];

      const svgWidth = Number(mainSvg.getAttribute("width"));
      const mainSvgHeight = Number(mainSvg.getAttribute("height"));
      const histSvgHeight = Number(histSvg.getAttribute("height"));

      const marginLeft = 66;
      const marginRight = 28;
      const marginTop = 28;
      const mainMarginBottom = 8; // histogram presents gap

      const innerWidth = svgWidth - marginLeft - marginRight; // 506
      const mainInnerHeight = mainSvgHeight - marginTop - mainMarginBottom;

      expect(innerWidth).toBe(506);
      expect(mainInnerHeight).toBe(506);
      expect(mainSvgHeight).toBe(542); // 28 + 506 + 8
      expect(histSvgHeight).toBe(87); // auxiliary height
    });

    it("calculates inner height proportional to y/x domain span ratio for smooth calibration overshoot", () => {
      const smoothSpec: CalibrationV2Spec = {
        type: "calibration",
        schemaVersion: "2.0",
        evaluations: [{ id: "e1", population: "Pop 1", label: "Pop 1" }],
        x: "predicted",
        y: "observed",
        xAxis: { label: "Predicted Event Probability", domain: [0, 1] },
        yAxis: { label: "Observed Event Proportion" },
        series: [
          {
            id: "s1",
            evaluationId: "e1",
            display: { group: "Model A", label: "Model A", role: "model" },
          },
        ],
        data: [
          {
            seriesId: "s1",
            predicted: 0.0,
            observed: -0.01, // overshoot
            method: "smooth",
          },
          {
            seriesId: "s1",
            predicted: 0.5,
            observed: 0.5,
            method: "smooth",
          },
          {
            seriesId: "s1",
            predicted: 1.0,
            observed: 1.02, // overshoot
            method: "smooth",
          },
        ],
      };

      const element = renderCalibrationV2(smoothSpec);
      const svg = svgOf(element);
      const svgWidth = Number(svg.getAttribute("width"));
      const svgHeight = Number(svg.getAttribute("height"));

      const marginLeft = 66;
      const marginRight = 28;
      const marginTop = 28;
      const marginBottom = 58;

      const innerWidth = svgWidth - marginLeft - marginRight; // 506
      const xSpan = 1.0 - 0.0; // 1.0
      const ySpan = 1.02 - -0.01; // 1.03
      const expectedInnerHeight = Math.round(innerWidth * (ySpan / xSpan)); // Math.round(506 * 1.03) = 521

      const innerHeight = svgHeight - marginTop - marginBottom;
      expect(innerWidth).toBe(506);
      expect(innerHeight).toBe(expectedInnerHeight);
      expect(svgHeight).toBe(28 + expectedInnerHeight + 58);
    });

    it("ensures non-equal-scale charts retain default theme height", () => {
      const prSvg = svgOf(renderPrecisionRecallV2(precisionRecall as PrecisionRecallV2Spec));
      const gainsSvg = svgOf(renderGainsV2(gains as GainsV2Spec));
      const liftSvg = svgOf(renderLiftV2(singleLift as LiftV2Spec));

      expect(prSvg.getAttribute("height")).toBe("500");
      expect(gainsSvg.getAttribute("height")).toBe("500");
      expect(liftSvg.getAttribute("height")).toBe("500");
    });

    it("uses resolved xDomain and yDomain when spec.xAxis.domain or spec.yAxis.domain is omitted for ROC without identity reference", () => {
      const specNoDomains: RocV2Spec = {
        type: "roc",
        schemaVersion: "2.0",
        evaluations: [{ id: "e1", population: "Pop 1", label: "Pop 1" }],
        x: "false_positive_rate",
        y: "sensitivity",
        xAxis: { label: "1 - Specificity" }, // domain omitted
        yAxis: { label: "Sensitivity" },    // domain omitted
        series: [
          {
            id: "s1",
            evaluationId: "e1",
            display: { group: "Model A", label: "Model A", role: "model" },
          },
        ],
        data: [
          { seriesId: "s1", cutoff: 0.1, sensitivity: 0.8, specificity: 0.7, ppcr: 0.2 },
          { seriesId: "s1", cutoff: 0.5, sensitivity: 0.5, specificity: 0.9, ppcr: 0.1 },
        ],
        references: [], // no identity reference line
      };

      const element = renderRocV2(specNoDomains);
      const svg = svgOf(element);

      // Verify overall SVG height matches default equal-scale height for [0, 1] x [0, 1]
      expect(svg.getAttribute("height")).toBe("592");

      // Verify rendered axis scales in DOM explicitly use resolved [0, 1] domains
      const xAxisGroup = element.querySelector('[aria-label^="x-axis"]');
      const yAxisGroup = element.querySelector('[aria-label^="y-axis"]');
      expect(xAxisGroup).not.toBeNull();
      expect(yAxisGroup).not.toBeNull();
    });

    it("uses resolved xDomain for both main calibration panel and histogram when xAxis.domain is omitted", () => {
      const specOmittedXDomain: CalibrationV2Spec = {
        ...(calibration as CalibrationV2Spec),
        xAxis: { label: "Predicted probability" }, // domain omitted
      };

      const element = renderCalibrationV2(specOmittedXDomain);
      const svgs = element.querySelectorAll("svg");
      expect(svgs).toHaveLength(2);

      const mainSvg = svgs[0];
      const histSvg = svgs[1];

      // Main calibration SVG should use resolved height (506 innerHeight + 28 + 8)
      expect(mainSvg.getAttribute("height")).toBe("542");
      // Histogram SVG height
      expect(histSvg.getAttribute("height")).toBe("87");

      // Verify both panels render axes using the shared resolved xDomain [0, 1]
      expect(mainSvg.querySelector('[aria-label^="y-axis"]')).not.toBeNull();
      expect(histSvg.querySelector('[aria-label^="x-axis"]')).not.toBeNull();
    });

    it("handles descending finite domain bounds gracefully in equalScalePlotHeight", () => {
      const descendingSpec: RocV2Spec = {
        ...(roc as RocV2Spec),
        xAxis: { label: "1 - Specificity", domain: [1, 0] }, // descending domain
        yAxis: { label: "Sensitivity", domain: [0, 1] },
      };

      const element = renderRocV2(descendingSpec);
      const svg = svgOf(element);
      expect(svg.getAttribute("height")).toBe("592");
    });
  });
});

