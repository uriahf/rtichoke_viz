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

  it("renders threshold AND composite Predicted Positives when available", () => {
    const threshWithPredPosSpec: PerformanceTableSpec = {
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
          operatingPoint: { type: "probability_threshold", value: 0.25 },
          values: [
            { metricId: "sensitivity", estimate: 0.8 },
            { metricId: "predicted_positives", estimate: 123 },
            { metricId: "ppcr", estimate: 0.20 }
          ]
        }
      ]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const root = renderPerformanceTable(threshWithPredPosSpec, dom.window.document);
    const ths = [...root.querySelectorAll("th")].map((node) => node.textContent?.trim());

    expect(ths).toContain("Probability Threshold");
    expect(ths).toContain("Predicted Positives");

    const tds = [...root.querySelectorAll("tbody tr td")].map((node) => node.textContent?.trim());
    expect(tds).toContain("0.25");
    expect(tds).toContain("123 (20.00%)");

    // Predicted Positives bar fill should be neutral grey
    const opCells = root.querySelectorAll(".rtichoke-performance-table__op");
    const predPosCell = opCells[1]; // Second op cell is Predicted Positives
    const barFill = predPosCell?.querySelector(".rtichoke-performance-table__bar-fill");
    expect(barFill?.classList.contains("rtichoke-performance-table__bar-fill--neutral")).toBe(true);
  });

  it("falls back to dedicated PPCR column when composite supporting values are missing in PPCR table", () => {
    const ppcrMissingCompositeSpec: PerformanceTableSpec = {
      schemaVersion: "2.0",
      type: "performance_table",
      evaluations: [{ id: "eval-1", model: "Model A", population: "Pop A" }],
      metrics: [
        { id: "sensitivity", label: "Sensitivity" }
      ],
      rows: [
        {
          evaluationId: "eval-1",
          operatingPoint: { type: "ppcr", value: 0.20 },
          values: [
            { metricId: "sensitivity", estimate: 0.8 }
          ]
        }
      ]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const root = renderPerformanceTable(ppcrMissingCompositeSpec, dom.window.document);
    const ths = [...root.querySelectorAll("th")].map((node) => node.textContent?.trim());

    expect(ths).toContain("PPCR");
    expect(ths).not.toContain("Predicted Positives");

    const opCell = root.querySelector(".rtichoke-performance-table__op");
    expect(opCell?.textContent).toBe("PPCR 0.20");

    const barFill = opCell?.querySelector(".rtichoke-performance-table__bar-fill");
    expect(barFill?.classList.contains("rtichoke-performance-table__bar-fill--neutral")).toBe(true);
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

  it("renders in-cell quantitative background bars for primary metrics, net benefit, and neutral metrics with appropriate modifier classes", () => {
    const nbSpec: PerformanceTableSpec = {
      schemaVersion: "2.0",
      type: "performance_table",
      evaluations: [{ id: "e1", model: "m1", population: "p1" }, { id: "e2", model: "m2", population: "p1" }],
      metrics: [
        { id: "net_benefit", label: "Net Benefit" },
        { id: "sensitivity", label: "Sensitivity" },
        { id: "predicted_positives", label: "Predicted Positives" },
        { id: "ppcr", label: "PPCR" }
      ],
      rows: [
        {
          evaluationId: "e1",
          operatingPoint: { type: "probability_threshold", value: 0.1 },
          values: [
            { metricId: "net_benefit", estimate: 0.15 },
            { metricId: "sensitivity", estimate: 0.80 },
            { metricId: "predicted_positives", estimate: 100 },
            { metricId: "ppcr", estimate: 0.25 }
          ]
        },
        {
          evaluationId: "e2",
          operatingPoint: { type: "probability_threshold", value: 0.1 },
          values: [
            { metricId: "net_benefit", estimate: -0.05 },
            { metricId: "sensitivity", estimate: 0.70 },
            { metricId: "predicted_positives", estimate: 50 },
            { metricId: "ppcr", estimate: 0.12 }
          ]
        }
      ]
    };
    const dom = new JSDOM("", { url: "http://localhost/" });
    const root = renderPerformanceTable(nbSpec, dom.window.document);

    const posNbCell = root.querySelector('tr[data-evaluation-id="e1"] td[data-metric-id="net_benefit"]');
    const posSensCell = root.querySelector('tr[data-evaluation-id="e1"] td[data-metric-id="sensitivity"]');
    const negNbCell = root.querySelector('tr[data-evaluation-id="e2"] td[data-metric-id="net_benefit"]');

    const posBar = posSensCell?.querySelector(".rtichoke-performance-table__bar-fill") as HTMLElement;
    const posNbBar = posNbCell?.querySelector(".rtichoke-performance-table__bar-fill") as HTMLElement;
    const negNbBar = negNbCell?.querySelector(".rtichoke-performance-table__bar-fill") as HTMLElement;

    expect(posBar?.classList.contains("rtichoke-performance-table__bar-fill--positive")).toBe(true);
    expect(posNbBar?.classList.contains("rtichoke-performance-table__bar-fill--positive")).toBe(true);
    expect(negNbBar?.classList.contains("rtichoke-performance-table__bar-fill--negative")).toBe(true);

    const opCells = root.querySelectorAll(".rtichoke-performance-table__op");
    // opCells[0] is Probability Threshold, opCells[1] is Predicted Positives
    const predPosBar = opCells[1]?.querySelector(".rtichoke-performance-table__bar-fill") as HTMLElement;
    expect(predPosBar?.classList.contains("rtichoke-performance-table__bar-fill--neutral")).toBe(true);
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
    // Global document fallback inside JSDOM environment
    const previousDocument = globalThis.document;
    globalThis.document = dom.window.document;
    try {
      const reportEl = renderReport(reportSpec);
      expect(reportEl.querySelector(".rtichoke-performance-table")).not.toBeNull();
      expect(reportEl.querySelector(".rtichoke-performance-table__scroll")).not.toBeNull();
    } finally {
      globalThis.document = previousDocument;
    }
  });

  it("rejects referential-integrity failures before rendering", () => {
    const value = spec();
    value.rows[0].evaluationId = "missing-evaluation";
    expect(() => render(value)).toThrow("unknown evaluation id: missing-evaluation");
  });

  describe("expandable confusion-matrix row detail", () => {
    it("renders disclosure button only for eligible rows with all 4 confusion metrics", () => {
      const eligibilitySpec: PerformanceTableSpec = {
        schemaVersion: "2.0",
        type: "performance_table",
        evaluations: [{ id: "e1", model: "m1", population: "p1" }],
        metrics: [
          { id: "true_positives", label: "TP" },
          { id: "true_negatives", label: "TN" },
          { id: "false_positives", label: "FP" },
          { id: "false_negatives", label: "FN" },
        ],
        rows: [
          {
            // Eligible row
            evaluationId: "e1",
            operatingPoint: { type: "probability_threshold", value: 0.5 },
            values: [
              { metricId: "true_positives", estimate: 40 },
              { metricId: "true_negatives", estimate: 50 },
              { metricId: "false_positives", estimate: 10 },
              { metricId: "false_negatives", estimate: 0 },
            ],
          },
          {
            // Ineligible: missing false_negatives
            evaluationId: "e1",
            operatingPoint: { type: "probability_threshold", value: 0.6 },
            values: [
              { metricId: "true_positives", estimate: 40 },
              { metricId: "true_negatives", estimate: 50 },
              { metricId: "false_positives", estimate: 10 },
            ],
          },
          {
            // Ineligible: null estimate
            evaluationId: "e1",
            operatingPoint: { type: "probability_threshold", value: 0.7 },
            values: [
              { metricId: "true_positives", estimate: 40 },
              { metricId: "true_negatives", estimate: 50 },
              { metricId: "false_positives", estimate: 10 },
              { metricId: "false_negatives", estimate: null },
            ],
          },
        ],
      };

      const dom = new JSDOM("", { url: "http://localhost/" });
      const root = renderPerformanceTable(eligibilitySpec, dom.window.document);
      const rows = [...root.querySelectorAll("tbody > tr")].filter(
        (r) =>
          !r.classList.contains("rtichoke-performance-table__detail-row") &&
          !r.closest(".rtichoke-performance-table__confusion-table")
      );

      expect(rows).toHaveLength(3);
      expect(rows[0].querySelector("button.rtichoke-performance-table__toggle-btn")).not.toBeNull();
      expect(rows[1].querySelector("button.rtichoke-performance-table__toggle-btn")).toBeNull();
      expect(rows[2].querySelector("button.rtichoke-performance-table__toggle-btn")).toBeNull();
    });

    it("renders static confusion matrix with correct totals, percentages, formatting, and DOM attributes", () => {
      const staticSpec: PerformanceTableSpec = {
        schemaVersion: "2.0",
        type: "performance_table",
        evaluations: [{ id: "eval-1", model: "Model A", population: "Pop A" }],
        metrics: [
          { id: "true_positives", label: "TP" },
          { id: "true_negatives", label: "TN" },
          { id: "false_positives", label: "FP" },
          { id: "false_negatives", label: "FN" },
        ],
        rows: [
          {
            evaluationId: "eval-1",
            operatingPoint: { type: "probability_threshold", value: 0.35 },
            values: [
              { metricId: "true_positives", estimate: 42 },
              { metricId: "false_negatives", estimate: 8 },
              { metricId: "false_positives", estimate: 10 },
              { metricId: "true_negatives", estimate: 40 },
            ],
          },
        ],
      };

      const dom = new JSDOM("", { url: "http://localhost/" });
      const root = renderPerformanceTable(staticSpec, dom.window.document);

      const toggleBtn = root.querySelector("button.rtichoke-performance-table__toggle-btn") as HTMLButtonElement;
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");

      const detailRow = root.querySelector("tr.rtichoke-performance-table__detail-row") as HTMLTableRowElement;
      expect(detailRow).not.toBeNull();
      expect(detailRow.hidden).toBe(true);

      const container = root.querySelector(".rtichoke-performance-table__confusion-container") as HTMLDivElement;
      expect(container.getAttribute("data-evaluation-id")).toBe("eval-1");
      expect(container.getAttribute("data-confusion-detail-for")).toBeNull();
      expect(container.getAttribute("data-operating-point-type")).toBe("probability_threshold");
      expect(container.getAttribute("data-operating-point-value")).toBe("0.35");

      const title = root.querySelector(".rtichoke-performance-table__confusion-title");
      expect(title?.textContent).toBe("Confusion Matrix");
      expect(root.querySelector(".rtichoke-performance-table__confusion-caption")).toBeNull();

      // Matrix values check (N = 42 + 8 + 10 + 40 = 100)
      const matrixCells = [...root.querySelectorAll(".rtichoke-performance-table__confusion-table tbody tr")];
      expect(matrixCells).toHaveLength(3); // Actual Pos, Actual Neg, Total

      // Actual Positive: TP=42 (42.00%), FN=8 (8.00%), Total=50 (50.00%)
      const r1Spans = [...matrixCells[0].querySelectorAll("td")].map((td) => td.textContent?.trim());
      expect(r1Spans[0]).toBe("4242.00%"); // TP
      expect(r1Spans[1]).toBe("88.00%");   // FN
      expect(r1Spans[2]).toBe("5050.00%"); // Actual Pos Total

      // Actual Negative: FP=10 (10.00%), TN=40 (40.00%), Total=50 (50.00%)
      const r2Spans = [...matrixCells[1].querySelectorAll("td")].map((td) => td.textContent?.trim());
      expect(r2Spans[0]).toBe("1010.00%"); // FP
      expect(r2Spans[1]).toBe("4040.00%"); // TN
      expect(r2Spans[2]).toBe("5050.00%"); // Actual Neg Total

      // Total Row: PredPos=52 (52.00%), PredNeg=48 (48.00%), GrandTotal=100 (100.00%)
      const r3Spans = [...matrixCells[2].querySelectorAll("td")].map((td) => td.textContent?.trim());
      expect(r3Spans[0]).toBe("5252.00%");
      expect(r3Spans[1]).toBe("4848.00%");
      expect(r3Spans[2]).toBe("100100.00%");
    });

    it("renders time-dependent estimated confusion matrix with horizon title, caption, and fractional formatting", () => {
      const timeDepSpec: PerformanceTableSpec = {
        schemaVersion: "2.0",
        type: "performance_table",
        evaluations: [{ id: "eval-td", model: "SurvModel", population: "Pop 1" }],
        metrics: [
          { id: "true_positives", label: "TP" },
          { id: "true_negatives", label: "TN" },
          { id: "false_positives", label: "FP" },
          { id: "false_negatives", label: "FN" },
        ],
        rows: [
          {
            evaluationId: "eval-td",
            horizon: 5,
            operatingPoint: { type: "probability_threshold", value: 0.20 },
            values: [
              { metricId: "true_positives", estimate: 42.371 },
              { metricId: "false_negatives", estimate: 7.629 },
              { metricId: "false_positives", estimate: 12.5 },
              { metricId: "true_negatives", estimate: 37.5 },
            ],
          },
        ],
      };

      const dom = new JSDOM("", { url: "http://localhost/" });
      const root = renderPerformanceTable(timeDepSpec, dom.window.document);

      const title = root.querySelector(".rtichoke-performance-table__confusion-title");
      expect(title?.textContent).toBe("Estimated Confusion Matrix");

      const caption = root.querySelector(".rtichoke-performance-table__confusion-caption");
      expect(caption?.textContent).toBe("Estimated classification quantities at the displayed time horizon.");

      // N = 42.371 + 7.629 + 12.5 + 37.5 = 100
      const tpCell = root.querySelector(".rtichoke-performance-table__confusion-cell--favorable");
      expect(tpCell?.querySelector(".rtichoke-performance-table__confusion-val")?.textContent).toBe("42.37");
      expect(tpCell?.querySelector(".rtichoke-performance-table__confusion-pct")?.textContent).toBe("42.37%");
    });

    it("handles N === 0 edge case safely without emitting NaN or Infinity", () => {
      const zeroSpec: PerformanceTableSpec = {
        schemaVersion: "2.0",
        type: "performance_table",
        evaluations: [{ id: "e-zero", model: "M", population: "P" }],
        metrics: [
          { id: "true_positives", label: "TP" },
          { id: "true_negatives", label: "TN" },
          { id: "false_positives", label: "FP" },
          { id: "false_negatives", label: "FN" },
        ],
        rows: [
          {
            evaluationId: "e-zero",
            operatingPoint: { type: "probability_threshold", value: 0.5 },
            values: [
              { metricId: "true_positives", estimate: 0 },
              { metricId: "false_negatives", estimate: 0 },
              { metricId: "false_positives", estimate: 0 },
              { metricId: "true_negatives", estimate: 0 },
            ],
          },
        ],
      };

      const dom = new JSDOM("", { url: "http://localhost/" });
      const root = renderPerformanceTable(zeroSpec, dom.window.document);

      const pcts = [...root.querySelectorAll(".rtichoke-performance-table__confusion-pct")].map((el) => el.textContent);
      for (const pct of pcts) {
        expect(pct).toBe("—");
        expect(pct).not.toContain("NaN");
        expect(pct).not.toContain("Infinity");
      }
    });

    it("supports interactive expand/collapse toggling and independent row states", () => {
      const multiSpec: PerformanceTableSpec = {
        schemaVersion: "2.0",
        type: "performance_table",
        evaluations: [{ id: "e1", model: "M1", population: "P1" }],
        metrics: [
          { id: "true_positives", label: "TP" },
          { id: "true_negatives", label: "TN" },
          { id: "false_positives", label: "FP" },
          { id: "false_negatives", label: "FN" },
        ],
        rows: [
          {
            evaluationId: "e1",
            operatingPoint: { type: "probability_threshold", value: 0.2 },
            values: [
              { metricId: "true_positives", estimate: 10 },
              { metricId: "true_negatives", estimate: 80 },
              { metricId: "false_positives", estimate: 5 },
              { metricId: "false_negatives", estimate: 5 },
            ],
          },
          {
            evaluationId: "e1",
            operatingPoint: { type: "probability_threshold", value: 0.8 },
            values: [
              { metricId: "true_positives", estimate: 2 },
              { metricId: "true_negatives", estimate: 95 },
              { metricId: "false_positives", estimate: 0 },
              { metricId: "false_negatives", estimate: 3 },
            ],
          },
        ],
      };

      const dom = new JSDOM("", { url: "http://localhost/" });
      const root = renderPerformanceTable(multiSpec, dom.window.document);

      const toggleBtns = [...root.querySelectorAll("button.rtichoke-performance-table__toggle-btn")] as HTMLButtonElement[];
      const detailRows = [...root.querySelectorAll("tr.rtichoke-performance-table__detail-row")] as HTMLTableRowElement[];

      expect(toggleBtns).toHaveLength(2);
      expect(detailRows).toHaveLength(2);

      // Both initially collapsed
      expect(toggleBtns[0].getAttribute("aria-expanded")).toBe("false");
      expect(detailRows[0].hidden).toBe(true);
      expect(toggleBtns[1].getAttribute("aria-expanded")).toBe("false");
      expect(detailRows[1].hidden).toBe(true);

      // Initial aria-labels
      expect(toggleBtns[0].getAttribute("aria-label")).toBe("Show confusion matrix detail");
      expect(toggleBtns[1].getAttribute("aria-label")).toBe("Show confusion matrix detail");

      // Expand row 0
      toggleBtns[0].click();
      expect(toggleBtns[0].getAttribute("aria-expanded")).toBe("true");
      expect(toggleBtns[0].getAttribute("aria-label")).toBe("Hide confusion matrix detail");
      expect(toggleBtns[0].textContent).toBe("▾");
      expect(detailRows[0].hidden).toBe(false);
      // Row 1 remains collapsed
      expect(toggleBtns[1].getAttribute("aria-expanded")).toBe("false");
      expect(toggleBtns[1].getAttribute("aria-label")).toBe("Show confusion matrix detail");
      expect(detailRows[1].hidden).toBe(true);

      // Collapse row 0 again
      toggleBtns[0].click();
      expect(toggleBtns[0].getAttribute("aria-expanded")).toBe("false");
      expect(toggleBtns[0].getAttribute("aria-label")).toBe("Show confusion matrix detail");
      expect(toggleBtns[0].textContent).toBe("▸");
      expect(detailRows[0].hidden).toBe(true);
    });
  });
});
