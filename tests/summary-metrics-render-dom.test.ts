import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/summary-metrics.json" with { type: "json" };
import { renderReport } from "../src/render/report.js";
import { renderSummaryMetrics } from "../src/render/summary-metrics.js";
import type { ReportSpec } from "../src/spec/report.js";
import type { SummaryMetricsSpec, SummaryMetricsSpecV1_1 } from "../src/spec/v2/summary-metrics.js";

function spec(): SummaryMetricsSpec {
  return structuredClone(fixture) as SummaryMetricsSpec;
}

function specV1_1(): SummaryMetricsSpecV1_1 {
  const s = structuredClone(fixture) as any;
  s.schemaVersion = "1.1";
  return s as SummaryMetricsSpecV1_1;
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

  describe("v1.1 horizon selector and filtering behavior", () => {
    it("static-only v1.1 has no horizon selector", () => {
      const s = specV1_1();
      const root = render(s);
      expect(root.querySelector(".rtichoke-horizon-control")).toBeNull();
    });

    it("single horizon has no horizon selector", () => {
      const s = specV1_1();
      s.metrics.push({
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 2,
        estimate: 0.14,
      });
      const root = render(s);
      expect(root.querySelector(".rtichoke-horizon-control")).toBeNull();
      const rows = [...root.querySelectorAll("tbody tr")] as HTMLTableRowElement[];
      expect(rows).toHaveLength(6);
      expect(rows.every((row) => row.style.display !== "none")).toBe(true);
    });

    it("multiple horizons render selector, preserve order, default to first encountered, and filter rows", () => {
      const s = specV1_1();
      s.metrics.push(
        {
          metric: "event_risk",
          owner: { type: "population", populationId: "pop-1" },
          horizon: 2,
          estimate: 0.14,
        },
        {
          metric: "event_risk",
          owner: { type: "population", populationId: "pop-1" },
          horizon: 1,
          estimate: 0.08,
        },
        {
          metric: "event_risk",
          owner: { type: "population", populationId: "pop-2" },
          horizon: 2,
          estimate: 0.19,
        },
      );

      const document = new JSDOM().window.document;
      const root = renderSummaryMetrics(s, document);

      const control = root.querySelector(".rtichoke-horizon-control");
      expect(control).not.toBeNull();
      expect(control?.textContent).toContain("Fixed Time Horizon:");

      const select = root.querySelector(
        ".rtichoke-horizon-select",
      ) as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = [...select.options];
      expect(options.map((o) => o.value)).toEqual(["2", "1"]);
      expect(select.value).toBe("2");

      const rows = [...root.querySelectorAll("tbody tr")] as HTMLTableRowElement[];
      expect(rows).toHaveLength(8);

      // Initial state (horizon 2 selected):
      // Static rows (0..4) and horizon 2 rows (5 and 7) visible; horizon 1 row (6) hidden.
      expect(rows[0].style.display).toBe("");
      expect(rows[4].style.display).toBe("");
      expect(rows[5].style.display).toBe(""); // event_risk h=2
      expect(rows[6].style.display).toBe("none"); // event_risk h=1
      expect(rows[7].style.display).toBe(""); // event_risk h=2

      // Change selection to horizon 1
      select.value = "1";
      select.dispatchEvent(new document.defaultView!.Event("change"));

      expect(rows[0].style.display).toBe("");
      expect(rows[4].style.display).toBe("");
      expect(rows[5].style.display).toBe("none"); // event_risk h=2
      expect(rows[6].style.display).toBe(""); // event_risk h=1
      expect(rows[7].style.display).toBe("none"); // event_risk h=2
    });

    it("renders null event_risk estimate as em dash", () => {
      const s = specV1_1();
      s.metrics.push({
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 2,
        estimate: null,
      });

      const root = render(s);
      const rows = [...root.querySelectorAll("tbody tr")];
      const lastRow = rows[rows.length - 1];
      expect(lastRow.getAttribute("data-metric")).toBe("event_risk");
      expect(
        lastRow.querySelector(".rtichoke-summary-metrics__metric")?.textContent,
      ).toBe("Event Risk");
      const estimateCell = lastRow.querySelector(
        ".rtichoke-summary-metrics__estimate",
      );
      expect(estimateCell?.textContent).toBe("—");
      expect(estimateCell?.getAttribute("data-unavailable")).toBe("true");
    });
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

  it("embeds in ReportSpec v1.1 and renders via renderReport() with independent component horizon state", () => {
    const document = new JSDOM().window.document;
    globalThis.document = document;

    const specA = specV1_1();
    specA.metrics.push(
      {
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 1,
        estimate: 0.1,
      },
      {
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 2,
        estimate: 0.2,
      },
    );

    const specB = specV1_1();
    specB.metrics.push(
      {
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 10,
        estimate: 0.3,
      },
      {
        metric: "event_risk",
        owner: { type: "population", populationId: "pop-1" },
        horizon: 20,
        estimate: 0.4,
      },
    );

    const reportSpec: ReportSpec = {
      schemaVersion: "1.1",
      type: "report",
      title: "Test Report v1.1 with Independent Summary Metrics Horizons",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-summary-a",
              title: "Summary Metrics A",
              spec: specA,
            },
            {
              type: "component",
              id: "comp-summary-b",
              title: "Summary Metrics B",
              spec: specB,
            },
          ],
        },
      ],
    };

    const root = renderReport(reportSpec);
    expect(root.className).toBe("rtichoke-report");

    const components = root.querySelectorAll(".rtichoke-summary-metrics");
    expect(components).toHaveLength(2);

    const selectA = components[0].querySelector(
      ".rtichoke-horizon-select",
    ) as HTMLSelectElement;
    const selectB = components[1].querySelector(
      ".rtichoke-horizon-select",
    ) as HTMLSelectElement;

    expect(selectA.value).toBe("1");
    expect(selectB.value).toBe("10");

    selectA.value = "2";
    selectA.dispatchEvent(new document.defaultView!.Event("change"));

    expect(selectA.value).toBe("2");
    expect(selectB.value).toBe("10");
  });
});
