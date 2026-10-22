import { Type, type Static } from "@sinclair/typebox";

export const HeuristicPairKeySchema = Type.Union([
  Type.Literal("excluded:excluded"),
  Type.Literal("excluded:adjusted_as_censored"),
  Type.Literal("excluded:adjusted_as_negative"),
  Type.Literal("excluded:adjusted_as_composite"),
  Type.Literal("adjusted:excluded"),
  Type.Literal("adjusted:adjusted_as_censored"),
  Type.Literal("adjusted:adjusted_as_negative"),
  Type.Literal("adjusted:adjusted_as_composite"),
]);

export const ReportHeuristicsSchema = Type.Object({
  active: HeuristicPairKeySchema,
  available: Type.Array(HeuristicPairKeySchema, { minItems: 1 }),
});

export type HeuristicPairKey = Static<typeof HeuristicPairKeySchema>;
export type ReportHeuristics = Static<typeof ReportHeuristicsSchema>;
