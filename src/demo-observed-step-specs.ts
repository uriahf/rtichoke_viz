import type { OutcomeDistributionSpec } from "./spec/v2/outcome-distribution.js";

// Example 1: Raw / Excluded Counts (Multi-step with nonconsecutive steps 1, 2, 3, 5)
export const observedStepRawSpec: OutcomeDistributionSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step Distribution — Raw / Excluded Counts (Steps 1, 2, 3, 5)",
  stateScale: "nominal",
  evaluations: [
    {
      id: "eval-raw-demo",
      model: "Model A",
      population: "Test",
    },
  ],
  stateDistributions: [
    {
      evaluationId: "eval-raw-demo",
      horizon: 1,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", label: "Remission", count: 80 },
        { stateId: "relapse", label: "Relapse", count: 15 },
        { stateId: "death", label: "Death", count: 5 },
      ],
    },
    {
      evaluationId: "eval-raw-demo",
      horizon: 2,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", label: "Remission", count: 65 },
        { stateId: "relapse", label: "Relapse", count: 25 },
        { stateId: "death", label: "Death", count: 10 },
      ],
    },
    {
      evaluationId: "eval-raw-demo",
      horizon: 3,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", label: "Remission", count: 50 },
        { stateId: "relapse", label: "Relapse", count: 30 },
        { stateId: "death", label: "Death", count: 20 },
      ],
    },
    {
      evaluationId: "eval-raw-demo",
      horizon: 5,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", label: "Remission", count: 35 },
        { stateId: "relapse", label: "Relapse", count: 35 },
        { stateId: "death", label: "Death", count: 30 },
      ],
    },
  ],
};

// Example 2: AJ-Adjusted Occupancy Probabilities
export const observedStepAjSpec: OutcomeDistributionSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step Distribution — AJ-Adjusted State Occupancy",
  stateScale: "nominal",
  evaluations: [
    {
      id: "eval-aj-demo",
      model: "Model A",
      population: "Validation",
    },
  ],
  stateDistributions: [
    {
      evaluationId: "eval-aj-demo",
      horizon: 1,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_a", label: "Stable", estimate: 0.85 },
        { stateId: "state_b", label: "Progression", estimate: 0.1 },
        { stateId: "state_c", label: "Terminal", estimate: 0.05 },
      ],
    },
    {
      evaluationId: "eval-aj-demo",
      horizon: 2,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_a", label: "Stable", estimate: 0.7 },
        { stateId: "state_b", label: "Progression", estimate: 0.2 },
        { stateId: "state_c", label: "Terminal", estimate: 0.1 },
      ],
    },
    {
      evaluationId: "eval-aj-demo",
      horizon: 3,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_a", label: "Stable", estimate: 0.55 },
        { stateId: "state_b", label: "Progression", estimate: 0.28 },
        { stateId: "state_c", label: "Terminal", estimate: 0.17 },
      ],
    },
    {
      evaluationId: "eval-aj-demo",
      horizon: 4,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_a", label: "Stable", estimate: 0.42 },
        { stateId: "state_b", label: "Progression", estimate: 0.33 },
        { stateId: "state_c", label: "Terminal", estimate: 0.25 },
      ],
    },
  ],
};

// Example 3: Ordinal States (5 Levels using True Blue palette)
export const observedStepOrdinalSpec: OutcomeDistributionSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step Distribution — Ordinal States (5 Levels, True Blue Palette)",
  stateScale: "ordinal",
  evaluations: [
    {
      id: "eval-ordinal-demo",
      model: "Severity Predictor",
      population: "Cohort 1",
    },
  ],
  stateDistributions: [
    {
      evaluationId: "eval-ordinal-demo",
      horizon: 1,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "stage_1", label: "Stage I (Mild)", count: 250 },
        { stateId: "stage_2", label: "Stage II (Moderate)", count: 300 },
        { stateId: "stage_3", label: "Stage III (Severe)", count: 250 },
        { stateId: "stage_4", label: "Stage IV (Critical)", count: 120 },
        { stateId: "stage_5", label: "Stage V (Terminal)", count: 80 },
      ],
    },
    {
      evaluationId: "eval-ordinal-demo",
      horizon: 2,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "stage_1", label: "Stage I (Mild)", count: 180 },
        { stateId: "stage_2", label: "Stage II (Moderate)", count: 280 },
        { stateId: "stage_3", label: "Stage III (Severe)", count: 290 },
        { stateId: "stage_4", label: "Stage IV (Critical)", count: 150 },
        { stateId: "stage_5", label: "Stage V (Terminal)", count: 100 },
      ],
    },
    {
      evaluationId: "eval-ordinal-demo",
      horizon: 3,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "stage_1", label: "Stage I (Mild)", count: 120 },
        { stateId: "stage_2", label: "Stage II (Moderate)", count: 220 },
        { stateId: "stage_3", label: "Stage III (Severe)", count: 310 },
        { stateId: "stage_4", label: "Stage IV (Critical)", count: 200 },
        { stateId: "stage_5", label: "Stage V (Terminal)", count: 150 },
      ],
    },
  ],
};

// Example 4: Nominal States (6 Levels using Colorful Minimal palette)
export const observedStepNominalSpec: OutcomeDistributionSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step Distribution — Nominal States (6 Levels, Colorful Minimal Palette)",
  stateScale: "nominal",
  evaluations: [
    {
      id: "eval-nominal-demo",
      model: "Multi-State Model",
      population: "Registry",
    },
  ],
  stateDistributions: [
    {
      evaluationId: "eval-nominal-demo",
      horizon: 1,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_home", label: "Home", count: 400 },
        { stateId: "state_outpatient", label: "Outpatient", count: 250 },
        { stateId: "state_ward", label: "General Ward", count: 180 },
        { stateId: "state_icu", label: "ICU", count: 80 },
        { stateId: "state_rehab", label: "Rehabilitation", count: 60 },
        { stateId: "state_discharged", label: "Transferred", count: 30 },
      ],
    },
    {
      evaluationId: "eval-nominal-demo",
      horizon: 2,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_home", label: "Home", count: 350 },
        { stateId: "state_outpatient", label: "Outpatient", count: 220 },
        { stateId: "state_ward", label: "General Ward", count: 190 },
        { stateId: "state_icu", label: "ICU", count: 100 },
        { stateId: "state_rehab", label: "Rehabilitation", count: 90 },
        { stateId: "state_discharged", label: "Transferred", count: 50 },
      ],
    },
    {
      evaluationId: "eval-nominal-demo",
      horizon: 3,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "state_home", label: "Home", count: 310 },
        { stateId: "state_outpatient", label: "Outpatient", count: 200 },
        { stateId: "state_ward", label: "General Ward", count: 180 },
        { stateId: "state_icu", label: "ICU", count: 120 },
        { stateId: "state_rehab", label: "Rehabilitation", count: 110 },
        { stateId: "state_discharged", label: "Transferred", count: 80 },
      ],
    },
  ],
};
