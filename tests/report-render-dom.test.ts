// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import gains from "../fixtures/v2/gains-single.json" with { type: "json" };
import lift from "../fixtures/v2/lift-single.json" with { type: "json" };
import performanceTable from "../fixtures/v2/performance-table.json" with { type: "json" };
import precisionRecall from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import type { ReportSpec } from "../src/spec/report.js";
import { renderReport } from "../src/render/report.js";

function report(
  components: ReportSpec["components"],
  title?: string,
): ReportSpec {
  return { schemaVersion: "1.0", type: "report", title, components };
}

function component(id: string, spec: object, title?: string) {
  return {
    id,
    title,
    spec: structuredClone(spec),
  } as ReportSpec["components"][number];
}

describe("renderReport", () => {
  it("renders the optional report title", () => {
    const root = renderReport(report([component("roc", roc)], "Model report"));
    expect(root.querySelector(".rtichoke-report__title")?.textContent).toBe(
      "Model report",
    );
  });

  it("renders components in array order with stable component identity", () => {
    const root = renderReport(
      report([
        component("table", performanceTable),
        component("roc", roc),
        component("calibration", calibration),
      ]),
    );
    const containers = [
      ...root.querySelectorAll<HTMLElement>(".rtichoke-report__component"),
    ];
    expect(containers.map((item) => item.dataset.componentId)).toEqual([
      "table",
      "roc",
      "calibration",
    ]);
    expect(new Set(containers.map((item) => item.dataset.componentId)).size).toBe(
      containers.length,
    );
  });

  it("renders optional component titles", () => {
    const root = renderReport(
      report([
        component("roc", roc, "Discrimination"),
        component("table", performanceTable, "Operating points"),
      ]),
    );
    expect(
      [...root.querySelectorAll(".rtichoke-report__component-title")].map(
        (item) => item.textContent,
      ),
    ).toEqual(["Discrimination", "Operating points"]);
  });

  it("composes a chart and PerformanceTable as siblings", () => {
    const root = renderReport(
      report([component("roc", roc), component("table", performanceTable)]),
    );
    expect(root.querySelector('[data-component-id="roc"] svg')).not.toBeNull();
    expect(
      root.querySelector(
        '[data-component-id="table"] .rtichoke-performance-table',
      ),
    ).not.toBeNull();
  });

  it.each([
    ["roc", roc],
    ["calibration", calibration],
    ["precision-recall", precisionRecall],
    ["gains", gains],
    ["lift", lift],
  ])("dispatches the %s component to its existing chart renderer", (id, spec) => {
    const root = renderReport(report([component(id, spec)]));
    expect(root.querySelector(`[data-component-id="${id}"] svg`)).not.toBeNull();
  });

  it("dispatches PerformanceTable to the existing table renderer", () => {
    const root = renderReport(report([component("performance", performanceTable)]));
    expect(
      root.querySelector(
        '[data-component-id="performance"] .rtichoke-performance-table__table',
      ),
    ).not.toBeNull();
  });

  it("rejects an invalid ReportSpec before rendering components", () => {
    const invalid = report([]);
    expect(() => renderReport(invalid)).toThrow("Invalid ReportSpec");
  });

  it("rejects duplicate report component ids before rendering", () => {
    const invalid = report([
      component("duplicate", roc),
      component("duplicate", performanceTable),
    ]);
    expect(() => renderReport(invalid)).toThrow(
      "duplicate component id: duplicate",
    );
  });

  it("keeps equal evaluation ids component-local", () => {
    const first = structuredClone(roc);
    const second = structuredClone(roc);
    first.evaluations[0].id = "evaluation-1";
    first.series[0].evaluationId = "evaluation-1";
    second.evaluations[0].id = "evaluation-1";
    second.series[0].evaluationId = "evaluation-1";

    const root = renderReport(
      report([component("roc-a", first), component("roc-b", second)]),
    );
    expect(root.querySelector('[data-component-id="roc-a"] svg')).not.toBeNull();
    expect(root.querySelector('[data-component-id="roc-b"] svg')).not.toBeNull();
    expect(root.querySelectorAll(".rtichoke-report__component")).toHaveLength(2);
  });
});
