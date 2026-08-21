import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import { RtichokeChartSpecV2Schema } from "../src/spec/v2/chart.js";
import { CalibrationV2SpecSchema } from "../src/spec/v2/calibration.js";
import { ReferenceLineV2SpecSchema } from "../src/spec/v2/common.js";
import { RocV2SpecSchema } from "../src/spec/v2/roc.js";

function copy<T>(value: T): any {
  return structuredClone(value);
}

describe("rtichoke visualization v2 semantic specs", () => {
  it("accepts ROC with explicit evaluation and series identity", () => {
    expect(Value.Check(RocV2SpecSchema, roc)).toBe(true);
    expect(Value.Check(RtichokeChartSpecV2Schema, roc)).toBe(true);
  });

  it("accepts calibration when model identity is unknown", () => {
    expect("model" in calibration.evaluations[0]).toBe(false);
    expect(Value.Check(CalibrationV2SpecSchema, calibration)).toBe(true);
  });

  it("uses series identity rather than model as the plotted-data key", () => {
    expect(roc.data[0]).toHaveProperty("seriesId", "series-model-a");
    expect(roc.data[0]).not.toHaveProperty("model");
    expect(calibration.distribution[0]).toHaveProperty(
      "seriesId",
      "series-pop-a",
    );
  });

  it("represents two models sharing one population separately from display grouping", () => {
    const sharedPopulation = copy(roc);
    sharedPopulation.evaluations.push({
      id: "eval-model-b",
      model: "Model B",
      population: "population-shared",
      label: "Model B",
    });
    sharedPopulation.series.push({
      id: "series-model-b",
      evaluationId: "eval-model-b",
      display: { label: "Model B", group: "Model B", role: "model" },
    });
    sharedPopulation.data.push({
      seriesId: "series-model-b",
      cutoff: 0.5,
      sensitivity: 0.81,
      specificity: 0.71,
    });

    expect(Value.Check(RocV2SpecSchema, sharedPopulation)).toBe(true);
    expect(
      new Set(sharedPopulation.evaluations.map((evaluation: any) => evaluation.population)),
    ).toEqual(new Set(["population-shared"]));
  });

  it.each([
    [{ type: "identity", scope: "global" }, true],
    [
      {
        type: "horizontal",
        value: 0.2,
        scope: "population",
        population: "Population A",
      },
      true,
    ],
    [
      {
        type: "horizontal",
        value: 0.15,
        scope: "population_horizon",
        population: "Population A",
        horizon: 5,
      },
      true,
    ],
    [{ type: "horizontal", value: 0.2, scope: "population" }, false],
    [
      {
        type: "horizontal",
        value: 0.15,
        scope: "population_horizon",
        population: "Population A",
      },
      false,
    ],
  ])("validates reference ownership %j", (reference, expected) => {
    expect(Value.Check(ReferenceLineV2SpecSchema, reference)).toBe(expected);
  });

  it("keeps the version boundary explicit", () => {
    const oldShape = {
      schemaVersion: "1.0",
      type: "roc",
      data: [
        { model: "Model A", cutoff: 0.5, sensitivity: 0.8, specificity: 0.7 },
      ],
      x: "false_positive_rate",
      y: "sensitivity",
      xAxis: { label: "1 - Specificity", domain: [0, 1] },
      yAxis: { label: "Sensitivity", domain: [0, 1] },
    };

    expect(Value.Check(RtichokeChartSpecV2Schema, oldShape)).toBe(false);
  });
});
