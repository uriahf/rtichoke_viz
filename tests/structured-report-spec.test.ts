import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import generatedReportSchema from "../schemas/rtichoke-viz-report.schema.json" with { type: "json" };
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import decisionCurve from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import gains from "../fixtures/v2/gains-single.json" with { type: "json" };
import interventionsAvoided from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import lift from "../fixtures/v2/lift-single.json" with { type: "json" };
import performanceTable from "../fixtures/v2/performance-table.json" with { type: "json" };
import precisionRecall from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import {
  ReportSpecSchema,
  ReportSpecV1_0Schema,
  ReportSpecV1_1Schema,
  type ReportComponentV1_1,
  type ReportSpec,
  type ReportSpecV1_1,
  type StandaloneCanonicalSpec,
} from "../src/spec/report.js";
import { assertReportReferentialIntegrity } from "../src/spec/validate-report.js";

function component(
  id: string,
  spec: object = roc,
  title?: string,
): ReportComponentV1_1 {
  return {
    type: "component",
    id,
    title,
    spec: structuredClone(spec) as StandaloneCanonicalSpec,
  };
}

function structured(
  sections: ReportSpecV1_1["sections"],
): ReportSpecV1_1 {
  return { schemaVersion: "1.1", type: "report", sections };
}

function expectValid(spec: ReportSpec): void {
  expect(Value.Check(ReportSpecSchema, spec)).toBe(true);
  expect(() => assertReportReferentialIntegrity(spec)).not.toThrow();
}

describe("structured ReportSpec v1.1", () => {
  it("matches the generated standalone ReportSpec JSON Schema", () => {
    expect(generatedReportSchema).toEqual(
      JSON.parse(JSON.stringify(ReportSpecSchema)),
    );
    expect(generatedReportSchema.$id).toBe(
      "https://rtichoke.dev/schema/viz/report.json",
    );
  });

  it("accepts a minimal section with a direct component", () => {
    expectValid(structured([
      { id: "discrimination", title: "Discrimination", items: [component("roc")] },
    ]));
  });

  it("accepts one non-recursive group level inside a section", () => {
    expectValid(structured([{
      id: "discrimination",
      title: "Discrimination",
      items: [{
        type: "group",
        id: "threshold",
        title: "By Probability Threshold",
        components: [component("roc"), component("gains", gains)],
      }],
    }]));
  });

  it.each([
    ["roc", roc],
    ["calibration", calibration],
    ["precision-recall", precisionRecall],
    ["gains", gains],
    ["lift", lift],
    ["decision-curve", decisionCurve],
    ["interventions-avoided", interventionsAvoided],
    ["performance-table", performanceTable],
  ])("keeps standalone %s specs eligible", (id, spec) => {
    expectValid(structured([
      { id: "section", title: "Section", items: [component(id, spec)] },
    ]));
  });

  it("rejects empty sections and empty groups structurally", () => {
    const emptySections = structured([]);
    const emptyItems = structured([{ id: "empty", title: "Empty", items: [] }]);
    const emptyGroup = structured([{
      id: "section",
      title: "Section",
      items: [{ type: "group", id: "empty", title: "Empty", components: [] }],
    }]);
    expect(Value.Check(ReportSpecV1_1Schema, emptySections)).toBe(false);
    expect(Value.Check(ReportSpecV1_1Schema, emptyItems)).toBe(false);
    expect(Value.Check(ReportSpecV1_1Schema, emptyGroup)).toBe(false);
  });

  it("rejects duplicate component ids across direct and grouped components", () => {
    const value = structured([
      { id: "first", title: "First", items: [component("duplicate")] },
      {
        id: "second",
        title: "Second",
        items: [{
          type: "group",
          id: "group",
          title: "Group",
          components: [component("duplicate", gains)],
        }],
      },
    ]);
    expect(() => assertReportReferentialIntegrity(value)).toThrow(
      "duplicate component id: duplicate",
    );
  });

  it("rejects duplicate section ids", () => {
    const value = structured([
      { id: "duplicate", title: "First", items: [component("roc")] },
      { id: "duplicate", title: "Second", items: [component("gains", gains)] },
    ]);
    expect(() => assertReportReferentialIntegrity(value)).toThrow(
      "duplicate section id: duplicate",
    );
  });

  it("rejects duplicate group ids report-wide", () => {
    const group = (componentId: string) => ({
      type: "group" as const,
      id: "duplicate",
      title: "Group",
      components: [component(componentId)],
    });
    const value = structured([
      { id: "first", title: "First", items: [group("roc")] },
      { id: "second", title: "Second", items: [group("roc-2")] },
    ]);
    expect(() => assertReportReferentialIntegrity(value)).toThrow(
      "duplicate group id: duplicate",
    );
  });

  it("keeps equal evaluation and series ids component-local", () => {
    const first = structuredClone(roc);
    const second = structuredClone(roc);
    second.evaluations[0].id = first.evaluations[0].id;
    second.series[0].id = first.series[0].id;
    second.series[0].evaluationId = first.evaluations[0].id;
    expectValid(structured([{
      id: "section",
      title: "Section",
      items: [component("roc-a", first), component("roc-b", second)],
    }]));
  });

  it("cannot validate recursive groups or sections inside sections", () => {
    const recursiveGroup = {
      schemaVersion: "1.1",
      type: "report",
      sections: [{
        id: "section",
        title: "Section",
        items: [{
          type: "group",
          id: "outer",
          title: "Outer",
          components: [{
            type: "group",
            id: "inner",
            title: "Inner",
            components: [component("roc")],
          }],
        }],
      }],
    };
    const nestedSection = {
      schemaVersion: "1.1",
      type: "report",
      sections: [{
        id: "outer",
        title: "Outer",
        items: [{ id: "inner", title: "Inner", items: [component("roc")] }],
      }],
    };
    expect(Value.Check(ReportSpecV1_1Schema, recursiveGroup)).toBe(false);
    expect(Value.Check(ReportSpecV1_1Schema, nestedSection)).toBe(false);
  });

  it("retains ReportSpec v1.0 unchanged and rejects shape/version mismatches", () => {
    const v1 = {
      schemaVersion: "1.0",
      type: "report",
      title: "Existing report",
      components: [{ id: "roc", spec: structuredClone(roc) }],
    };
    expect(Value.Check(ReportSpecV1_0Schema, v1)).toBe(true);
    expect(Value.Check(ReportSpecSchema, v1)).toBe(true);
    expect(Value.Check(ReportSpecSchema, { ...v1, schemaVersion: "1.1" })).toBe(false);

    const v1_1 = structured([
      { id: "section", title: "Section", items: [component("roc")] },
    ]);
    expect(Value.Check(ReportSpecSchema, { ...v1_1, schemaVersion: "1.0" })).toBe(false);
  });
});
