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

export const SummaryMetricSchema = Type.Union([
  AUROCSummaryMetricSchema,
  PrevalenceSummaryMetricSchema,
]);

export const SummaryMetricsSpecSchema = Type.Object(
  {
    schemaVersion: Type.Literal("1.0"),
    type: Type.Literal("summary_metrics"),
    title: Type.Optional(Type.String()),
    evaluations: Type.Array(EvaluationSpecSchema),
    populations: Type.Array(PopulationSummaryOwnerSpecSchema),
    metrics: Type.Array(SummaryMetricSchema),
  },
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
export type SummaryMetric = Static<typeof SummaryMetricSchema>;
export type SummaryMetricsSpec = Static<typeof SummaryMetricsSpecSchema>;
