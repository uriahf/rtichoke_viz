import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import generatedV2Schema from "../schemas/rtichoke-viz-v2.schema.json" with { type: "json" };
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import decisionCurve from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import gains from "../fixtures/v2/gains-single.json" with { type: "json" };
import interventionsAvoided from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import lift from "../fixtures/v2/lift-single.json" with { type: "json" };
import precisionRecall from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import predictionDistributionPpcrTie from "../fixtures/v2/prediction-distribution-ppcr-tie.json" with { type: "json" };
import predictionDistributionThreshold from "../fixtures/v2/prediction-distribution-threshold.json" with { type: "json" };
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

  it("matches the generated standalone v2 JSON schema with exactly 8 component types including prediction_distribution", () => {
    expect(generatedV2Schema).toEqual(
      JSON.parse(JSON.stringify(RtichokeChartSpecV2Schema)),
    );
    expect(generatedV2Schema.$id).toBe(
      "https://rtichoke.dev/schema/viz/2.0.json",
    );
    expect(generatedV2Schema.anyOf).toHaveLength(8);

    const supportedTypes = generatedV2Schema.anyOf.map((branch: any) => {
      if (branch.properties?.type?.const) {
        return branch.properties.type.const;
      }
      if (branch.allOf) {
        for (const sub of branch.allOf) {
          if (sub.properties?.type?.const) {
            return sub.properties.type.const;
          }
        }
      }
      return undefined;
    });

    expect(supportedTypes).toEqual([
      "roc",
      "calibration",
      "precision_recall",
      "gains",
      "lift",
      "decision_curve",
      "interventions_avoided",
      "prediction_distribution",
    ]);
  });

  it.each([
    ["roc", roc],
    ["calibration", calibration],
    ["precision_recall", precisionRecall],
    ["gains", gains],
    ["lift", lift],
    ["decision_curve", decisionCurve],
    ["interventions_avoided", interventionsAvoided],
    ["prediction_distribution (threshold)", predictionDistributionThreshold],
    ["prediction_distribution (ppcr tie)", predictionDistributionPpcrTie],
  ])("validates standalone %s spec against RtichokeChartSpecV2Schema", (_name, fixture) => {
    expect(Value.Check(RtichokeChartSpecV2Schema, fixture)).toBe(true);
  });

  it("accepts valid PredictionDistributionSpec with arbitrary extra fields", () => {
    const specWithExtra = copy(predictionDistributionThreshold);
    specWithExtra.extraCustomMetadata = { customProperty: "allowed" };
    expect(Value.Check(RtichokeChartSpecV2Schema, specWithExtra)).toBe(true);
  });

  it("rejects genuinely invalid PredictionDistributionSpec (missing required bins or invalid type)", () => {
    const missingBins = copy(predictionDistributionThreshold);
    delete missingBins.bins;
    expect(Value.Check(RtichokeChartSpecV2Schema, missingBins)).toBe(false);

    const invalidType = copy(predictionDistributionThreshold);
    invalidType.type = "unknown_type";
    expect(Value.Check(RtichokeChartSpecV2Schema, invalidType)).toBe(false);
  });
});
