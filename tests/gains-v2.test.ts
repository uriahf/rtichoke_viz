import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/gains-equal-prevalence.json" with { type: "json" };
import populations from "../fixtures/v2/gains-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/gains-single.json" with { type: "json" };
import timeDependent from "../fixtures/v2/gains-time.json" with { type: "json" };
import { RtichokeChartSpecV2Schema, type RtichokeChartSpecV2 } from "../src/spec/v2/chart.js";
import type { ReferenceLineV2Spec } from "../src/spec/v2/common.js";
import { GainsV2SpecSchema } from "../src/spec/v2/gains.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

function isPathReference(
  reference: ReferenceLineV2Spec,
): reference is ReferenceLineV2Spec & { type: "path"; points: Array<{ x: number; y: number }> } {
  return reference.type === "path";
}

describe("v2 gains semantics", () => {
  it.each([single, sharedPopulation, populations, equalPrevalence, timeDependent])(
    "accepts canonical gains fixtures",
    (spec) => {
      expect(Value.Check(GainsV2SpecSchema, spec)).toBe(true);
      expect(Value.Check(RtichokeChartSpecV2Schema, spec)).toBe(true);
      expect(() => assertV2ReferentialIntegrity(spec as RtichokeChartSpecV2)).not.toThrow();
    },
  );

  it("uses ppcr by sensitivity for model-derived series", () => {
    expect(single).toMatchObject({ x: "ppcr", y: "sensitivity" });
    expect(single.data[0]).toHaveProperty("seriesId", "series-a");
  });

  it("keeps the random benchmark global and the perfect benchmark population-owned", () => {
    expect(single.references[0]).toMatchObject({ type: "identity", scope: "global" });
    expect(single.references[1]).toMatchObject({
      type: "path",
      scope: "population",
      population: "Population A",
    });
  });

  it("shares one perfect reference across models evaluated on one population", () => {
    expect(sharedPopulation.series).toHaveLength(2);
    expect(sharedPopulation.references.filter(isPathReference)).toHaveLength(1);
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
});
