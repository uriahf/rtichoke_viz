import { Type, type Static } from "@sinclair/typebox";
import { EvaluationSpecSchema, OperatingPointDimensionSchema } from "./common.js";
import { PerformanceMetricValueSchema } from "./performance-table.js";

export const PredictionDistributionBinSchema = Type.Object({
  evaluationId: Type.String(),
  lower: Type.Number({ minimum: 0, maximum: 1 }),
  upper: Type.Number({ minimum: 0, maximum: 1 }),
  includeLower: Type.Boolean(),
  includeUpper: Type.Boolean(),
  nPositive: Type.Integer({ minimum: 0 }),
  nNegative: Type.Integer({ minimum: 0 }),
});

export const PredictionDistributionRankBinSchema = Type.Object({
  evaluationId: Type.String(),
  rankLower: Type.Number({ minimum: 0, maximum: 1 }),
  rankUpper: Type.Number({ minimum: 0, maximum: 1 }),
  positiveMass: Type.Number({ minimum: 0 }),
  negativeMass: Type.Number({ minimum: 0 }),
});

export const PredictionDistributionOperatingPointSchema = Type.Object({
  evaluationId: Type.String(),
  type: OperatingPointDimensionSchema,
  value: Type.Number({ minimum: 0, maximum: 1 }),
  cutoff: Type.Number({ minimum: 0, maximum: 1 }),
  realizedPpcr: Type.Number({ minimum: 0, maximum: 1 }),
  performance: Type.Optional(Type.Array(PerformanceMetricValueSchema)),
});

export const PredictionDistributionSpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  type: Type.Literal("prediction_distribution"),
  title: Type.Optional(Type.String()),
  evaluations: Type.Array(EvaluationSpecSchema, { minItems: 1 }),
  operatingPoint: Type.Optional(
    Type.Object({
      dimension: OperatingPointDimensionSchema,
    }),
  ),
  bins: Type.Array(PredictionDistributionBinSchema, { minItems: 1 }),
  rankBins: Type.Optional(Type.Array(PredictionDistributionRankBinSchema)),
  operatingPoints: Type.Array(PredictionDistributionOperatingPointSchema, {
    minItems: 1,
  }),
});

export type PredictionDistributionBin = Static<
  typeof PredictionDistributionBinSchema
>;
export type PredictionDistributionRankBin = Static<
  typeof PredictionDistributionRankBinSchema
>;
export type PredictionDistributionOperatingPoint = Static<
  typeof PredictionDistributionOperatingPointSchema
>;
export type PredictionDistributionSpec = Static<
  typeof PredictionDistributionSpecSchema
>;
