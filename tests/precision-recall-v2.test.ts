import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/precision-recall-equal-prevalence.json" with { type: "json" };
import populations from "../fixtures/v2/precision-recall-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/precision-recall-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import timeDependent from "../fixtures/v2/precision-recall-time.json" with { type: "json" };
import { RtichokeChartSpecV2Schema } from "../src/spec/v2/chart.js";
import { PrecisionRecallV2SpecSchema } from "../src/spec/v2/precision_recall.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

describe("v2 precision-recall semantics", () => {
  it.each([single, sharedPopulation, populations, equalPrevalence, timeDependent])(
    "accepts canonical precision-recall fixtures",
    (spec) => {
      expect(Value.Check(PrecisionRecallV2SpecSchema, spec)).toBe(true);
      expect(Value.Check(RtichokeChartSpecV2Schema, spec)).toBe(true);
      expect(() => assertV2ReferentialIntegrity(spec)).not.toThrow();
    },
  );

  it("shares one population reference across multiple models", () => {
    expect(sharedPopulation.series).toHaveLength(2);
    expect(sharedPopulation.references).toHaveLength(1);
    expect(new Set(sharedPopulation.evaluations.map((x) => x.population))).toEqual(
      new Set(["Population X"]),
    );
  });

  it("keeps distinct population-owned references", () => {
    expect(populations.references.map((x) => x.population)).toEqual([
      "Population A",
      "Population B",
    ]);
    expect(populations.references.map((x) => x.value)).toEqual([0.3, 0.5]);
  });

  it("does not collapse equal-prevalence populations", () => {
    expect(equalPrevalence.references).toHaveLength(2);
    expect(equalPrevalence.references.map((x) => x.value)).toEqual([0.3, 0.3]);
    expect(new Set(equalPrevalence.references.map((x) => x.population))).toEqual(
      new Set(["Population A", "Population B"]),
    );
  });

  it("scopes time-dependent references by population and horizon", () => {
    expect(timeDependent.series.map((x) => x.horizon)).toEqual([5, 10]);
    expect(timeDependent.references.map((x) => x.scope)).toEqual([
      "population_horizon",
      "population_horizon",
    ]);
    expect(timeDependent.references.map((x) => x.horizon)).toEqual([5, 10]);
  });

  it("keeps reference values supplied by the statistical consumer", () => {
    expect(single.references[0]).toMatchObject({
      type: "horizontal",
      value: 0.3,
      scope: "population",
      population: "Population A",
    });
  });
});
