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

  it("accepts and validates primary golden rankBins oracle fixture with explicit empty stratum [0.40, 0.60]", () => {
    const goldenRankBinsFixture: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      title: "Golden rankBins Oracle Fixture",
      evaluations: [{ id: "Model A", model: "Model A", population: "Overall" }],
      bins: [
        { evaluationId: "Model A", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 0, nNegative: 0 },
        { evaluationId: "Model A", lower: 0, upper: 0.2, includeLower: false, includeUpper: true, nPositive: 1, nNegative: 1 },
        { evaluationId: "Model A", lower: 0.2, upper: 0.6, includeLower: false, includeUpper: true, nPositive: 2, nNegative: 2 },
        { evaluationId: "Model A", lower: 0.6, upper: 0.8, includeLower: false, includeUpper: true, nPositive: 1, nNegative: 0 },
        { evaluationId: "Model A", lower: 0.8, upper: 1.0, includeLower: false, includeUpper: true, nPositive: 1, nNegative: 1 },
      ],
      rankBins: [
        { evaluationId: "Model A", rankLower: 0.0, rankUpper: 0.2, positiveMass: 1, negativeMass: 1 },
        { evaluationId: "Model A", rankLower: 0.2, rankUpper: 0.4, positiveMass: 2, negativeMass: 2 },
        { evaluationId: "Model A", rankLower: 0.4, rankUpper: 0.6, positiveMass: 0, negativeMass: 0 },
        { evaluationId: "Model A", rankLower: 0.6, rankUpper: 0.8, positiveMass: 1, negativeMass: 0 },
        { evaluationId: "Model A", rankLower: 0.8, rankUpper: 1.0, positiveMass: 1, negativeMass: 1 },
      ],
      operatingPoints: [
        { evaluationId: "Model A", type: "ppcr", value: 0.0, cutoff: 1.0, realizedPpcr: 0.0, performance: [{ metricId: "true_positives", estimate: 0 }, { metricId: "false_positives", estimate: 0 }, { metricId: "true_negatives", estimate: 4 }, { metricId: "false_negatives", estimate: 5 }] },
        { evaluationId: "Model A", type: "ppcr", value: 0.2, cutoff: 0.8, realizedPpcr: 2 / 9, performance: [{ metricId: "true_positives", estimate: 1 }, { metricId: "false_positives", estimate: 1 }, { metricId: "true_negatives", estimate: 3 }, { metricId: "false_negatives", estimate: 4 }] },
        { evaluationId: "Model A", type: "ppcr", value: 0.4, cutoff: 0.6, realizedPpcr: 3 / 9, performance: [{ metricId: "true_positives", estimate: 2 }, { metricId: "false_positives", estimate: 1 }, { metricId: "true_negatives", estimate: 3 }, { metricId: "false_negatives", estimate: 3 }] },
        { evaluationId: "Model A", type: "ppcr", value: 0.6, cutoff: 0.6, realizedPpcr: 3 / 9, performance: [{ metricId: "true_positives", estimate: 2 }, { metricId: "false_positives", estimate: 1 }, { metricId: "true_negatives", estimate: 3 }, { metricId: "false_negatives", estimate: 3 }] },
        { evaluationId: "Model A", type: "ppcr", value: 0.8, cutoff: 0.2, realizedPpcr: 7 / 9, performance: [{ metricId: "true_positives", estimate: 4 }, { metricId: "false_positives", estimate: 3 }, { metricId: "true_negatives", estimate: 1 }, { metricId: "false_negatives", estimate: 1 }] },
        { evaluationId: "Model A", type: "ppcr", value: 1.0, cutoff: 0.0, realizedPpcr: 1.0, performance: [{ metricId: "true_positives", estimate: 5 }, { metricId: "false_positives", estimate: 4 }, { metricId: "true_negatives", estimate: 0 }, { metricId: "false_negatives", estimate: 0 }] },
      ],
    };

    expect(() =>
      assertPredictionDistributionReferentialIntegrity(goldenRankBinsFixture),
    ).not.toThrow();

    // Regression check: Verify complete rank-bin partition matches producer operating-point TP/FP/TN/FN at EVERY grid point
    const grid = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const rankBins = goldenRankBinsFixture.rankBins!;

    for (const p of grid) {
      const cutoffRank = 1 - p;
      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (const bin of rankBins) {
        if (bin.rankLower >= cutoffRank - 1e-9) {
          tp += bin.positiveMass;
          fp += bin.negativeMass;
        } else {
          fn += bin.positiveMass;
          tn += bin.negativeMass;
        }
      }

      const op = goldenRankBinsFixture.operatingPoints.find(item => Math.abs(item.value - p) < 1e-6)!;
      const getPerf = (id: string) => op.performance!.find(item => item.metricId === id)!.estimate!;

      expect(tp).toBe(getPerf("true_positives"));
      expect(fp).toBe(getPerf("false_positives"));
      expect(tn).toBe(getPerf("true_negatives"));
      expect(fn).toBe(getPerf("false_negatives"));
    }
  });

  it("accepts and validates N < q golden rankBins oracle fixture with multiple empty strata", () => {
    const smallNLessQFixture: PredictionDistributionSpec = {
      schemaVersion: "2.0",
      type: "prediction_distribution",
      title: "N < q rankBins Oracle Fixture",
      evaluations: [{ id: "Model A", model: "Model A", population: "Overall" }],
      bins: [
        { evaluationId: "Model A", lower: 0, upper: 0, includeLower: true, includeUpper: true, nPositive: 0, nNegative: 0 },
        { evaluationId: "Model A", lower: 0, upper: 1, includeLower: false, includeUpper: true, nPositive: 2, nNegative: 1 },
      ],
      rankBins: [
        { evaluationId: "Model A", rankLower: 0.0, rankUpper: 0.2, positiveMass: 0, negativeMass: 1 },
        { evaluationId: "Model A", rankLower: 0.2, rankUpper: 0.4, positiveMass: 0, negativeMass: 0 },
        { evaluationId: "Model A", rankLower: 0.4, rankUpper: 0.6, positiveMass: 1, negativeMass: 0 },
        { evaluationId: "Model A", rankLower: 0.6, rankUpper: 0.8, positiveMass: 0, negativeMass: 0 },
        { evaluationId: "Model A", rankLower: 0.8, rankUpper: 1.0, positiveMass: 1, negativeMass: 0 },
      ],
      operatingPoints: [
        { evaluationId: "Model A", type: "probability_threshold", value: 0, cutoff: 0, realizedPpcr: 1 },
        { evaluationId: "Model A", type: "probability_threshold", value: 1, cutoff: 1, realizedPpcr: 0 },
      ],
    };

    expect(() =>
      assertPredictionDistributionReferentialIntegrity(smallNLessQFixture),
    ).not.toThrow();
  });

  it("accepts valid PPCR tie golden fixture with requested != realized PPCR", () => {
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

  it("rejects probability_threshold operating point where value != cutoff", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoints[1].value = 0.25; // cutoff is 0.2
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("probability_threshold value 0.25 must equal cutoff 0.2");
  });

  it("rejects realizedPpcr that does not match reconstructed bin counts", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoints[1].realizedPpcr = 0.99; // correct reconstructed is 4/6 = 0.6666...
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("realizedPpcr 0.99 for evaluation Model A does not match reconstructed count fraction");
  });

  it("rejects top-level operatingPoint.dimension when not present in operatingPoints", () => {
    const invalid: any = JSON.parse(JSON.stringify(thresholdFixture));
    invalid.operatingPoint = { dimension: "ppcr" }; // thresholdFixture only has probability_threshold
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalid),
    ).toThrow("configured operatingPoint dimension ppcr is not present in operatingPoints");
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
