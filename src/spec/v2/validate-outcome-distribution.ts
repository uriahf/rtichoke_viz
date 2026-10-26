import type { OutcomeDistributionSpec, PopulationExclusion } from "./outcome-distribution.js";
import type { StateDistribution } from "./state-distribution.js";
import type { HeuristicPairKey } from "./heuristics.js";

const VALID_HEURISTIC_PAIR_KEYS = new Set<HeuristicPairKey>([
  "excluded:excluded",
  "excluded:adjusted_as_censored",
  "excluded:adjusted_as_negative",
  "excluded:adjusted_as_composite",
  "adjusted:excluded",
  "adjusted:adjusted_as_censored",
  "adjusted:adjusted_as_negative",
  "adjusted:adjusted_as_composite",
]);

/** Validate a single PopulationExclusion entry. */
export function assertPopulationExclusionValid(
  exclusion: PopulationExclusion,
  validEvaluationIds?: Set<string>,
): void {
  if (validEvaluationIds && !validEvaluationIds.has(exclusion.evaluationId)) {
    throw new Error(`unknown evaluation id: ${exclusion.evaluationId}`);
  }

  if (
    !Number.isInteger(exclusion.originalSampleSize) ||
    exclusion.originalSampleSize <= 0
  ) {
    throw new Error(
      `originalSampleSize must be a positive integer for evaluation ${exclusion.evaluationId}`,
    );
  }

  const seenHorizons = new Set<number>();
  for (const counts of exclusion.excludedCounts) {
    if (!Number.isFinite(counts.horizon) || counts.horizon < 0) {
      throw new Error(
        `horizon must be non-negative in excludedCounts for evaluation ${exclusion.evaluationId}`,
      );
    }
    if (seenHorizons.has(counts.horizon)) {
      throw new Error(
        `duplicate horizon ${counts.horizon} in excludedCounts for evaluation ${exclusion.evaluationId}`,
      );
    }
    seenHorizons.add(counts.horizon);

    if (
      !Number.isInteger(counts.censoredExcludedCount) ||
      counts.censoredExcludedCount < 0
    ) {
      throw new Error(
        `censoredExcludedCount must be a non-negative integer for evaluation ${exclusion.evaluationId}`,
      );
    }

    if (
      !Number.isInteger(counts.competingExcludedCount) ||
      counts.competingExcludedCount < 0
    ) {
      throw new Error(
        `competingExcludedCount must be a non-negative integer for evaluation ${exclusion.evaluationId}`,
      );
    }

    const totalExcluded =
      counts.censoredExcludedCount + counts.competingExcludedCount;
    if (totalExcluded > exclusion.originalSampleSize) {
      throw new Error(
        `total excluded count (${totalExcluded}) exceeds original sample size (${exclusion.originalSampleSize}) for evaluation ${exclusion.evaluationId} at horizon ${counts.horizon}`,
      );
    }
  }
}

/** Validate a single StateDistribution object. */
export function assertStateDistributionValid(
  dist: StateDistribution,
  validEvaluationIds?: Set<string>,
): void {
  if (validEvaluationIds && !validEvaluationIds.has(dist.evaluationId)) {
    throw new Error(`unknown evaluation id: ${dist.evaluationId}`);
  }

  if (
    dist.horizon !== undefined &&
    dist.horizon !== null &&
    (!Number.isFinite(dist.horizon) || dist.horizon < 0)
  ) {
    throw new Error(
      `horizon must be finite and non-negative for evaluation ${dist.evaluationId}`,
    );
  }

  if (dist.estimateOrigin === "observed_step") {
    if (
      dist.horizon === undefined ||
      dist.horizon === null ||
      !Number.isInteger(dist.horizon) ||
      dist.horizon < 0
    ) {
      throw new Error(
        `step (horizon) must be a non-negative integer for observed_step in evaluation ${dist.evaluationId}`,
      );
    }

    if (dist.estimator !== "raw" && dist.estimator !== "aalen_johansen") {
      throw new Error(
        `unsupported estimator '${dist.estimator}' for observed_step in evaluation ${dist.evaluationId}`,
      );
    }
  }

  if (
    dist.estimateOrigin !== undefined &&
    dist.estimateOrigin !== null &&
    dist.estimateOrigin !== "event_table" &&
    dist.estimateOrigin !== "fixed_time_horizon" &&
    dist.estimateOrigin !== "observed_step"
  ) {
    throw new Error(
      `invalid estimateOrigin '${dist.estimateOrigin}' for evaluation ${dist.evaluationId}`,
    );
  }

  if (!dist.states || dist.states.length === 0) {
    throw new Error(`states must be non-empty for evaluation ${dist.evaluationId}`);
  }

  if (dist.estimateOrigin === "observed_step") {
    if (dist.estimator === "raw") {
      let totalCount = 0;
      for (const state of dist.states) {
        if (state.count === undefined || state.count === null) {
          throw new Error(
            `count is required for state ${state.stateId} when estimator is 'raw' in observed_step`,
          );
        }
        if (!Number.isInteger(state.count) || state.count < 0) {
          throw new Error(
            `count must be a non-negative integer for state ${state.stateId}`,
          );
        }
        totalCount += state.count;
      }
      if (totalCount === 0) {
        throw new Error(
          `total observed count across states must be greater than zero for step ${dist.horizon}`,
        );
      }
    } else if (dist.estimator === "aalen_johansen") {
      let sumEstimate = 0;
      for (const state of dist.states) {
        if (state.estimate === undefined || state.estimate === null) {
          throw new Error(
            `estimate is required for state ${state.stateId} when estimator is 'aalen_johansen' in observed_step`,
          );
        }
        if (
          !Number.isFinite(state.estimate) ||
          state.estimate < 0 ||
          state.estimate > 1
        ) {
          throw new Error(
            `estimate must be a finite probability in [0, 1] for state ${state.stateId}`,
          );
        }
        sumEstimate += state.estimate;
      }
      if (Math.abs(sumEstimate - 1.0) > 1e-8) {
        throw new Error(
          `occupancy estimates across states must sum to 1.0 (got ${sumEstimate}) for step ${dist.horizon}`,
        );
      }
    }
  }

  for (const state of dist.states) {
    if (state.estimate !== undefined && state.estimate !== null) {
      if (
        !Number.isFinite(state.estimate) ||
        state.estimate < 0 ||
        state.estimate > 1
      ) {
        throw new Error(
          `estimate must be a finite probability in [0, 1] for state ${state.stateId}`,
        );
      }
    }

    if (state.lower !== undefined && state.lower !== null) {
      if (!Number.isFinite(state.lower) || state.lower < 0 || state.lower > 1) {
        throw new Error(
          `lower bound must be a finite probability in [0, 1] for state ${state.stateId}`,
        );
      }
    }

    if (state.upper !== undefined && state.upper !== null) {
      if (!Number.isFinite(state.upper) || state.upper < 0 || state.upper > 1) {
        throw new Error(
          `upper bound must be a finite probability in [0, 1] for state ${state.stateId}`,
        );
      }
    }

    if (
      state.lower !== undefined &&
      state.lower !== null &&
      state.upper !== undefined &&
      state.upper !== null
    ) {
      if (state.lower > state.upper) {
        throw new Error(
          `lower bound ${state.lower} cannot exceed upper bound ${state.upper} for state ${state.stateId}`,
        );
      }
    }

    if (state.mass !== undefined && state.mass !== null) {
      if (!Number.isFinite(state.mass) || state.mass < 0) {
        throw new Error(
          `mass must be finite and non-negative for state ${state.stateId}`,
        );
      }
    }

    if (state.count !== undefined && state.count !== null) {
      if (!Number.isInteger(state.count) || state.count < 0) {
        throw new Error(
          `count must be a non-negative integer for state ${state.stateId}`,
        );
      }
    }
  }

  if (dist.stratum) {
    const s = dist.stratum;
    if (
      s.lower !== undefined &&
      s.lower !== null &&
      s.upper !== undefined &&
      s.upper !== null
    ) {
      if (s.lower > s.upper) {
        throw new Error(
          `stratum lower bound ${s.lower} cannot exceed upper bound ${s.upper} for evaluation ${dist.evaluationId}`,
        );
      }
    }

    if (
      s.rankLower !== undefined &&
      s.rankLower !== null &&
      s.rankUpper !== undefined &&
      s.rankUpper !== null
    ) {
      if (s.rankLower > s.rankUpper) {
        throw new Error(
          `stratum rankLower ${s.rankLower} cannot exceed rankUpper ${s.rankUpper} for evaluation ${dist.evaluationId}`,
        );
      }
    }
  }
}

/** Validate cross-object referential integrity for OutcomeDistributionSpec. */
export function assertOutcomeDistributionReferentialIntegrity(
  spec: OutcomeDistributionSpec,
): void {
  const evaluationIds = new Set<string>();
  for (const evaluation of spec.evaluations) {
    if (evaluationIds.has(evaluation.id)) {
      throw new Error(`duplicate evaluation id: ${evaluation.id}`);
    }
    evaluationIds.add(evaluation.id);
  }

  if (!spec.stateDistributions || spec.stateDistributions.length === 0) {
    throw new Error("stateDistributions must be non-empty");
  }

  const seenKeys = new Set<string>();
  const originHorizonKeys = new Set<string>();
  const evalStateOrders = new Map<string, string[]>();
  const explicitLabels = new Map<string, string>();

  const checkAndRegisterStateLabels = (dists: StateDistribution[]) => {
    for (const dist of dists) {
      for (const state of dist.states) {
        if (state.label !== undefined && state.label !== null) {
          const trimmed = state.label.trim();
          if (trimmed !== "") {
            const existing = explicitLabels.get(state.stateId);
            if (existing !== undefined && existing !== trimmed) {
              throw new Error(
                `conflicting explicit labels for state '${state.stateId}': '${existing}' vs '${trimmed}'`,
              );
            }
            explicitLabels.set(state.stateId, trimmed);
          }
        }
      }
    }
  };

  checkAndRegisterStateLabels(spec.stateDistributions);

  for (const dist of spec.stateDistributions) {
    assertStateDistributionValid(dist, evaluationIds);

    const originKey = dist.estimateOrigin ?? "unspecified";
    const horizonKey = `${dist.evaluationId}|${originKey}:${dist.horizon ?? 0}`;
    if (originHorizonKeys.has(horizonKey)) {
      throw new Error(
        `multiple state distributions defined for evaluation ${dist.evaluationId} at step/horizon ${dist.horizon ?? 0}`,
      );
    }
    originHorizonKeys.add(horizonKey);

    if (dist.estimateOrigin === "observed_step") {
      const key = `${dist.evaluationId}|${dist.estimator}|${dist.horizon}|${dist.censoringHeuristic ?? ""}|${dist.competingHeuristic ?? ""}`;
      if (seenKeys.has(key)) {
        throw new Error(
          `duplicate distribution for evaluation ${dist.evaluationId}, estimator ${dist.estimator}, and step ${dist.horizon}`,
        );
      }
      seenKeys.add(key);

      const groupKey = `${dist.evaluationId}|${dist.estimator}`;
      let masterOrder = evalStateOrders.get(groupKey);
      if (!masterOrder) {
        masterOrder = [];
        evalStateOrders.set(groupKey, masterOrder);
      }

      const currentStepOrder = dist.states.map((s) => s.stateId);
      for (let i = 0; i < currentStepOrder.length; i++) {
        const id = currentStepOrder[i];
        if (!masterOrder.includes(id)) {
          masterOrder.push(id);
        }
      }

      for (let i = 0; i < currentStepOrder.length - 1; i++) {
        const idA = currentStepOrder[i];
        const idB = currentStepOrder[i + 1];
        const idxA = masterOrder.indexOf(idA);
        const idxB = masterOrder.indexOf(idB);
        if (idxA > idxB) {
          throw new Error(
            `inconsistent state ordering across steps for evaluation ${dist.evaluationId}`,
          );
        }
      }
    }
  }

  // Validate variants if present
  if (spec.variants) {
    for (const [key, variant] of Object.entries(spec.variants)) {
      if (!VALID_HEURISTIC_PAIR_KEYS.has(key as HeuristicPairKey)) {
        throw new Error(`invalid variant heuristic pair key: '${key}'`);
      }
      if (!variant) continue;

      if (variant.status === "available") {
        if (!variant.stateDistributions || variant.stateDistributions.length === 0) {
          throw new Error(`variant '${key}' stateDistributions must be non-empty`);
        }

          checkAndRegisterStateLabels(variant.stateDistributions);

        const variantOriginHorizonKeys = new Set<string>();
        for (const dist of variant.stateDistributions) {
          assertStateDistributionValid(dist, evaluationIds);

          const originKey = dist.estimateOrigin ?? "unspecified";
          const horizonKey = `${dist.evaluationId}|${originKey}:${dist.horizon ?? 0}`;
          if (variantOriginHorizonKeys.has(horizonKey)) {
            throw new Error(
              `variant '${key}' has multiple state distributions for evaluation ${dist.evaluationId} at step/horizon ${dist.horizon ?? 0}`,
            );
          }
          variantOriginHorizonKeys.add(horizonKey);
        }

        if (variant.exclusions) {
          const exclusionEvalIds = new Set<string>();
          for (const exclusion of variant.exclusions) {
            if (exclusionEvalIds.has(exclusion.evaluationId)) {
              throw new Error(
                `variant '${key}' has duplicate exclusion entry for evaluation ${exclusion.evaluationId}`,
              );
            }
            exclusionEvalIds.add(exclusion.evaluationId);
            assertPopulationExclusionValid(exclusion, evaluationIds);
          }
        }
      }
    }
  }
}
