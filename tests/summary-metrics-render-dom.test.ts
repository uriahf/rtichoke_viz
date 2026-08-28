import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/summary-metrics.json" with { type: "json" };
import { renderReport } from "../src/render/report.js";
import { renderSummaryMetrics } from "../src/render/summary-metrics.js";
import type { ReportSpec } from "../src/spec/report.js";
import type { SummaryMetricsSpec } from "../src/spec/v2/summary-metrics.js";

function spec(): SummaryMetricsSpec {
  return structuredClone(fixture) as SummaryMetricsSpec;
}

function render(value: SummaryMetricsSpec = spec()): HTMLDivElement {
  const document = new JSDOM().window.document;
  return renderSummaryMetrics(value, document);
}

describe("SummaryMetrics browser renderer", () => {
  it("renders standalone AUROC, prevalence, and mixed spec", () => {
    const root = render();
    expect(root.className).toBe("rtichoke-summary-metrics");
    expect(
      root.querySelector(".rtichoke-summary-metrics__title")?.textContent,
    ).toBe("Model Performance & Prevalence Summary");

    const rows = [...root.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);

    // Row 1: AUROC eval-1
    expect(rows[0].getAttribute("data-metric")).toBe("auroc");
    expect(rows[0].getAttribute("data-evaluation-id")).toBe("eval-1");
    expect(
      rows[0].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("Model A");
    expect(
      rows[0].querySelector(".rtichoke-summary-metrics__metric")?.textContent,
    ).toBe("AUROC");
    expect(
      rows[0].querySelector(".rtichoke-summary-metrics__estimate")?.textContent,
    ).toBe("0.82");

    // Row 4: prevalence pop-1
    expect(rows[3].getAttribute("data-metric")).toBe("prevalence");
    expect(rows[3].getAttribute("data-population-id")).toBe("pop-1");
    expect(
      rows[3].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("Validation cohort");
    expect(
      rows[3].querySelector(".rtichoke-summary-metrics__metric")?.textContent,
    ).toBe("Prevalence");
    expect(
      rows[3].querySelector(".rtichoke-summary-metrics__estimate")?.textContent,
    ).toBe("0.23");
  });

  it("renders null AUROC as unavailable (em dash), not zero", () => {
    const root = render();
    const rows = [...root.querySelectorAll("tbody tr")];
    const nullRow = rows[2]; // eval-3 has estimate: null
    const estimateCell = nullRow.querySelector(
      ".rtichoke-summary-metrics__estimate",
    );
    expect(estimateCell?.textContent).toBe("—");
    expect(estimateCell?.getAttribute("data-unavailable")).toBe("true");
    expect(estimateCell?.textContent).not.toBe("0");
    expect(estimateCell?.textContent).not.toBe("0.00");
  });

  it("does not mutate supplied numerical estimates", () => {
    const s = spec();
    render(s);
    expect(s.metrics[0].estimate).toBe(0.8234);
    expect(s.metrics[3].estimate).toBe(0.2317);
  });

  it("uses local population label for population-owned metrics", () => {
    const root = render();
    const rows = [...root.querySelectorAll("tbody tr")];
    expect(
      rows[3].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("Validation cohort");
    expect(
      rows[4].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("External cohort");
  });

  it("uses evaluation display fallback order (label -> model -> population -> id)", () => {
    const s = spec();
    s.evaluations[0].label = "Custom Label A";
    s.evaluations[1].model = "Model B Only";
    s.evaluations[1].label = undefined;
    s.evaluations[2].model = undefined;
    s.evaluations[2].label = undefined;
    s.evaluations[2].population = "External Pop";

    const document = new JSDOM().window.document;
    const root = renderSummaryMetrics(s, document);
    const rows = [...root.querySelectorAll("tbody tr")];

    expect(
      rows[0].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("Custom Label A");
    expect(
      rows[1].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("Model B Only");
    expect(
      rows[2].querySelector(".rtichoke-summary-metrics__owner")?.textContent,
    ).toBe("External Pop");
  });

  it("embeds in ReportSpec v1.0 and renders via renderReport()", () => {
    const document = new JSDOM().window.document;
    globalThis.document = document;

    const reportSpec: ReportSpec = {
      schemaVersion: "1.0",
      type: "report",
      title: "Test Report with Summary Metrics",
      components: [
        {
          id: "comp-summary",
          title: "Summary Metrics Component",
          spec: spec(),
        },
      ],
    };

    const root = renderReport(reportSpec);
    expect(root.className).toBe("rtichoke-report");
    expect(
      root.querySelector(".rtichoke-summary-metrics"),
    ).not.toBeNull();
  });

  it("embeds in ReportSpec v1.1 and renders via renderReport()", () => {
    const document = new JSDOM().window.document;
    globalThis.document = document;

    const reportSpec: ReportSpec = {
      schemaVersion: "1.1",
      type: "report",
      title: "Test Report v1.1 with Summary Metrics",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-summary-1.1",
              title: "Summary Metrics Component",
              spec: spec(),
            },
          ],
        },
      ],
    };

    const root = renderReport(reportSpec);
    expect(root.className).toBe("rtichoke-report");
    expect(
      root.querySelector(".rtichoke-summary-metrics"),
    ).not.toBeNull();
  });
});
