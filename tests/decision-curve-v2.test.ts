import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/decision-curve-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/decision-curve-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/decision-curve-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/decision-curve-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import { ReportSpecSchema } from "../src/spec/report.js";
import { RtichokeChartSpecV2Schema, type RtichokeChartSpecV2 } from "../src/spec/v2/chart.js";
import { DecisionCurveV2SpecSchema } from "../src/spec/v2/decision-curve.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

const fixtures = [single, sharedPopulation, populations, equalPrevalence, modelUnknown];

describe("v2 decision curve semantics", () => {
  it.each(fixtures)("accepts canonical static conventional fixtures", (spec) => {
    expect(Value.Check(DecisionCurveV2SpecSchema, spec)).toBe(true);
    expect(Value.Check(RtichokeChartSpecV2Schema, spec)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
  });

  it("maps one evaluation to one independent ordinal series", () => {
    expect(single.evaluations.map((x) => x.id)).toEqual(["evaluation-1"]);
    expect(single.series.map((x) => x.id)).toEqual(["series-1"]);
    expect(single.series[0].evaluationId).toBe("evaluation-1");
    expect(single.series[0].id).not.toBe(single.series[0].evaluationId);
    expect(single).toMatchObject({ x: "threshold", y: "netBenefit" });
  });

  it("shares one population-owned Treat All across models", () => {
    expect(sharedPopulation.evaluations.map((x) => x.population)).toEqual(["Population A", "Population A"]);
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_none")).toHaveLength(1);
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_all")).toHaveLength(1);
  });

  it("keeps distinct population-owned Treat All paths", () => {
    const refs = populations.references.filter((x) => x.benchmark === "treat_all");
    expect(refs.map((x) => x.population)).toEqual(["Population A", "Population B"]);
    expect(refs[0].points).not.toEqual(refs[1].points);
  });

  it("does not collapse equal-prevalence populations with identical geometry", () => {
    const refs = equalPrevalence.references.filter((x) => x.benchmark === "treat_all");
    expect(refs).toHaveLength(2);
    expect(refs[0].points).toEqual(refs[1].points);
    expect(refs[0].population).not.toBe(refs[1].population);
  });

  it("omits unknown models and preserves opaque population labels", () => {
    expect(modelUnknown.evaluations.every((x) => !("model" in x))).toBe(true);
    expect(modelUnknown.series.map((x) => x.display.role)).toEqual(["population", "population"]);
    expect(modelUnknown.series[1].display.label).toBe("Model A @ Population A");
  });

  it("rejects invalid ownership and duplicate/missing benchmarks", () => {
    const duplicate = structuredClone(single);
    duplicate.references.push(structuredClone(single.references[1]));
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate Treat All population");
    const missingNone = structuredClone(single);
    missingNone.references = missingNone.references.filter((x) => x.benchmark !== "treat_none");
    expect(() => assertV2ReferentialIntegrity(missingNone as RtichokeChartSpecV2)).toThrow("exactly one Treat None");
    const unknownOwner = structuredClone(single);
    unknownOwner.references[1].population = "Unknown population";
    expect(() => assertV2ReferentialIntegrity(unknownOwner as RtichokeChartSpecV2)).toThrow("unknown reference population");
  });

  it("rejects label-derived identity", () => {
    const invalid = structuredClone(single);
    invalid.evaluations[0].id = "Model A";
    invalid.series[0].evaluationId = "Model A";
    expect(() => assertV2ReferentialIntegrity(invalid as RtichokeChartSpecV2)).toThrow("must be ordinal");
  });

  it("is ReportSpec-eligible while evaluation ids remain component-local", () => {
    const rocWithSameLocalId = structuredClone(roc);
    rocWithSameLocalId.evaluations[0].id = "evaluation-1";
    rocWithSameLocalId.series[0].evaluationId = "evaluation-1";
    const report = { schemaVersion: "1.0", type: "report", components: [{ id: "decision", spec: single }, { id: "roc", spec: rocWithSameLocalId }] };
    expect(Value.Check(ReportSpecSchema, report)).toBe(true);
    expect(report.components[0].spec.evaluations[0].id).toBe("evaluation-1");
    expect(report.components[1].spec.evaluations[0].id).toBe("evaluation-1");
  });
});
