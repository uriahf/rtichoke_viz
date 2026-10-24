import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema } from "./common.js";
import { StateDistributionSchema } from "./state-distribution.js";
import { HeuristicPairKeySchema } from "./heuristics.js";

export const HorizonExclusionCountsSchema = Type.Object({
  horizon: Type.Number(),
  censoredExcludedCount: Type.Integer({ minimum: 0 }),
  competingExcludedCount: Type.Integer({ minimum: 0 }),
});

export const PopulationExclusionSchema = Type.Object({
  evaluationId: Type.String(),
  originalSampleSize: Type.Integer({ minimum: 1 }),
  excludedCounts: Type.Array(HorizonExclusionCountsSchema),
});

export const OutcomeDistributionAvailableVariantSchema = Type.Object({
  status: Type.Literal("available"),
  stateDistributions: Type.Array(StateDistributionSchema, { minItems: 1 }),
  exclusions: Type.Array(PopulationExclusionSchema),
});

export const OutcomeDistributionUnsupportedVariantSchema = Type.Object({
  status: Type.Literal("unsupported"),
});

export const OutcomeDistributionVariantSchema = Type.Union([
  OutcomeDistributionAvailableVariantSchema,
  OutcomeDistributionUnsupportedVariantSchema,
]);

export const OutcomeDistributionVariantsRecordSchema = Type.Partial(
  Type.Record(HeuristicPairKeySchema, OutcomeDistributionVariantSchema),
);

export const OutcomeDistributionSpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  type: Type.Literal("outcome_distribution"),
  title: Type.Optional(Type.String()),
  stateScale: Type.Optional(
    Type.Union([Type.Literal("ordinal"), Type.Literal("nominal")]),
  ),
  evaluations: Type.Array(EvaluationSpecSchema, { minItems: 1 }),
  stateDistributions: Type.Array(StateDistributionSchema, { minItems: 1 }),
  exclusions: Type.Optional(Type.Array(PopulationExclusionSchema)),
  variants: Type.Optional(OutcomeDistributionVariantsRecordSchema),
});

export type HorizonExclusionCounts = Static<
  typeof HorizonExclusionCountsSchema
>;
export type PopulationExclusion = Static<typeof PopulationExclusionSchema>;
export type OutcomeDistributionAvailableVariant = Static<
  typeof OutcomeDistributionAvailableVariantSchema
>;
export type OutcomeDistributionUnsupportedVariant = Static<
  typeof OutcomeDistributionUnsupportedVariantSchema
>;
export type OutcomeDistributionVariant = Static<
  typeof OutcomeDistributionVariantSchema
>;
export type OutcomeDistributionSpec = Static<
  typeof OutcomeDistributionSpecSchema
>;
