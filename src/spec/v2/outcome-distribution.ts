import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema } from "./common.js";
import { StateDistributionSchema } from "./state-distribution.js";

export const OutcomeDistributionSpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  type: Type.Literal("outcome_distribution"),
  title: Type.Optional(Type.String()),
  xAxisKind: Type.Optional(Type.Union([Type.Literal("time"), Type.Literal("step")])),
  stateOrder: Type.Optional(Type.Array(Type.String(), { minItems: 1 })),
  evaluations: Type.Array(EvaluationSpecSchema, { minItems: 1 }),
  stateDistributions: Type.Array(StateDistributionSchema, { minItems: 1 }),
});

export type OutcomeDistributionSpec = Static<
  typeof OutcomeDistributionSpecSchema
>;
