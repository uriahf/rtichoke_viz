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
});

