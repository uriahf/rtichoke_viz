import type {
  PredictionDistributionBin,
  PredictionDistributionOperatingPoint,
  PredictionDistributionSpec,
} from "./prediction-distribution.js";

export function assertPredictionDistributionReferentialIntegrity(
  spec: PredictionDistributionSpec,
): void {
  // Validate preferred top-level dimension exists in operatingPoints if present
  if (spec.operatingPoint?.dimension) {
    const prefDim = spec.operatingPoint.dimension;
    const hasPrefDim = spec.operatingPoints.some((op) => op.type === prefDim);
    if (!hasPrefDim) {
      throw new Error(
        `configured operatingPoint dimension ${prefDim} is not present in operatingPoints`,
      );
    }
  }

  const evaluationIds = new Set<string>();
  for (const evaluation of spec.evaluations) {
    if (evaluationIds.has(evaluation.id)) {
      throw new Error(`duplicate evaluation id: ${evaluation.id}`);
    }
    evaluationIds.add(evaluation.id);
  }

  const binsByEvaluation = new Map<string, PredictionDistributionBin[]>();
  for (const bin of spec.bins) {
    if (!evaluationIds.has(bin.evaluationId)) {
      throw new Error(`unknown evaluation id: ${bin.evaluationId}`);
    }
    let evalBins = binsByEvaluation.get(bin.evaluationId);
    if (!evalBins) {
      evalBins = [];
      binsByEvaluation.set(bin.evaluationId, evalBins);
    }
    evalBins.push(bin);
  }

  const opsByEvaluation = new Map<
    string,
    PredictionDistributionOperatingPoint[]
  >();
  const opKeys = new Set<string>();
  for (const op of spec.operatingPoints) {
    if (!evaluationIds.has(op.evaluationId)) {
      throw new Error(`unknown evaluation id: ${op.evaluationId}`);
    }
    const opKey = `${op.evaluationId}\u0000${op.type}\u0000${op.value}`;
    if (opKeys.has(opKey)) {
      throw new Error(
        `duplicate operating point: evaluationId=${op.evaluationId}, type=${op.type}, value=${op.value}`,
      );
    }
    opKeys.add(opKey);

    if (
      !Number.isFinite(op.value) ||
      op.value < 0 ||
      op.value > 1 ||
      !Number.isFinite(op.cutoff) ||
      op.cutoff < 0 ||
      op.cutoff > 1 ||
      !Number.isFinite(op.realizedPpcr) ||
      op.realizedPpcr < 0 ||
      op.realizedPpcr > 1
    ) {
      throw new Error(
        `invalid operating point bounds for evaluation ${op.evaluationId}`,
      );
    }

    // Require value == cutoff for probability_threshold operating points
    if (op.type === "probability_threshold") {
      if (Math.abs(op.value - op.cutoff) > 1e-9) {
        throw new Error(
          `probability_threshold value ${op.value} must equal cutoff ${op.cutoff} for evaluation ${op.evaluationId}`,
        );
      }
    }

    let evalOps = opsByEvaluation.get(op.evaluationId);
    if (!evalOps) {
      evalOps = [];
      opsByEvaluation.set(op.evaluationId, evalOps);
    }
    evalOps.push(op);
  }

  for (const evalId of evaluationIds) {
    const bins = binsByEvaluation.get(evalId);
    if (!bins || bins.length === 0) {
      throw new Error(`evaluation ${evalId} has no bins`);
    }

    const ops = opsByEvaluation.get(evalId);
    if (!ops || ops.length === 0) {
      throw new Error(`evaluation ${evalId} has no operating points`);
    }

    // Check bin 0 is [0, 0]
    const bin0 = bins[0];
    if (
      bin0.lower !== 0 ||
      bin0.upper !== 0 ||
      bin0.includeLower !== true ||
      bin0.includeUpper !== true
    ) {
      throw new Error(`first bin for evaluation ${evalId} must be [0, 0]`);
    }

    const binUppers = new Set<number>([0]);
    let totalCount = bin0.nPositive + bin0.nNegative;

    if (
      !Number.isInteger(bin0.nPositive) ||
      bin0.nPositive < 0 ||
      !Number.isInteger(bin0.nNegative) ||
      bin0.nNegative < 0
    ) {
      throw new Error(`invalid bin counts for evaluation ${evalId}`);
    }

    for (let i = 1; i < bins.length; i++) {
      const bin = bins[i];
      if (
        !Number.isFinite(bin.lower) ||
        bin.lower < 0 ||
        bin.lower > 1 ||
        !Number.isFinite(bin.upper) ||
        bin.upper < 0 ||
        bin.upper > 1
      ) {
        throw new Error(`invalid bin bounds for evaluation ${evalId}`);
      }

      if (
        !Number.isInteger(bin.nPositive) ||
        bin.nPositive < 0 ||
        !Number.isInteger(bin.nNegative) ||
        bin.nNegative < 0
      ) {
        throw new Error(`invalid bin counts for evaluation ${evalId}`);
      }

      if (bin.includeLower !== false || bin.includeUpper !== true) {
        throw new Error(
          `bin ${i} for evaluation ${evalId} must be (lower, upper]`,
        );
      }

      if (bin.lower >= bin.upper) {
        throw new Error(
          `bin ${i} for evaluation ${evalId} must be nondegenerate`,
        );
      }

      if (bin.lower !== bins[i - 1].upper) {
        throw new Error(
          `bins for evaluation ${evalId} must be contiguous and ascending`,
        );
      }

      binUppers.add(bin.upper);
      totalCount += bin.nPositive + bin.nNegative;
    }

    if (bins[bins.length - 1].upper !== 1) {
      throw new Error(
        `final bin upper bound for evaluation ${evalId} must be 1`,
      );
    }

    if (totalCount <= 0) {
      throw new Error(`total count for evaluation ${evalId} must be positive`);
    }

    // Match operating-point cutoff to canonical interval upper boundary and validate realizedPpcr
    for (const op of ops) {
      if (op.type === "probability_threshold") {
        if (op.cutoff !== 0 && !binUppers.has(op.cutoff)) {
          throw new Error(
            `operating point cutoff ${op.cutoff} for evaluation ${evalId} does not match any bin upper boundary`,
          );
        }

        // Reconstruct predicted positive count from canonical bins
        let predictedPositive = 0;
        if (op.cutoff === 0) {
          // Cutoff zero: everyone is predicted positive
          predictedPositive = totalCount;
        } else {
          // Nonzero cutoff: predicted positive if bin upper > cutoff
          for (const bin of bins) {
            if (bin.upper > op.cutoff) {
              predictedPositive += bin.nPositive + bin.nNegative;
            }
          }
        }

        const expectedRealizedPpcr = predictedPositive / totalCount;
        if (Math.abs(op.realizedPpcr - expectedRealizedPpcr) > 1e-6) {
          throw new Error(
            `operating point realizedPpcr ${op.realizedPpcr} for evaluation ${evalId} does not match reconstructed count fraction ${expectedRealizedPpcr}`,
          );
        }
      }
    }
  }
}
