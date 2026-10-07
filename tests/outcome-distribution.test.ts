import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import type { OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";
import { OutcomeDistributionSpecSchema } from "../src/spec/v2/outcome-distribution.js";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import { PredictionDistributionSpecSchema } from "../src/spec/v2/prediction-distribution.js";
import { assertOutcomeDistributionReferentialIntegrity } from "../src/spec/v2/validate-outcome-distribution.js";
import { assertPredictionDistributionReferentialIntegrity } from "../src/spec/v2/validate-prediction-distribution.js";

describe("OutcomeDistributionSpec", () => {
  const validSpec: OutcomeDistributionSpec = {
    schemaVersion: "2.0",
    type: "outcome_distribution",
    title: "Test Outcome Distribution",
    evaluations: [
      {
        id: "eval-1",
        model: "model-a",
        population: "test-pop",
      },
    ],
    stateDistributions: [
      {
        evaluationId: "eval-1",
        horizon: 5,
        estimator: "aalen_johansen",
        region: "all",
        stratum: {
          type: "all",
          lower: 0,
          upper: 1,
          rankLower: 0,
          rankUpper: 1,
        },
        states: [
          {
            stateId: "real_positive",
            label: "Event A",
            estimate: 0.25,
            lower: 0.2,
            upper: 0.3,
            mass: 250,
            count: 250,
          },
          {
            stateId: "real_competing",
            label: "Competing Risk",
            estimate: 0.1,
            lower: 0.05,
            upper: 0.15,
            mass: 100,
            count: 100,
          },
          {
            stateId: "real_censored",
            label: "Censored",
            estimate: 0.05,
            lower: 0.02,
            upper: 0.08,
            mass: 50,
            count: 50,
          },
          {
            stateId: "real_negative",
            label: "Event Free",
            estimate: 0.6,
            lower: 0.55,
            upper: 0.65,
            mass: 600,
            count: 600,
          },
        ],
      },
    ],
  };

  it("validates a well-formed outcome distribution spec", () => {
    expect(Value.Check(OutcomeDistributionSpecSchema, validSpec)).toBe(true);
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(validSpec),
    ).not.toThrow();
  });

  it("validates OutcomeDistributionSpec with estimateOrigin: 'event_table'", () => {
    const spec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          estimateOrigin: "event_table",
        },
      ],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, spec)).toBe(true);
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(spec),
    ).not.toThrow();
  });

  it("validates OutcomeDistributionSpec with estimateOrigin: 'fixed_time_horizon'", () => {
    const spec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          estimateOrigin: "fixed_time_horizon",
        },
      ],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, spec)).toBe(true);
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(spec),
    ).not.toThrow();
  });

  it("validates OutcomeDistributionSpec when estimateOrigin is omitted", () => {
    const spec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          estimateOrigin: undefined,
        },
      ],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, spec)).toBe(true);
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(spec),
    ).not.toThrow();
  });

  it("fails TypeBox check and referential integrity on unknown estimateOrigin values", () => {
    const specInvalidValue = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          estimateOrigin: "trajectory",
        },
      ],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, specInvalidValue)).toBe(
      false,
    );
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(
        specInvalidValue as unknown as OutcomeDistributionSpec,
      ),
    ).toThrow("invalid estimateOrigin 'trajectory'");

    const specInvalidPlural = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          estimateOrigin: "fixed_time_horizons",
        },
      ],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, specInvalidPlural)).toBe(
      false,
    );
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(
        specInvalidPlural as unknown as OutcomeDistributionSpec,
      ),
    ).toThrow("invalid estimateOrigin 'fixed_time_horizons'");
  });

  it("throws on duplicate evaluation id", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      evaluations: [
        { id: "eval-1", population: "pop1" },
        { id: "eval-1", population: "pop2" },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("duplicate evaluation id: eval-1");
  });

  it("throws on unknown evaluation id in stateDistributions", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          evaluationId: "eval-unknown",
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("unknown evaluation id: eval-unknown");
  });

  it("throws on invalid horizon (negative)", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          horizon: -1,
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("horizon must be finite and non-negative");
  });

  it("throws on invalid estimate out of [0, 1]", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          states: [
            {
              stateId: "real_positive",
              estimate: 1.5,
            },
          ],
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("estimate must be a finite probability in [0, 1]");
  });

  it("throws when state lower bound > upper bound", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          states: [
            {
              stateId: "real_positive",
              lower: 0.8,
              upper: 0.2,
            },
          ],
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("lower bound 0.8 cannot exceed upper bound 0.2");
  });

  it("throws on negative mass", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          states: [
            {
              stateId: "real_positive",
              mass: -10,
            },
          ],
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("mass must be finite and non-negative");
  });

  it("throws on non-integer or negative count", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          states: [
            {
              stateId: "real_positive",
              count: 2.5,
            },
          ],
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("count must be a non-negative integer");
  });

  it("throws when stratum lower > upper", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          stratum: {
            type: "probability_bin",
            lower: 0.8,
            upper: 0.2,
          },
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("stratum lower bound 0.8 cannot exceed upper bound 0.2");
  });

  it("throws when stratum rankLower > rankUpper", () => {
    const invalidSpec: OutcomeDistributionSpec = {
      ...validSpec,
      stateDistributions: [
        {
          ...validSpec.stateDistributions[0],
          stratum: {
            type: "rank_bin",
            rankLower: 0.9,
            rankUpper: 0.1,
          },
        },
      ],
    };
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("stratum rankLower 0.9 cannot exceed rankUpper 0.1");
  });
});

describe("PredictionDistributionSpec with stateDistributions", () => {
  const validPredDistSpec: PredictionDistributionSpec = {
    schemaVersion: "2.0",
    type: "prediction_distribution",
    evaluations: [
      {
        id: "eval-1",
        model: "model-a",
        population: "test-pop",
      },
    ],
    bins: [
      {
        evaluationId: "eval-1",
        lower: 0,
        upper: 0,
        includeLower: true,
        includeUpper: true,
        nPositive: 0,
        nNegative: 10,
      },
      {
        evaluationId: "eval-1",
        lower: 0,
        upper: 1,
        includeLower: false,
        includeUpper: true,
        nPositive: 40,
        nNegative: 50,
      },
    ],
    operatingPoints: [
      {
        evaluationId: "eval-1",
        type: "probability_threshold",
        value: 0,
        cutoff: 0,
        realizedPpcr: 1.0,
      },
    ],
    stateDistributions: [
      {
        evaluationId: "eval-1",
        horizon: 10,
        estimator: "aalen_johansen",
        states: [
          {
            stateId: "real_positive",
            estimate: 0.4,
            mass: 40,
          },
          {
            stateId: "real_negative",
            estimate: 0.6,
            mass: 60,
          },
        ],
      },
    ],
  };

  it("validates prediction distribution spec with valid stateDistributions", () => {
    expect(
      Value.Check(PredictionDistributionSpecSchema, validPredDistSpec),
    ).toBe(true);
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(validPredDistSpec),
    ).not.toThrow();
  });

  it("fails referential integrity when stateDistributions references unknown evaluationId", () => {
    const invalidSpec: PredictionDistributionSpec = {
      ...validPredDistSpec,
      stateDistributions: [
        {
          evaluationId: "eval-unknown",
          estimator: "raw",
          states: [{ stateId: "real_positive", estimate: 0.5 }],
        },
      ],
    };
    expect(() =>
      assertPredictionDistributionReferentialIntegrity(invalidSpec),
    ).toThrow("unknown evaluation id: eval-unknown");
  });
});
