import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/lift-equal-prevalence.json" with { type: "json" };
import equalRisk from "../fixtures/v2/lift-equal-risk.json" with { type: "json" };
import populations from "../fixtures/v2/lift-populations.json" with { type: "json" };
import sharedPopulationHorizon from "../fixtures/v2/lift-shared-population-horizon.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/lift-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/lift-single.json" with { type: "json" };
import timeDependent from "../fixtures/v2/lift-time.json" with { type: "json" };
import { selectHorizonSpec } from "../src/render/v2.js";
import { RtichokeChartSpecV2Schema, type RtichokeChartSpecV2 } from "../src/spec/v2/chart.js";
import { LiftV2SpecSchema, type LiftV2Spec } from "../src/spec/v2/lift.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

function isPathReference<T extends { type: string; points?: unknown }>(
  reference: T,
): reference is T & { type: "path"; points: Array<{ x: number; y: number }> } {
  return reference.type === "path" && Array.isArray(reference.points);
}

describe("v2 lift semantics", () => {
  it.each([
    single,
    sharedPopulation,
    populations,
    equalPrevalence,
    timeDependent,
    equalRisk,
    sharedPopulationHorizon,
  ])("accepts canonical lift fixtures", (spec) => {
    expect(Value.Check(LiftV2SpecSchema, spec)).toBe(true);
    expect(Value.Check(RtichokeChartSpecV2Schema, spec)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
  });

  it("uses ppcr by lift for model-derived series", () => {
    expect(single).toMatchObject({ x: "ppcr", y: "lift" });
    expect(single.data[0]).toHaveProperty("seriesId", "series-a");
  });

  it("keeps the random guess benchmark global (y=1) and the perfect prediction benchmark population-owned", () => {
    expect(single.references[0]).toMatchObject({ type: "horizontal", value: 1, scope: "global" });
    expect(single.references[1]).toMatchObject({
      type: "path",
      scope: "population",
      population: "Population A",
    });
  });

  it("shares one perfect reference across models evaluated on one population", () => {
    expect(sharedPopulation.series).toHaveLength(2);
    expect(sharedPopulation.references.filter(isPathReference)).toHaveLength(1);
    expect(sharedPopulation.references[0]).toMatchObject({ type: "horizontal", value: 1, scope: "global" });
  });

  it("keeps distinct perfect references for distinct populations", () => {
    const perfect = populations.references.filter(isPathReference);
    expect(perfect.map((x) => x.population)).toEqual(["Population A", "Population B"]);
    expect(perfect.map((x) => x.points[1].x)).toEqual([0.3, 0.5]);
  });

  it("does not collapse equal-prevalence populations with identical path geometry", () => {
    const perfect = equalPrevalence.references.filter(isPathReference);
    expect(perfect).toHaveLength(2);
    expect(perfect[0].points).toEqual(perfect[1].points);
    expect(new Set(perfect.map((x) => x.population))).toEqual(
      new Set(["Population A", "Population B"]),
    );
  });

  it("scopes time-dependent perfect references by population and horizon", () => {
    const perfect = timeDependent.references.filter(isPathReference);
    expect(perfect.map((x) => x.scope)).toEqual([
      "population_horizon",
      "population_horizon",
    ]);
    expect(perfect.map((x) => x.horizon)).toEqual([5, 10]);
    expect(perfect.map((x) => x.points[1].x)).toEqual([0.2, 0.4]);
  });

  it("does not collapse equal-risk population x horizon combinations with identical path geometry", () => {
    const perfect = equalRisk.references.filter(isPathReference);
    expect(perfect).toHaveLength(2);
    expect(perfect[0].points).toEqual(perfect[1].points);
    expect(perfect.map((x) => ({ population: x.population, horizon: x.horizon }))).toEqual([
      { population: "Population A", horizon: 5 },
      { population: "Population B", horizon: 10 },
    ]);
  });

  it("shares one perfect reference across models evaluated on the same population and horizon", () => {
    expect(sharedPopulationHorizon.series).toHaveLength(2);
    const perfect = sharedPopulationHorizon.references.filter(isPathReference);
    expect(perfect).toHaveLength(1);
    expect(perfect[0]).toMatchObject({
      scope: "population_horizon",
      population: "Population X",
      horizon: 5,
    });
  });

  it("selects one horizon without dropping global references", () => {
    const selected = selectHorizonSpec(timeDependent as LiftV2Spec, 10);
    expect(selected.series.map((series) => series.horizon)).toEqual([10]);
    expect(new Set(selected.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-a-10"]),
    );
    expect(selected.references?.map((reference) => reference.scope)).toEqual([
      "global",
      "population_horizon",
    ]);
    expect(selected.references?.[1]).toMatchObject({ horizon: 10 });
  });
});
