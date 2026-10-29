import type { ContinuousOutcomeDistributionSpec } from "./continuous-outcome-distribution.js";

/**
 * Validate both schema shape and cross-field statistical consistency for ContinuousOutcomeDistributionSpec.
 */
export function assertContinuousOutcomeDistributionReferentialIntegrity(
  spec: ContinuousOutcomeDistributionSpec,
): void {
  if (spec.schemaVersion !== "2.0") {
    throw new Error(`schemaVersion must be '2.0', got '${spec.schemaVersion}'`);
  }

  if (spec.type !== "continuous_outcome_distribution") {
    throw new Error(`type must be 'continuous_outcome_distribution', got '${spec.type}'`);
  }

  if (spec.xAxisKind !== "step") {
    throw new Error(`xAxisKind must be 'step', got '${spec.xAxisKind}'`);
  }

  if (spec.estimator !== "raw") {
    throw new Error(`estimator must be 'raw', got '${spec.estimator}'`);
  }

  // binEdges validation: at least 2 finite numbers, strictly increasing
  if (!Array.isArray(spec.binEdges) || spec.binEdges.length < 2) {
    throw new Error("binEdges must contain at least two numbers");
  }

  for (let i = 0; i < spec.binEdges.length; i++) {
    const edge = spec.binEdges[i];
    if (typeof edge !== "number" || !Number.isFinite(edge)) {
      throw new Error(`binEdges contains non-finite value at index ${i}`);
    }
    if (i > 0 && edge <= spec.binEdges[i - 1]) {
      throw new Error(
        `binEdges must be strictly increasing, but index ${i} (${edge}) is <= index ${i - 1} (${spec.binEdges[i - 1]})`,
      );
    }
  }

  const expectedBinCount = spec.binEdges.length - 1;

  // evaluations validation: unique evaluation IDs
  const evaluationIds = new Set<string>();
  for (const evaluation of spec.evaluations) {
    if (evaluationIds.has(evaluation.id)) {
      throw new Error(`duplicate evaluation id: '${evaluation.id}'`);
    }
    evaluationIds.add(evaluation.id);
  }

  if (!Array.isArray(spec.distributions) || spec.distributions.length === 0) {
    throw new Error("distributions must be non-empty");
  }

  const seenEvalStep = new Set<string>();
  const evalRefSizes = new Map<string, number>();
  const evalStepsSeen = new Map<string, Set<number>>();

  for (const dist of spec.distributions) {
    if (!evaluationIds.has(dist.evaluationId)) {
      throw new Error(`unknown evaluation id: '${dist.evaluationId}'`);
    }

    if (!Number.isInteger(dist.step) || dist.step < 0) {
      throw new Error(`step must be a non-negative integer for evaluation '${dist.evaluationId}'`);
    }

    const key = `${dist.evaluationId}|${dist.step}`;
    if (seenEvalStep.has(key)) {
      throw new Error(
        `duplicate (evaluationId, step) combination: ('${dist.evaluationId}', ${dist.step})`,
      );
    }
    seenEvalStep.add(key);

    let stepsSeen = evalStepsSeen.get(dist.evaluationId);
    if (!stepsSeen) {
      stepsSeen = new Set<number>();
      evalStepsSeen.set(dist.evaluationId, stepsSeen);
    }
    stepsSeen.add(dist.step);

    if (!Number.isInteger(dist.referenceSampleSize) || dist.referenceSampleSize <= 0) {
      throw new Error(
        `referenceSampleSize must be a positive integer for evaluation '${dist.evaluationId}' at step ${dist.step}`,
      );
    }

    // Check constant referenceSampleSize within an evaluation
    const prevRefSize = evalRefSizes.get(dist.evaluationId);
    if (prevRefSize !== undefined && prevRefSize !== dist.referenceSampleSize) {
      throw new Error(
        `referenceSampleSize must be constant across steps for evaluation '${dist.evaluationId}' (expected ${prevRefSize}, got ${dist.referenceSampleSize})`,
      );
    }
    evalRefSizes.set(dist.evaluationId, dist.referenceSampleSize);

    if (!Number.isInteger(dist.observedCount) || dist.observedCount < 0) {
      throw new Error(
        `observedCount must be a non-negative integer for evaluation '${dist.evaluationId}' at step ${dist.step}`,
      );
    }

    if (!Number.isInteger(dist.unobservedCount) || dist.unobservedCount < 0) {
      throw new Error(
        `unobservedCount must be a non-negative integer for evaluation '${dist.evaluationId}' at step ${dist.step}`,
      );
    }

    if (dist.observedCount + dist.unobservedCount !== dist.referenceSampleSize) {
      throw new Error(
        `observedCount (${dist.observedCount}) + unobservedCount (${dist.unobservedCount}) must equal referenceSampleSize (${dist.referenceSampleSize}) for evaluation '${dist.evaluationId}' at step ${dist.step}`,
      );
    }

    if (!Array.isArray(dist.binCounts) || dist.binCounts.length !== expectedBinCount) {
      throw new Error(
        `binCounts must have length ${expectedBinCount} (binEdges - 1) for evaluation '${dist.evaluationId}' at step ${dist.step}, got ${dist.binCounts ? dist.binCounts.length : 0}`,
      );
    }

    let sumBinCounts = 0;
    for (let i = 0; i < dist.binCounts.length; i++) {
      const cnt = dist.binCounts[i];
      if (!Number.isInteger(cnt) || cnt < 0) {
        throw new Error(
          `binCount at index ${i} must be a non-negative integer for evaluation '${dist.evaluationId}' at step ${dist.step}`,
        );
      }
      sumBinCounts += cnt;
    }

    if (sumBinCounts !== dist.observedCount) {
      throw new Error(
        `sum(binCounts) (${sumBinCounts}) must equal observedCount (${dist.observedCount}) for evaluation '${dist.evaluationId}' at step ${dist.step}`,
      );
    }

    if (dist.observedCount === 0) {
      for (let i = 0; i < dist.binCounts.length; i++) {
        if (dist.binCounts[i] !== 0) {
          throw new Error(
            `for observedCount == 0, all binCounts must be 0 for evaluation '${dist.evaluationId}' at step ${dist.step}`,
          );
        }
      }
    }
  }

  // Verify that every declared evaluation has at least one distribution
  for (const evalId of evaluationIds) {
    if (!evalStepsSeen.has(evalId) || evalStepsSeen.get(evalId)!.size === 0) {
      throw new Error(`evaluation '${evalId}' has no distributions defined`);
    }
  }
}
