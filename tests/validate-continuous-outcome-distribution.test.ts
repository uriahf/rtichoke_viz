import { describe, expect, it } from "vitest";
import type { ContinuousOutcomeDistributionSpec } from "../src/spec/v2/continuous-outcome-distribution.js";
import { assertContinuousOutcomeDistributionReferentialIntegrity } from "../src/spec/v2/validate-continuous-outcome-distribution.js";

describe("ContinuousOutcomeDistributionSpec validation", () => {
  const validSpec: ContinuousOutcomeDistributionSpec = {
    schemaVersion: "2.0",
    type: "continuous_outcome_distribution",
    title: "Longitudinal Outcome Distribution",
    xAxisKind: "step",
    estimator: "raw",
    binEdges: [0, 0.25, 0.5, 0.75, 1.0],
    evaluations: [
      { id: "train", population: "Train" },
      { id: "test", population: "Test" },
    ],
    distributions: [
      {
        evaluationId: "train",
        step: 0,
        referenceSampleSize: 100,
        observedCount: 95,
        unobservedCount: 5,
        binCounts: [10, 20, 40, 25],
      },
      {
        evaluationId: "train",
        step: 1,
        referenceSampleSize: 100,
        observedCount: 90,
        unobservedCount: 10,
        binCounts: [10, 15, 35, 30],
      },
      {
        evaluationId: "test",
        step: 0,
        referenceSampleSize: 80,
        observedCount: 80,
        unobservedCount: 0,
        binCounts: [5, 15, 35, 25],
      },
    ],
  };

  it("accepts a valid multi-evaluation spec", () => {
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(validSpec)).not.toThrow();
  });

  it("accepts nonuniform bin edges and negative outcome values", () => {
    const nonuniformSpec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      binEdges: [-10, -5, 0, 10, 100],
      distributions: [
        {
          evaluationId: "train",
          step: 5,
          referenceSampleSize: 50,
          observedCount: 50,
          unobservedCount: 0,
          binCounts: [5, 10, 20, 15],
        },
        {
          evaluationId: "test",
          step: 5,
          referenceSampleSize: 40,
          observedCount: 40,
          unobservedCount: 0,
          binCounts: [4, 8, 16, 12],
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(nonuniformSpec)).not.toThrow();
  });

  it("accepts observedCount == 0 with all zero binCounts", () => {
    const zeroObservedSpec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 0,
          unobservedCount: 100,
          binCounts: [0, 0, 0, 0],
        },
        {
          evaluationId: "test",
          step: 0,
          referenceSampleSize: 80,
          observedCount: 80,
          unobservedCount: 0,
          binCounts: [5, 15, 35, 25],
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(zeroObservedSpec)).not.toThrow();
  });

  it("rejects non-strictly increasing binEdges", () => {
    const spec = { ...validSpec, binEdges: [0, 0.5, 0.25, 1.0] };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /binEdges must be strictly increasing/,
    );
  });

  it("rejects duplicate (evaluationId, step) combinations", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        validSpec.distributions[0],
        validSpec.distributions[0], // Duplicate
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /duplicate \(evaluationId, step\) combination/,
    );
  });

  it("rejects mismatch between observed + unobserved and referenceSampleSize", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        {
          ...validSpec.distributions[0],
          observedCount: 90,
          unobservedCount: 5, // 90 + 5 != 100
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /must equal referenceSampleSize/,
    );
  });

  it("rejects sum(binCounts) != observedCount", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        {
          ...validSpec.distributions[0],
          binCounts: [10, 10, 10, 10], // sum 40 != 95
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /sum\(binCounts\) .* must equal observedCount/,
    );
  });

  it("rejects non-zero binCounts when observedCount == 0", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 0,
          unobservedCount: 100,
          binCounts: [0, 1, 0, 0], // Non-zero count
        },
        {
          evaluationId: "test",
          step: 0,
          referenceSampleSize: 80,
          observedCount: 80,
          unobservedCount: 0,
          binCounts: [5, 15, 35, 25],
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /sum\(binCounts\) .* must equal observedCount/,
    );
  });

  it("rejects inconsistent referenceSampleSize across steps within an evaluation", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      distributions: [
        {
          evaluationId: "train",
          step: 0,
          referenceSampleSize: 100,
          observedCount: 95,
          unobservedCount: 5,
          binCounts: [10, 20, 40, 25],
        },
        {
          evaluationId: "train",
          step: 1,
          referenceSampleSize: 150, // Changed referenceSampleSize
          observedCount: 140,
          unobservedCount: 10,
          binCounts: [20, 30, 50, 40],
        },
        {
          evaluationId: "test",
          step: 0,
          referenceSampleSize: 80,
          observedCount: 80,
          unobservedCount: 0,
          binCounts: [5, 15, 35, 25],
        },
      ],
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /referenceSampleSize must be constant across steps/,
    );
  });

  it("rejects evaluations with no distributions defined", () => {
    const spec: ContinuousOutcomeDistributionSpec = {
      ...validSpec,
      evaluations: [
        { id: "train", population: "Train" },
        { id: "test", population: "Test" },
        { id: "val", population: "Validation" },
      ],
      // distributions only covers train and test, missing val
    };
    expect(() => assertContinuousOutcomeDistributionReferentialIntegrity(spec)).toThrow(
      /evaluation 'val' has no distributions defined/,
    );
  });
});
