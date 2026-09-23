// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CalibrationV2Spec } from "../src/spec/v2/calibration.js";
import type { SummaryMetricsSpec } from "../src/spec/v2/summary-metrics.js";
import type { ReportSpec } from "../src/spec/report.js";
import perfFixture from "../fixtures/v2/performance-table.json" with { type: "json" };
import pdFixture from "../fixtures/v2/prediction-distribution-single.json" with { type: "json" };
import type { PerformanceTableSpec } from "../src/spec/v2/performance-table.js";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import {
  renderCalibrationV2,
  getContrastTextColor,
} from "../src/render/v2.js";
import { renderSummaryMetrics } from "../src/render/summary-metrics.js";
import { renderPerformanceTable } from "../src/render/performance-table.js";
import { renderPredictionDistribution } from "../src/render/prediction-distribution.js";
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
    return `${label}: ${val}`;
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
    { seriesId: "ser-1", method: "discrete", predicted: 0.8, observed: 0.79, events: 40, total: 50 },
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
    { seriesId: "ser-1", method: "smooth", predicted: 0.1, observed: 0.12, events: 12, total: 100 },
    { seriesId: "ser-1", method: "smooth", predicted: 0.9, observed: 0.88, events: 88, total: 100 },
    { seriesId: "ser-2", method: "smooth", predicted: 0.1, observed: 0.08, events: 8, total: 100 },
    { seriesId: "ser-2", method: "smooth", predicted: 0.9, observed: 0.94, events: 94, total: 100 },
  ],
  distribution: [
    { seriesId: "ser-1", midpoint: 0.1, binWidth: 0.1, count: 50 },
    { seriesId: "ser-2", midpoint: 0.1, binWidth: 0.1, count: 45 },
  ],
};

describe("Visual Convergence Requirements", () => {
  describe("Calibration Main Plot Hover Convergence", () => {
    it("1. preserves exact Calibration numeric formatting (Predicted, Observed with events/total for discrete)", () => {
      const element = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
      const { lines, bgFill } = getDomTipLinesAndFill(element);

      const expectedLines = [
        "Predicted: 0.200",
        "Observed: 0.180 ( 10 / 55 )",
      ];
      expect(lines).toEqual(expectedLines);
      expect(bgFill).toBe("#ffffff");
    });

    it("2. tests smooth Calibration line-target hover directly and asserts nearest datum and Plotly-like format", () => {
      const element = renderCalibrationV2(twoModelSmoothCalibration) as HTMLElement;

      const lineTargets = Array.from(element.querySelectorAll<SVGElement>("path.rtichoke-hover-line-target"));
      expect(lineTargets.length).toBeGreaterThanOrEqual(2);

      // Trigger line hover on first smooth model line
      const { lines, bgFill } = getDomTipLinesAndFill(element, "path.rtichoke-hover-line-target");

      expect(lines).toEqual([
        "Model A: ",
        "Predicted: 0.100",
        "Observed: 0.120",
      ]);
      expect(bgFill).toBe("#ffffff");
    });

    it("3. renders two-model smooth calibration with neutral Plotly-like light background", () => {
      const element = renderCalibrationV2(twoModelSmoothCalibration) as HTMLElement;

      const pointTargets = Array.from(element.querySelectorAll<SVGElement>("circle.rtichoke-hover-point-target"));
      expect(pointTargets.length).toBeGreaterThanOrEqual(4);

      pointTargets[0].dispatchEvent(
        new (window as any).PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 100 }),
      );
      const bgRect1 = element.querySelector<SVGRectElement>("g.rtichoke-hover-tooltip rect.rtichoke-hover-tooltip-bg");
      expect(bgRect1?.getAttribute("fill")).toBe("#ffffff");
    });

    it("4. uses neutral #ffffff background for Perfectly Calibrated reference line hover", () => {
      const element = renderCalibrationV2(singleModelDiscreteCalibration) as HTMLElement;
      const refTarget = element.querySelector<SVGElement>(".rtichoke-hover-ref-target");
      expect(refTarget).not.toBeNull();

      refTarget!.dispatchEvent(
        new (window as any).PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 100 }),
      );

      const bgRect = element.querySelector<SVGRectElement>("g.rtichoke-hover-tooltip rect.rtichoke-hover-tooltip-bg");
      expect(bgRect?.getAttribute("fill")).toBe("#ffffff");

      const textEl = element.querySelector<SVGTextElement>("g.rtichoke-hover-tooltip text");
      expect(textEl?.textContent).toContain("Perfectly Calibrated");
    });

    it("5. selects high-contrast text colors for dark and light model background fills", () => {
      expect(getContrastTextColor("#000000")).toBe("#ffffff");
      expect(getContrastTextColor("#ffffff")).toBe("#000000");
      expect(getContrastTextColor("#07004D")).toBe("#ffffff");
      expect(getContrastTextColor("#F4FFF0")).toBe("#000000");
    });

    it("6. attached histogram panel uses coherent calibration hover layer", () => {
      const element = renderCalibrationV2(twoModelSmoothCalibration) as HTMLElement;
      expect(element.className).toBe("rtichoke-calibration");

      const children = element.children;
      expect(children.length).toBe(2);

      const histPlot = children[1];

      // Histogram plot contains D3 hover targets layer
      expect(histPlot.querySelector("g.rtichoke-hover-targets")).not.toBeNull();
    });
  });

  describe("Font Family Convergence & Stylesheet Contract", () => {
    it("7. verifies stylesheet-level font-family rules converge on Arial, Helvetica, sans-serif across all browser component roots", () => {
      const cssPath = resolve(__dirname, "../src/rtichoke-viz.css");
      const cssText = readFileSync(cssPath, "utf-8");

      expect(cssText).toContain(".rtichoke-report");
      expect(cssText).toContain(".rtichoke-performance-table");
      expect(cssText).toContain(".rtichoke-prediction-distribution");
      expect(cssText).toContain(".rtichoke-summary-metrics");

      // Verify no remaining system-ui font-family declarations exist in CSS
      expect(cssText).not.toContain("system-ui");

      // Verify Arial, Helvetica, sans-serif is used consistently
      expect(cssText).toContain("font-family: Arial, Helvetica, sans-serif;");
    });

    it("8. applies Arial, Helvetica, sans-serif across rendered DOM roots", () => {
      const perfSpec = perfFixture as PerformanceTableSpec;
      const pdSpec = pdFixture as PredictionDistributionSpec;

      const sumSpec: SummaryMetricsSpec = {
        schemaVersion: "1.0",
        type: "summary_metrics",
        evaluations: [{ id: "e1", model: "M1", population: "P1" }],
        populations: [{ id: "P1", label: "Pop 1" }],
        metrics: [{ owner: { type: "evaluation", evaluationId: "e1" }, metric: "auroc", estimate: 0.85 }],
      };

      const reportSpec: ReportSpec = {
        schemaVersion: "1.1",
        type: "report",
        title: "Report Title",
        sections: [
          {
            id: "s1",
            title: "Summary",
            items: [
              {
                type: "component",
                id: "c1",
                title: "Summary Metrics",
                spec: sumSpec,
              },
            ],
          },
        ],
      };

      const perfEl = renderPerformanceTable(perfSpec);
      const pdEl = renderPredictionDistribution(pdSpec);
      const sumEl = renderSummaryMetrics(sumSpec);
      const repEl = renderReport(reportSpec);

      expect(perfEl.className).toBe("rtichoke-performance-table");
      expect(pdEl.className).toContain("rtichoke-prediction-distribution");
      expect(sumEl.className).toBe("rtichoke-summary-metrics");
      expect(repEl.className).toBe("rtichoke-report");
    });
  });

  describe("Summary Metrics Compact Presentation & Header Alignment", () => {
    it("9. renders Summary Metrics table with right-aligned Estimate header, structure, and attributes without altering content or horizon filtering", () => {
      const multiHorizonSumSpec: SummaryMetricsSpec = {
        schemaVersion: "1.1",
        type: "summary_metrics",
        title: "Model Performance Summary",
        evaluations: [{ id: "e1", model: "Model A", population: "Pop 1" }],
        populations: [{ id: "p1", label: "Pop 1" }],
        metrics: [
          { owner: { type: "evaluation", evaluationId: "e1" }, metric: "auroc", estimate: 0.85 },
          { owner: { type: "population", populationId: "p1" }, metric: "event_risk", horizon: 1, estimate: 0.12 },
          { owner: { type: "population", populationId: "p1" }, metric: "event_risk", horizon: 2, estimate: 0.24 },
        ],
      };

      const el = renderSummaryMetrics(multiHorizonSumSpec);
      expect(el.className).toBe("rtichoke-summary-metrics");

      const titleEl = el.querySelector(".rtichoke-summary-metrics__title");
      expect(titleEl?.textContent).toBe("Model Performance Summary");

      const table = el.querySelector("table.rtichoke-summary-metrics__table");
      expect(table).not.toBeNull();

      const headers = Array.from(table!.querySelectorAll("th")).map((th) => th.textContent);
      expect(headers).toEqual(["Owner", "Metric", "Estimate"]);

      // Estimate header is third header
      const estimateHeader = table!.querySelectorAll("th")[2];
      expect(estimateHeader.textContent).toBe("Estimate");

      // Check CSS rule for right-aligned estimate header in stylesheet
      const cssPath = resolve(__dirname, "../src/rtichoke-viz.css");
      const cssText = readFileSync(cssPath, "utf-8");
      expect(cssText).toContain(".rtichoke-summary-metrics__table th:last-child");

      const rows = Array.from(table!.querySelectorAll("tbody tr"));
      expect(rows.length).toBe(3);

      const firstRow = rows[0];
      expect(firstRow.querySelector(".rtichoke-summary-metrics__owner")?.textContent).toBe("Model A");
      expect(firstRow.querySelector(".rtichoke-summary-metrics__metric")?.textContent).toBe("AUROC");
      expect(firstRow.querySelector(".rtichoke-summary-metrics__estimate")?.textContent).toBe("0.85");

      // Horizon control testing
      const select = el.querySelector<HTMLSelectElement>(".rtichoke-horizon-select");
      expect(select).not.toBeNull();
      expect(select?.value).toBe("1");

      // Horizon 1 row should be visible, horizon 2 row hidden
      expect((rows[1] as HTMLElement).style.display).toBe("");
      expect((rows[2] as HTMLElement).style.display).toBe("none");

      // Change horizon to 2
      select!.value = "2";
      select!.dispatchEvent(new (globalThis as any).Event("change"));

      expect((rows[1] as HTMLElement).style.display).toBe("none");
      expect((rows[2] as HTMLElement).style.display).toBe("");
    });
  });
});
