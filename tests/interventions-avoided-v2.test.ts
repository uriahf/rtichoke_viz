import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/interventions-avoided-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/interventions-avoided-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/interventions-avoided-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/interventions-avoided-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import { ReportSpecSchema } from "../src/spec/report.js";
import { RtichokeChartSpecV2Schema, type RtichokeChartSpecV2 } from "../src/spec/v2/chart.js";
import { InterventionsAvoidedV2SpecSchema } from "../src/spec/v2/interventions-avoided.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

const fixtures = [single, sharedPopulation, populations, equalPrevalence, modelUnknown];

describe("v2 interventions avoided semantics", () => {
  it.each(fixtures)("accepts canonical static fixtures", (spec) => {
    expect(Value.Check(InterventionsAvoidedV2SpecSchema, spec)).toBe(true);
    expect(Value.Check(RtichokeChartSpecV2Schema, spec)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
  });

  it("maps one evaluation to one independent ordinal series", () => {
    expect(single.evaluations.map((x) => x.id)).toEqual(["evaluation-1"]);
    expect(single.series.map((x) => x.id)).toEqual(["series-1"]);
    expect(single.series[0].evaluationId).toBe("evaluation-1");
    expect(single.series[0].id).not.toBe(single.series[0].evaluationId);
    expect(single).toMatchObject({ x: "threshold", y: "interventionsAvoided" });
  });

  it("uses one global zero Treat All benchmark", () => {
    const refs = single.references.filter((x) => x.benchmark === "treat_all");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: "horizontal", scope: "global", value: 0 });
  });

  it("shares one population-owned Treat None path across models", () => {
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_all")).toHaveLength(1);
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_none")).toHaveLength(1);
  });

  it("keeps distinct Treat None owners and nontrivial geometry", () => {
    const refs = populations.references.filter((x) => x.benchmark === "treat_none");
    expect(refs.map((x) => x.population)).toEqual(["Population A", "Population B"]);
    expect(refs[0].points).toEqual([{ x: 0.1, y: -100 }, { x: 0.2, y: 0 }, { x: 0.4, y: 50 }]);
    expect(refs[0].points).not.toEqual(refs[1].points);
  });

  it("does not collapse equal-prevalence populations with identical geometry", () => {
    const refs = equalPrevalence.references.filter((x) => x.benchmark === "treat_none");
    expect(refs).toHaveLength(2);
    expect(refs[0].points).toEqual(refs[1].points);
    expect(refs[0].population).not.toBe(refs[1].population);
  });

  it("omits unknown models and preserves population-key display", () => {
    expect(modelUnknown.evaluations.every((x) => !("model" in x))).toBe(true);
    expect(modelUnknown.series.map((x) => x.display.role)).toEqual(["population", "population"]);
    expect(modelUnknown.series[1].display.label).toBe("Model A @ Population A");
  });

  it("rejects duplicate/missing Treat All and invalid Treat None ownership", () => {
    const duplicate = structuredClone(single);
    duplicate.references.push(structuredClone(single.references[0]));
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("exactly one Treat All");
    const missingAll = structuredClone(single);
    missingAll.references = missingAll.references.filter((x) => x.benchmark !== "treat_all");
    expect(() => assertV2ReferentialIntegrity(missingAll as RtichokeChartSpecV2)).toThrow("exactly one Treat All");
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
    const report = { schemaVersion: "1.0", type: "report", components: [{ id: "ia", spec: single }, { id: "roc", spec: rocWithSameLocalId }] };
    expect(Value.Check(ReportSpecSchema, report)).toBe(true);
  });

  const tdSharedPopulation = {
    schemaVersion: "2.0",
    type: "interventions_avoided",
    evaluations: [
      { id: "evaluation-1", population: "Population A", model: "Model A" },
      { id: "evaluation-2", population: "Population A", model: "Model B" },
    ],
    series: [
      { id: "series-1", evaluationId: "evaluation-1", horizon: 5, display: { label: "Model A", group: "Model A", role: "model" } },
      { id: "series-2", evaluationId: "evaluation-2", horizon: 5, display: { label: "Model B", group: "Model B", role: "model" } },
      { id: "series-3", evaluationId: "evaluation-1", horizon: 10, display: { label: "Model A", group: "Model A", role: "model" } },
      { id: "series-4", evaluationId: "evaluation-2", horizon: 10, display: { label: "Model B", group: "Model B", role: "model" } },
    ],
    data: [
      { seriesId: "series-1", threshold: 0.1, interventionsAvoided: 14 },
      { seriesId: "series-2", threshold: 0.1, interventionsAvoided: 10 },
      { seriesId: "series-3", threshold: 0.1, interventionsAvoided: 18 },
      { seriesId: "series-4", threshold: 0.1, interventionsAvoided: 12 },
    ],
    x: "threshold",
    y: "interventionsAvoided",
    xAxis: { label: "Probability threshold", domain: [0, 0.5] },
    yAxis: { label: "Interventions Avoided (per 100)" },
    references: [
      { type: "horizontal", value: 0, label: "Treat All", scope: "global", benchmark: "treat_all" },
      { type: "path", points: [{ x: 0.1, y: -100 }, { x: 0.2, y: 0 }], label: "Treat None — Population A (5y)", scope: "population_horizon", population: "Population A", horizon: 5, benchmark: "treat_none" },
      { type: "path", points: [{ x: 0.1, y: -120 }, { x: 0.2, y: -10 }], label: "Treat None — Population A (10y)", scope: "population_horizon", population: "Population A", horizon: 10, benchmark: "treat_none" },
    ],
  };

  it("accepts evaluation-by-horizon geometry with population-by-horizon Treat None ownership (2 models × shared population × 2 horizons)", () => {
    expect(Value.Check(InterventionsAvoidedV2SpecSchema, tdSharedPopulation)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(tdSharedPopulation as RtichokeChartSpecV2)).not.toThrow();
    expect(tdSharedPopulation.evaluations).toHaveLength(2);
    expect(tdSharedPopulation.series).toHaveLength(4);
    expect(new Set(tdSharedPopulation.series.map((series) => series.evaluationId))).toEqual(
      new Set(["evaluation-1", "evaluation-2"]),
    );
    expect(new Set(tdSharedPopulation.series.map((series) => series.id)).size).toBe(4);
    expect(tdSharedPopulation.series.map((series) => series.horizon)).toEqual([5, 5, 10, 10]);
    expect(tdSharedPopulation.references.filter((reference) => reference.benchmark === "treat_none")).toMatchObject([
      { scope: "population_horizon", population: "Population A", horizon: 5 },
      { scope: "population_horizon", population: "Population A", horizon: 10 },
    ]);
  });

  it("keeps equal Treat None geometry distinct for distinct equal-risk populations across horizons", () => {
    const spec = structuredClone(tdSharedPopulation);
    spec.evaluations[1].population = "Population B";
    spec.series = spec.series.filter((series) => series.horizon === 5);
    spec.series[0].id = "series-1";
    spec.series[1].id = "series-2";
    spec.data = spec.data.filter((datum) => ["series-1", "series-2"].includes(datum.seriesId));
    const refPopB = structuredClone(spec.references[1]);
    refPopB.population = "Population B";
    spec.references = [spec.references[0], spec.references[1], refPopB];
    expect(spec.references[1].points).toEqual(spec.references[2].points);
    expect(spec.references[1].population).not.toBe(spec.references[2].population);
    expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
  });

  it("rejects incomplete or duplicate evaluation-by-horizon series coverage", () => {
    const missing = structuredClone(tdSharedPopulation);
    missing.series.pop();
    missing.data = missing.data.filter((datum) => datum.seriesId !== "series-4");
    expect(() => assertV2ReferentialIntegrity(missing as RtichokeChartSpecV2)).toThrow("per evaluation and horizon");

    const duplicate = structuredClone(tdSharedPopulation);
    duplicate.series[3].evaluationId = "evaluation-1";
    duplicate.series[3].display.label = "Model A";
    duplicate.series[3].display.group = "Model A";
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate interventions avoided evaluation-horizon series");
  });

  it("rejects mixed static and horizon-qualified series", () => {
    const mixed = structuredClone(tdSharedPopulation);
    delete (mixed.series[0] as { horizon?: number }).horizon;
    expect(() => assertV2ReferentialIntegrity(mixed as RtichokeChartSpecV2)).toThrow("cannot mix static and horizon-qualified series");
  });

  it("rejects incorrect Treat None ownership and scopes", () => {
    const wrongScopeStatic = structuredClone(single) as unknown as RtichokeChartSpecV2;
    Object.assign(wrongScopeStatic.references![1], { scope: "population_horizon", horizon: 5 });
    expect(() => assertV2ReferentialIntegrity(wrongScopeStatic)).toThrow("static interventions avoided Treat None must use population scope");

    const wrongScopeTD = structuredClone(tdSharedPopulation) as unknown as RtichokeChartSpecV2;
    Object.assign(wrongScopeTD.references![1], { scope: "population" });
    delete (wrongScopeTD.references![1] as { horizon?: number }).horizon;
    expect(() => assertV2ReferentialIntegrity(wrongScopeTD)).toThrow("time-dependent interventions avoided Treat None must use population_horizon scope");
  });

  it("rejects missing or duplicate population × horizon Treat None references", () => {
    const missing = structuredClone(tdSharedPopulation);
    missing.references.pop();
    expect(() => assertV2ReferentialIntegrity(missing as RtichokeChartSpecV2)).toThrow("per population and horizon");

    const duplicate = structuredClone(tdSharedPopulation);
    duplicate.references.push(structuredClone(tdSharedPopulation.references[1]));
    expect(() => assertV2ReferentialIntegrity(duplicate as RtichokeChartSpecV2)).toThrow("duplicate Treat None owner");
  });

  it("accepts dimension 'probability_threshold' and rejects dimension 'ppcr'", () => {
    const valid = { ...single, operatingPoint: { dimension: "probability_threshold" } };
    expect(Value.Check(InterventionsAvoidedV2SpecSchema, valid)).toBe(true);

    const invalid = { ...single, operatingPoint: { dimension: "ppcr" } };
    expect(Value.Check(InterventionsAvoidedV2SpecSchema, invalid)).toBe(false);
  });
});
