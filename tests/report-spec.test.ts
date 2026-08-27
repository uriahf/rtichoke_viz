import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import gainsEqualPrevalence from "../fixtures/v2/gains-equal-prevalence.json" with { type: "json" };
import gainsPopulations from "../fixtures/v2/gains-populations.json" with { type: "json" };
import gainsSharedPopulation from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import gainsTime from "../fixtures/v2/gains-time.json" with { type: "json" };
import performanceTable from "../fixtures/v2/performance-table.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import { RtichokeChartSpecV2Schema, type RtichokeChartSpecV2 } from "../src/spec/v2/chart.js";
import { PerformanceTableSpecSchema, type PerformanceTableSpec } from "../src/spec/v2/performance-table.js";
import { assertPerformanceTableReferentialIntegrity } from "../src/spec/v2/validate-performance-table.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";
import { ReportSpecSchema, type ReportSpecV1_0 } from "../src/spec/report.js";
import { assertReportReferentialIntegrity } from "../src/spec/validate-report.js";

function report(components: ReportSpecV1_0["components"]): ReportSpecV1_0 {
  return { schemaVersion: "1.0", type: "report", components };
}

function chart(spec: object): RtichokeChartSpecV2 {
  return structuredClone(spec) as RtichokeChartSpecV2;
}

function table(): PerformanceTableSpec {
  return structuredClone(performanceTable) as PerformanceTableSpec;
}

function expectValid(value: ReportSpecV1_0): void {
  expect(Value.Check(ReportSpecSchema, value)).toBe(true);
  expect(() => assertReportReferentialIntegrity(value)).not.toThrow();
}

describe("canonical ReportSpec", () => {
  it("composes PerformanceTable, ROC, and calibration for one population", () => {
    expectValid(report([
      { id: "performance", spec: table() },
      { id: "roc", spec: chart(roc) },
      { id: "calibration", spec: chart(calibration) },
    ]));
  });

  it("preserves two-model shared-population semantics inside a component", () => {
    const spec = chart(gainsSharedPopulation);
    expect(new Set(spec.evaluations.map((evaluation) => evaluation.population)).size).toBe(1);
    expectValid(report([{ id: "gains", spec }]));
  });

  it("preserves multiple populations inside a component", () => {
    const spec = chart(gainsPopulations);
    expect(new Set(spec.evaluations.map((evaluation) => evaluation.population)).size).toBeGreaterThan(1);
    expectValid(report([{ id: "gains-populations", spec }]));
  });

  it("preserves model-unknown population semantics", () => {
    const spec = chart(calibration);
    expect(spec.evaluations[0].model).toBeUndefined();
    expectValid(report([{ id: "calibration", spec }]));
  });

  it("composes chart and PerformanceTable sibling specs", () => {
    expectValid(report([
      { id: "roc", title: "ROC", spec: chart(roc) },
      { id: "performance", title: "Performance", spec: table() },
    ]));
  });

  it("composes static and time-dependent components without hoisting identity", () => {
    const value = report([
      { id: "static", spec: chart(roc) },
      { id: "time", spec: chart(gainsTime) },
    ]);
    expectValid(value);
    expect(value.components[0].spec).not.toBe(value.components[1].spec);
  });

  it("leaves equal-valued references with distinct semantic owners untouched", () => {
    const spec = chart(gainsEqualPrevalence);
    const references = spec.references ?? [];
    const populations = references.flatMap((reference) =>
      "population" in reference ? [reference.population] : [],
    );
    expect(references.length).toBeGreaterThan(1);
    expect(new Set(populations).size).toBeGreaterThan(1);
    expectValid(report([{ id: "equal-valued-references", spec }]));
  });

  it("rejects duplicate component ids", () => {
    const value = report([
      { id: "duplicate", spec: chart(roc) },
      { id: "duplicate", spec: table() },
    ]);
    expect(() => assertReportReferentialIntegrity(value)).toThrow(
      "duplicate component id: duplicate",
    );
  });

  it("rejects an empty component list structurally", () => {
    expect(Value.Check(ReportSpecSchema, report([]))).toBe(false);
  });

  it("keeps embedded components independently valid under existing validators", () => {
    const chartSpec = chart(roc);
    const tableSpec = table();
    expect(Value.Check(RtichokeChartSpecV2Schema, chartSpec)).toBe(true);
    expect(Value.Check(PerformanceTableSpecSchema, tableSpec)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(chartSpec)).not.toThrow();
    expect(() => assertPerformanceTableReferentialIntegrity(tableSpec)).not.toThrow();
  });

  it("does not make equal evaluation ids report-global identity", () => {
    const chartSpec = chart(roc);
    const tableSpec = table();
    chartSpec.evaluations[0].id = "evaluation-1";
    chartSpec.series[0].evaluationId = "evaluation-1";
    tableSpec.evaluations[0].id = "evaluation-1";
    for (const row of tableSpec.rows) {
      if (row.evaluationId === performanceTable.evaluations[0].id) {
        row.evaluationId = "evaluation-1";
      }
    }
    expectValid(report([
      { id: "roc-component", spec: chartSpec },
      { id: "table-component", spec: tableSpec },
    ]));
  });
});
