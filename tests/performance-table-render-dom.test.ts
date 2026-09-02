import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/performance-table.json" with { type: "json" };
import {
  determineThresholdPrecision,
  format2Decimals,
  formatCount,
  humanizeContextValue,
  renderPerformanceTable,
} from "../src/render/performance-table.js";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import type { PerformanceTableSpec } from "../src/spec/v2/performance-table.js";

function spec(): PerformanceTableSpec {
  return structuredClone(fixture) as PerformanceTableSpec;
}

function render(value: PerformanceTableSpec = spec()): HTMLDivElement {
  const dom = new JSDOM("", { url: "http://localhost/" });
  return renderPerformanceTable(value, dom.window.document);
}

describe("performance table browser renderer parity", () => {
  it("renders 2-tier header with Performance Metrics spanner and primary metric order", () => {
    const root = render();
    const ths = [...root.querySelectorAll("th")].map((node) => node.textContent?.trim());

    expect(ths).toContain("Performance Metrics");
    expect(ths).toContain("Model");
    expect(ths).toContain("Population");
    expect(ths).toContain("Evaluation");
    expect(ths).toContain("Sensitivity");
    expect(ths).toContain("Specificity");
    expect(ths).toContain("PPV");
    expect(ths).toContain("Net Benefit");

    const spanner = root.querySelector(".rtichoke-performance-table__spanner");
    expect(spanner?.textContent).toBe("Performance Metrics");
    expect(spanner?.getAttribute("colspan")).toBe("4");
  });

  it("dynamically shows identity columns based on variation across evaluations", () => {
    const s = spec();
    const root = render(s);
    expect(root.querySelector(".rtichoke-performance-table__model")).not.toBeNull();
    expect(root.querySelector(".rtichoke-performance-table__population")).not.toBeNull();

    const singleEvalSpec: PerformanceTableSpec = {
      schemaVersion: "2.0",
      type: "performance_table",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Pop A" }],
      metrics: [{ id: "sensitivity", label: "Sensitivity" }],
      rows: [{ evaluationId: "eval-1", operatingPoint: { type: "probability_threshold", value: 0.2 }, values: [{ metricId: "sensitivity", estimate: 0.8 }] }]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const singleRoot = renderPerformanceTable(singleEvalSpec, dom.window.document);
    expect(singleRoot.querySelector(".rtichoke-performance-table__model")).toBeNull();
    expect(singleRoot.querySelector(".rtichoke-performance-table__population")).toBeNull();
    expect(singleRoot.querySelector(".rtichoke-performance-table__evaluation")).toBeNull();
  });

  it("renders composite Predicted Positives presentation when operating points use PPCR or count", () => {
    const ppcrSpec: PerformanceTableSpec = {
      schemaVersion: "2.0",
      type: "performance_table",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Pop A" }],
      metrics: [
        { id: "sensitivity", label: "Sensitivity" },
        { id: "predicted_positives", label: "Predicted Positives" },
        { id: "ppcr", label: "PPCR" }
      ],
      rows: [
        {
          evaluationId: "eval-1",
          operatingPoint: { type: "ppcr", value: 0.2 },
          values: [
            { metricId: "sensitivity", estimate: 0.8 },
            { metricId: "predicted_positives", estimate: 123 },
            { metricId: "ppcr", estimate: 0.20 }
          ]
        }
      ]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const root = renderPerformanceTable(ppcrSpec, dom.window.document);
    const opCell = root.querySelector(".rtichoke-performance-table__op");
    expect(opCell?.textContent).toContain("123 (20.00%)");

    const barFill = opCell?.querySelector(".rtichoke-performance-table__bar-fill");
    expect(barFill).not.toBeNull();
    expect(barFill?.classList.contains("rtichoke-performance-table__bar-fill--positive")).toBe(true);
  });

  it("determines threshold precision dynamically to avoid collision", () => {
    expect(determineThresholdPrecision([0.1, 0.2, 0.3])).toBe(2);
    expect(determineThresholdPrecision([0.123, 0.124])).toBe(3);
    expect(determineThresholdPrecision([0.12345, 0.12346])).toBe(5);
  });

  it("formats counts and context strings accurately", () => {
    expect(formatCount(100)).toBe("100");
    expect(formatCount(100.523)).toBe("100.52");
    expect(humanizeContextValue("adjusted_as_negative")).toBe("Adjusted as negative");
  });

  it("renders in-cell quantitative background bars for primary metrics and net benefit", () => {
    const nbSpec: PerformanceTableSpec = {
      schemaVersion: "2.0",
      type: "performance_table",
      evaluations: [{ id: "e1", model: "m1", population: "p1" }, { id: "e2", model: "m2", population: "p1" }],
      metrics: [{ id: "net_benefit", label: "Net Benefit" }, { id: "sensitivity", label: "Sensitivity" }],
      rows: [
        {
          evaluationId: "e1",
          operatingPoint: { type: "probability_threshold", value: 0.1 },
          values: [
            { metricId: "net_benefit", estimate: 0.15 },
            { metricId: "sensitivity", estimate: 0.80 }
          ]
        },
        {
          evaluationId: "e2",
          operatingPoint: { type: "probability_threshold", value: 0.1 },
          values: [
            { metricId: "net_benefit", estimate: -0.05 },
            { metricId: "sensitivity", estimate: 0.70 }
          ]
        }
      ]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const root = renderPerformanceTable(nbSpec, dom.window.document);

    const posNbCell = root.querySelector('tr[data-evaluation-id="e1"] td[data-metric-id="net_benefit"]');
    const negNbCell = root.querySelector('tr[data-evaluation-id="e2"] td[data-metric-id="net_benefit"]');

    expect(posNbCell?.querySelector(".rtichoke-performance-table__bar-fill--positive")).not.toBeNull();
    expect(negNbCell?.querySelector(".rtichoke-performance-table__bar-fill--negative")).not.toBeNull();
  });

  it("preserves data-evaluation-id and data-metric-id DOM attributes", () => {
    const root = render();
    const rows = [...root.querySelectorAll("tbody tr")];
    expect(rows[0].getAttribute("data-evaluation-id")).toBe("eval-model-a-pop-a");

    const sensCell = rows[0].querySelector('[data-metric-id="sensitivity"]');
    expect(sensCell).not.toBeNull();
    expect(sensCell?.textContent).toContain("0.82");
  });

  it("renders correctly inside a ReportSpec document v1.1", () => {
    const dom = new JSDOM("", { url: "http://localhost/" });
    const reportSpec: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      title: "Report Title",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-table",
              title: "Performance Table Component",
              spec: spec()
            }
          ]
        }
      ]
    };
    const reportEl = renderReport(reportSpec, {}, dom.window.document);
    expect(reportEl.querySelector(".rtichoke-performance-table")).not.toBeNull();
    expect(reportEl.querySelector(".rtichoke-performance-table__scroll")).not.toBeNull();
  });

  it("rejects referential-integrity failures before rendering", () => {
    const value = spec();
    value.rows[0].evaluationId = "missing-evaluation";
    expect(() => render(value)).toThrow("unknown evaluation id: missing-evaluation");
  });
});
