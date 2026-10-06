import { Type, type Static } from "@sinclair/typebox";

export const OutcomeStateSchema = Type.Object({
  stateId: Type.String(),
  label: Type.Optional(Type.String()),
  estimate: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  mass: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  count: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  lower: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  upper: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const StateStratumSchema = Type.Object({
  type: Type.String(),
  lower: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  upper: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  includeLower: Type.Optional(Type.Boolean()),
  includeUpper: Type.Optional(Type.Boolean()),
  rankLower: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  rankUpper: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  operatingPointType: Type.Optional(Type.String()),
  cutoff: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  value: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  realizedPpcr: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const StateDistributionSchema = Type.Object({
  evaluationId: Type.String(),
  horizon: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  estimator: Type.String(),
  stratum: Type.Optional(StateStratumSchema),
  region: Type.Optional(Type.String()),
  censoringHeuristic: Type.Optional(Type.String()),
  competingHeuristic: Type.Optional(Type.String()),
  states: Type.Array(OutcomeStateSchema, { minItems: 1 }),
  regimeId: Type.Optional(Type.String()),
  interventionId: Type.Optional(Type.String()),
  estimand: Type.Optional(Type.String()),
  contrastId: Type.Optional(Type.String()),
});

export type OutcomeState = Static<typeof OutcomeStateSchema>;
export type StateStratum = Static<typeof StateStratumSchema>;
export type StateDistribution = Static<typeof StateDistributionSchema>;
