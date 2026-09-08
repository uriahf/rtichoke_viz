import { describe, expect, it } from "vitest";
import thresholdFixture from "../fixtures/v2/prediction-distribution-threshold.json";
import ppcrTieFixture from "../fixtures/v2/prediction-distribution-ppcr-tie.json";
import multiFixture from "../fixtures/v2/prediction-distribution-multi.json";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import { assertPredictionDistributionReferentialIntegrity } from "../src/spec/v2/validate-prediction-distribution.js";

describe("PredictionDistributionSpec Referential Integrity Validation", () => {
  it("accepts valid threshold golden fixture", () => {
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(
        thresholdFixture as PredictionDistributionSpec,
      ),
    ).not.toThrow();
  });

  it("accepts valid PPCR tie golden fixture", () => {
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(
        ppcrTieFixture as PredictionDistributionSpec,
      ),
    ).not.toThrow();
  });

  it("accepts valid multi-evaluation fixture", () => {
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(
        multiFixture as PredictionDistributionSpec,
      ),
    ).not.toThrow();
  });

  it("rejects duplicate evaluation IDs", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.evaluations.push({
      id: "Model A",
      model: "Model A Dup",
      population: "population",
    });
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("duplicate evaluation id");
  });

  it("rejects unknown evaluation ID in bins", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.bins[0].evaluationId = "Unknown Model";
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("unknown evaluation id");
  });

  it("rejects unknown evaluation ID in operating points", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoints[0].evaluationId = "Unknown Model";
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("unknown evaluation id");
  });

  it("rejects when bin 0 is not [0, 0]", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.bins[0].upper = 0.1;
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("first bin for evaluation Model A must be [0, 0]");
  });

  it("rejects non-contiguous bins", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.bins[1].upper = 0.3; // original bin 1 ends at 0.2, bin 2 starts at 0.2
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("contiguous and ascending");
  });

  it("rejects when final bin does not end at 1", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.bins[invalid.bins.length - 1].upper = 0.9;
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("final bin upper bound for evaluation Model A must be 1");
  });

  it("rejects duplicate operating point identities", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoints.push(invalid.operatingPoints[0]);
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("duplicate operating point");
  });

  it("rejects cutoff that does not match a bin upper boundary", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoints.push({
      evaluationId: "Model A",
      type: "probability_threshold",
      value: 0.37,
      cutoff: 0.37,
      realizedPpcr: 0.5,
    });
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("does not match any bin upper boundary");
  });

  it("rejects total count <= 0", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    for (const bin of invalid.bins) {
      bin.nPositive = 0;
      bin.nNegative = 0;
    }
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("total count for evaluation Model A must be positive");
  });
});
