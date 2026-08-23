import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema } from "./common.js";

export const PerformanceMetricIdSchema = Type.Union([
  Type.Literal("true_positives"),
  Type.Literal("true_negatives"),
  Type.Literal("false_positives"),
  Type.Literal("false_negatives"),
  Type.Literal("sensitivity"),
  Type.Literal("specificity"),
  Type.Literal("false_positive_rate"),
  Type.Literal("ppv"),
  Type.Literal("npv"),
  Type.Literal("lift"),
  Type.Literal("predicted_positives"),
  Type.Literal("ppcr"),
  Type.Literal("net_benefit"),
  Type.Literal("net_benefit_interventions_avoided"),
]);

export const PerformanceMetricDefinitionSchema = Type.Object({
  id: PerformanceMetricIdSchema,
  label: Type.String(),
});

export const PerformanceMetricValueSchema = Type.Object({
  metricId: PerformanceMetricIdSchema,
  estimate: Type.Union([Type.Number(), Type.Null()]),
  lower: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  upper: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const OperatingPointSchema = Type.Union([
  Type.Object({
    type: Type.Literal("probability_threshold"),
    value: Type.Number(),
  }),
  Type.Object({
    type: Type.Literal("ppcr"),
    value: Type.Number({ minimum: 0, maximum: 1 }),
  }),
]);

export const PerformanceEvaluationContextSchema = Type.Object({
  censoringHeuristic: Type.Optional(Type.String()),
  competingEventHeuristic: Type.Optional(Type.String()),
});

export const PerformanceTableRowSchema = Type.Object({
  evaluationId: Type.String(),
  horizon: Type.Optional(Type.Number({ minimum: 0 })),
  operatingPoint: OperatingPointSchema,
  context: Type.Optional(PerformanceEvaluationContextSchema),
  values: Type.Array(PerformanceMetricValueSchema),
});

/**
 * Canonical semantic contract for threshold-level performance tables.
 * Statistics are producer-owned; this schema only carries their meaning.
 * It intentionally remains separate from RtichokeChartSpecV2Schema.
 */
export const PerformanceTableSpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  type: Type.Literal("performance_table"),
  title: Type.Optional(Type.String()),
  evaluations: Type.Array(EvaluationSpecSchema),
  metrics: Type.Array(PerformanceMetricDefinitionSchema),
  rows: Type.Array(PerformanceTableRowSchema),
});

export type PerformanceMetricId = Static<typeof PerformanceMetricIdSchema>;
export type PerformanceMetricDefinition = Static<
  typeof PerformanceMetricDefinitionSchema
>;
export type PerformanceMetricValue = Static<typeof PerformanceMetricValueSchema>;
export type OperatingPoint = Static<typeof OperatingPointSchema>;
export type PerformanceEvaluationContext = Static<
  typeof PerformanceEvaluationContextSchema
>;
export type PerformanceTableRow = Static<typeof PerformanceTableRowSchema>;
export type PerformanceTableSpec = Static<typeof PerformanceTableSpecSchema>;
