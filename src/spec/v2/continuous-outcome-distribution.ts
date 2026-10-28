import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema } from "./common.js";

export const ContinuousDistributionItemSchema = Type.Object({
  evaluationId: Type.String(),
  step: Type.Integer({ minimum: 0 }),
  referenceSampleSize: Type.Integer({ minimum: 1 }),
  observedCount: Type.Integer({ minimum: 0 }),
  unobservedCount: Type.Integer({ minimum: 0 }),
  binCounts: Type.Array(Type.Integer({ minimum: 0 })),
});

export const ContinuousOutcomeDistributionSpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  type: Type.Literal("continuous_outcome_distribution"),
  title: Type.Optional(Type.String()),
  xAxisKind: Type.Literal("step"),
  estimator: Type.Literal("raw"),
  binEdges: Type.Array(Type.Number(), { minItems: 2 }),
  evaluations: Type.Array(EvaluationSpecSchema, { minItems: 1 }),
  distributions: Type.Array(ContinuousDistributionItemSchema, { minItems: 1 }),
});

export type ContinuousDistributionItem = Static<
  typeof ContinuousDistributionItemSchema
>;
export type ContinuousOutcomeDistributionSpec = Static<
  typeof ContinuousOutcomeDistributionSpecSchema
>;
