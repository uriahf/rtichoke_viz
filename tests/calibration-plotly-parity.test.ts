// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { CalibrationV2Spec } from "../src/spec/v2/calibration.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import { renderCalibrationV2 } from "../src/render/v2.js";
import { renderReport } from "../src/render/report.js";

if (typeof SVGElement !== "undefined") {
  const polyfillBBox = () => ({ x: 0, y: 0, width: 100, height: 20 });
  if (!(SVGElement.prototype as any).getBBox) (SVGElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGGElement !== "undefined" && !(SVGGElement.prototype as any).getBBox) (SVGGElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGTextElement !== "undefined" && !(SVGTextElement.prototype as any).getBBox) (SVGTextElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGPathElement !== "undefined" && !(SVGPathElement.prototype as any).getBBox) (SVGPathElement.prototype as any).getBBox = polyfillBBox;
}

function getDomTipLinesAndFill(element: HTMLElement | SVGSVGElement, selector = "circle.rtichoke-hover-point-target"): { lines: string[]; bgFill: string | null } {
  const target = element.querySelector<SVGElement>(selector);
  if (!target) return { lines: [], bgFill: null };

  target.dispatchEvent(
    new (window as any).PointerEvent("pointermove", {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );

  const bgRect = element.querySelector<SVGRectElement>("g.rtichoke-hover-tooltip rect.rtichoke-hover-tooltip-bg");
  const bgFill = bgRect ? bgRect.getAttribute("fill") : null;

  const textEl = element.querySelector<SVGTextElement>("g.rtichoke-hover-tooltip text");
  if (!textEl) return { lines: [], bgFill };

  const topTspans = Array.from(textEl.children).filter(
    (el) => el.tagName.toLowerCase() === "tspan",
  );

  const lines = topTspans.map((ts) => {
    const bold = ts.querySelector('tspan[font-weight="bold"]');
    const label = bold ? bold.textContent?.replace(":", "").trim() ?? "" : "";
    const fullText = (ts.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    const val = fullText.slice((bold?.textContent ?? "").length).trim();
    if (label && val) return `${label}: ${val}`;
    if (label) return label;
    return val;
  });

  return { lines, bgFill };
}

const singleModelDiscreteCalibration: CalibrationV2Spec = {
  schemaVersion: "2.0",
  type: "calibration",
  evaluations: [{ id: "eval-1", model: "Model A", population: "Pop 1" }],
  series: [
    {
      id: "ser-1",
      evaluationId: "eval-1",
      display: { label: "Model A", group: "Model A", role: "model" },
    },
  ],
  xAxis: { label: "Predicted Probability", domain: [0, 1] },
  yAxis: { label: "Observed Proportion", domain: [0, 1] },
  x: "predicted",
  y: "observed",
  references: [{ type: "identity", scope: "global", label: "Identity" }],
  data: [
    { seriesId: "ser-1", method: "discrete", predicted: 0.2, observed: 0.18, events: 10, total: 55 },
    { seriesId: "ser-1", method: "discrete", predicted: 0.5, observed: 0.52, events: 26, total: 50 },
  ],
  distribution: [
    { seriesId: "ser-1", midpoint: 0.005, binWidth: 0.01, count: 15 },
    { seriesId: "ser-1", midpoint: 0.015, binWidth: 0.01, count: 22 },
  ],
};

const twoModelSmoothCalibration: CalibrationV2Spec = {
  schemaVersion: "2.0",
  type: "calibration",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1" },
    { id: "eval-2", model: "Model B", population: "Pop 1" },
  ],
  series: [
    {
      id: "ser-1",
      evaluationId: "eval-1",
      display: { label: "Model A", group: "Model A", role: "model" },
    },
    {
      id: "ser-2",
      evaluationId: "eval-2",
      display: { label: "Model B", group: "Model B", role: "model" },
    },
  ],
  xAxis: { label: "Predicted Probability", domain: [0, 1] },
  yAxis: { label: "Observed Proportion", domain: [0, 1] },
  x: "predicted",
  y: "observed",
  references: [{ type: "identity", scope: "global", label: "Identity" }],
  data: [
    { seriesId: "ser-1", method: "smooth", predicted: 0.1, observed: 0.12 },
    { seriesId: "ser-2", method: "smooth", predicted: 0.1, observed: 0.08 },
  ],
};

describe("Calibration Plotly Parity Tests", () => {
  it("A. Equal-scale regression & standalone width preserved at 600", () => {
    const el = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
    expect(el.className).toBe("rtichoke-calibration");
    expect(el.style.width).toBe("600px");

    const svgs = el.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const mainSvg = svgs[0];
    const histSvg = svgs[1];

    expect(mainSvg.getAttribute("width")).toBe("600");
    expect(histSvg.getAttribute("width")).toBe("600");
  });

  it("B. Calibration footprint inside report targets ~550x550 outer composition", () => {
    const reportSpec: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      title: "Test Report",
      sections: [
        {
          id: "sec-1",
          title: "Calibration Section",
          items: [
            {
              type: "component",
              id: "comp-1",
              title: "Calibration Chart",
              spec: singleModelDiscreteCalibration,
            },
          ],
        },
      ],
    };

    const root = renderReport(reportSpec);
    const calContainer = root.querySelector<HTMLElement>(".rtichoke-calibration");
    expect(calContainer).not.toBeNull();
    expect(calContainer!.style.width).toBe("550px");

    const svgs = calContainer!.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const mainSvg = svgs[0];
    const histSvg = svgs[1];

    expect(mainSvg.getAttribute("width")).toBe("550");
    expect(histSvg.getAttribute("width")).toBe("550");

    const mainHeight = Number(mainSvg.getAttribute("height"));
    const histHeight = Number(histSvg.getAttribute("height"));
    expect(mainHeight + histHeight).toBe(550);
  });

  it("C. Explicit non-[0,1] domain is respected across upper plot and histogram", () => {
    const restrictedSpec: CalibrationV2Spec = {
      ...singleModelDiscreteCalibration,
      xAxis: { label: "Restricted Prob", domain: [0.1, 0.9] },
      yAxis: { label: "Restricted Prop", domain: [0.1, 0.9] },
    };

    const el = renderCalibrationV2(restrictedSpec) as HTMLElement;
    const svgs = el.querySelectorAll("svg");
    expect(svgs.length).toBe(2);

    expect(svgs[0].getAttribute("width")).toBe("600");
    expect(svgs[1].getAttribute("width")).toBe("600");
  });

  it("D. Discrete tooltip content follows Plotly semantic form without header for single evaluation", () => {
    const el = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
    const { lines, bgFill } = getDomTipLinesAndFill(el);

    expect(lines).toEqual([
      "Predicted: 0.200",
      "Observed: 0.180 ( 10 / 55 )",
    ]);
    expect(bgFill).toBe("#ffffff");
  });

  it("E. Smooth tooltip content follows Plotly semantic form without Events/Total", () => {
    const el = renderCalibrationV2(twoModelSmoothCalibration) as HTMLElement;
    const { lines, bgFill } = getDomTipLinesAndFill(el, "circle.rtichoke-hover-point-target");

    expect(lines).toEqual([
      "Model A",
      "Predicted: 0.100",
      "Observed: 0.120",
    ]);
    expect(bgFill).toBe("#ffffff");
  });

  it("F. Perfect Calibration tooltip presents 'Perfectly Calibrated' header with coordinates", () => {
    const el = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
    const refTarget = el.querySelector<SVGElement>(".rtichoke-hover-ref-target");
    expect(refTarget).not.toBeNull();

    refTarget!.dispatchEvent(
      new (window as any).PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 100 }),
    );

    const textEl = el.querySelector<SVGTextElement>("g.rtichoke-hover-tooltip text");
    expect(textEl?.textContent).toContain("Perfectly Calibrated");
    expect(textEl?.textContent).toContain("Predicted:");
    expect(textEl?.textContent).toContain("Observed:");
  });

  it("G. Histogram tooltip uses conventional bin interval notation [0, upper] and ( lower , upper ]", () => {
    const el = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
    const histTargets = el.querySelectorAll<SVGElement>("rect.rtichoke-hover-hist-target");
    expect(histTargets.length).toBe(2);

    // First bin (includes 0)
    histTargets[0].dispatchEvent(
      new (window as any).PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 100 }),
    );
    let textEl = el.querySelectorAll("g.rtichoke-hover-tooltip text")[1];
    expect(textEl?.textContent).toContain("15 observations in [0,0.010]");

    // Second bin
    histTargets[1].dispatchEvent(
      new (window as any).PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 100 }),
    );
    textEl = el.querySelectorAll("g.rtichoke-hover-tooltip text")[1];
    expect(textEl?.textContent).toContain("22 observations in ( 0.010 , 0.020 ]");
  });
});
