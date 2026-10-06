import type { OutcomeDistributionSpec } from "./outcome-distribution.js";
import type { StateDistribution } from "./state-distribution.js";

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

  if (!dist.states || dist.states.length === 0) {
    throw new Error(`states must be non-empty for evaluation ${dist.evaluationId}`);
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

  for (const dist of spec.stateDistributions) {
    assertStateDistributionValid(dist, evaluationIds);
  }
}
