import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema } from "./common.js";

export const PopulationSummaryOwnerSpecSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
});

export const AUROCSummaryMetricSchema = Type.Object({
  metric: Type.Literal("auroc"),
  owner: Type.Object({
    type: Type.Literal("evaluation"),
    evaluationId: Type.String(),
  }),
  estimate: Type.Union([Type.Number(), Type.Null()]),
});

export const PrevalenceSummaryMetricSchema = Type.Object({
  metric: Type.Literal("prevalence"),
  owner: Type.Object({
    type: Type.Literal("population"),
    populationId: Type.String(),
  }),
  estimate: Type.Union([Type.Number(), Type.Null()]),
});

export const EventRiskSummaryMetricSchema = Type.Object({
  metric: Type.Literal("event_risk"),
  owner: Type.Object({
    type: Type.Literal("population"),
    populationId: Type.String(),
  }),
  horizon: Type.Number({ minimum: 0 }),
  estimate: Type.Union([Type.Number(), Type.Null()]),
});

export const SummaryMetricV1_0Schema = Type.Union([
  AUROCSummaryMetricSchema,
  PrevalenceSummaryMetricSchema,
]);

export const SummaryMetricV1_1Schema = Type.Union([
  AUROCSummaryMetricSchema,
  PrevalenceSummaryMetricSchema,
  EventRiskSummaryMetricSchema,
]);

export const SummaryMetricSchema = SummaryMetricV1_1Schema;

export const SummaryMetricsSpecV1_0Schema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  type: Type.Literal("summary_metrics"),
  title: Type.Optional(Type.String()),
  evaluations: Type.Array(EvaluationSpecSchema),
  populations: Type.Array(PopulationSummaryOwnerSpecSchema),
  metrics: Type.Array(SummaryMetricV1_0Schema),
});

export const SummaryMetricsSpecV1_1Schema = Type.Object({
  schemaVersion: Type.Literal("1.1"),
  type: Type.Literal("summary_metrics"),
  title: Type.Optional(Type.String()),
  evaluations: Type.Array(EvaluationSpecSchema),
  populations: Type.Array(PopulationSummaryOwnerSpecSchema),
  metrics: Type.Array(SummaryMetricV1_1Schema),
});

export const SummaryMetricsSpecSchema = Type.Union(
  [SummaryMetricsSpecV1_0Schema, SummaryMetricsSpecV1_1Schema],
  {
    $id: "https://rtichoke.dev/schema/viz/summary-metrics.json",
    title: "rtichoke summary metrics specification",
  },
);

export type PopulationSummaryOwnerSpec = Static<
  typeof PopulationSummaryOwnerSpecSchema
>;
export type AUROCSummaryMetric = Static<typeof AUROCSummaryMetricSchema>;
export type PrevalenceSummaryMetric = Static<
  typeof PrevalenceSummaryMetricSchema
>;
export type EventRiskSummaryMetric = Static<
  typeof EventRiskSummaryMetricSchema
>;
export type SummaryMetricV1_0 = Static<typeof SummaryMetricV1_0Schema>;
export type SummaryMetricV1_1 = Static<typeof SummaryMetricV1_1Schema>;
export type SummaryMetric = Static<typeof SummaryMetricSchema>;
export type SummaryMetricsSpecV1_0 = Static<
  typeof SummaryMetricsSpecV1_0Schema
>;
export type SummaryMetricsSpecV1_1 = Static<
  typeof SummaryMetricsSpecV1_1Schema
>;
export type SummaryMetricsSpec = Static<typeof SummaryMetricsSpecSchema>;
