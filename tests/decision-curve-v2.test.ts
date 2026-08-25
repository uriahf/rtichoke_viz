import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/decision-curve-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/decision-curve-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/decision-curve-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/decision-curve-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import timeMulti from "../fixtures/v2/decision-curve-time-multi.json" with { type: "json" };
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
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate Treat All owner");
    const missingNone = structuredClone(single);
    missingNone.references = missingNone.references.filter((x) => x.benchmark !== "treat_none");
    expect(() => assertV2ReferentialIntegrity(missingNone as RtichokeChartSpecV2)).toThrow("exactly one Treat None");
    const unknownOwner = structuredClone(single);
    unknownOwner.references[1].population = "Unknown population";
    expect(() => assertV2ReferentialIntegrity(unknownOwner as RtichokeChartSpecV2)).toThrow("unknown reference population");
  });

  it("accepts evaluation-by-horizon geometry with population-by-horizon Treat All ownership", () => {
    expect(Value.Check(DecisionCurveV2SpecSchema, timeMulti)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(timeMulti as RtichokeChartSpecV2)).not.toThrow();
    expect(timeMulti.evaluations).toHaveLength(2);
    expect(timeMulti.series).toHaveLength(4);
    expect(new Set(timeMulti.series.map((series) => series.evaluationId))).toEqual(
      new Set(["evaluation-1", "evaluation-2"]),
    );
    expect(new Set(timeMulti.series.map((series) => series.id)).size).toBe(4);
    expect(timeMulti.series.map((series) => series.horizon)).toEqual([5, 5, 10, 10]);
    expect(timeMulti.references.filter((reference) => reference.benchmark === "treat_all")).toMatchObject([
      { scope: "population_horizon", population: "Population A", horizon: 5 },
      { scope: "population_horizon", population: "Population A", horizon: 10 },
    ]);
  });

  it("keeps equal Treat All geometry distinct for different population-horizon owners", () => {
    const spec = structuredClone(timeMulti);
    spec.evaluations[1].population = "Population B";
    spec.series = spec.series.filter((series) => series.horizon === 5);
    spec.series[0].id = "series-1";
    spec.series[1].id = "series-2";
    spec.data = spec.data.filter((datum) => ["series-1", "series-2"].includes(datum.seriesId));
    const reference = structuredClone(spec.references[1]);
    reference.population = "Population B";
    spec.references = [spec.references[0], spec.references[1], reference];
    expect(spec.references[1].points).toEqual(spec.references[2].points);
    expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
  });

  it("rejects missing, duplicate, and incorrectly scoped TD Treat All owners", () => {
    const missing = structuredClone(timeMulti);
    missing.references.pop();
    expect(() => assertV2ReferentialIntegrity(missing as RtichokeChartSpecV2)).toThrow("per population and horizon");

    const duplicate = structuredClone(timeMulti);
    duplicate.references.push(structuredClone(timeMulti.references[1]));
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate Treat All owner");

    const wrongScope = structuredClone(timeMulti) as unknown as RtichokeChartSpecV2;
    Object.assign(wrongScope.references![1], { scope: "population" });
    delete (wrongScope.references![1] as { horizon?: number }).horizon;
    expect(() => assertV2ReferentialIntegrity(wrongScope)).toThrow("must use population_horizon scope");
  });

  it("rejects incomplete or duplicate evaluation-by-horizon coverage", () => {
    const missing = structuredClone(timeMulti);
    missing.series.pop();
    missing.data = missing.data.filter((datum) => datum.seriesId !== "series-4");
    expect(() => assertV2ReferentialIntegrity(missing as RtichokeChartSpecV2)).toThrow("per evaluation and horizon");

    const duplicate = structuredClone(timeMulti);
    duplicate.series[3].evaluationId = "evaluation-1";
    duplicate.series[3].display.label = "Model A";
    duplicate.series[3].display.group = "Model A";
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate decision curve evaluation-horizon series");
  });

  it("rejects mixed static and horizon-qualified model geometry", () => {
    const mixed = structuredClone(timeMulti);
    delete (mixed.series[0] as { horizon?: number }).horizon;
    expect(() => assertV2ReferentialIntegrity(mixed as RtichokeChartSpecV2)).toThrow("cannot mix static and horizon-qualified series");
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
