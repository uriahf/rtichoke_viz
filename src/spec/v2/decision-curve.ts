import { Type, type Static } from "@sinclair/typebox";
import {
  BaseChartV2SpecSchema,
  EvaluationSpecSchema,
  OperatingPointSpecSchema,
  SeriesSpecSchema,
} from "./common.js";

export const DecisionCurveV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  threshold: Type.Number({ minimum: 0, maximum: 1 }),
  netBenefit: Type.Number(),
});

export const DecisionCurveV2EvaluationSchema = Type.Intersect([
  EvaluationSpecSchema,
  Type.Object({ id: Type.String({ pattern: "^evaluation-[1-9][0-9]*$" }) }),
]);

export const DecisionCurveV2SeriesSchema = Type.Intersect([
  SeriesSpecSchema,
  Type.Object({
    id: Type.String({ pattern: "^series-[1-9][0-9]*$" }),
    evaluationId: Type.String({ pattern: "^evaluation-[1-9][0-9]*$" }),
  }),
]);

export const TreatNoneReferenceSchema = Type.Object({
  type: Type.Literal("horizontal"),
  value: Type.Literal(0),
  label: Type.Optional(Type.String()),
  scope: Type.Literal("global"),
  benchmark: Type.Literal("treat_none"),
});

const TreatAllGeometry = {
    type: Type.Literal("path"),
    points: Type.Array(
      Type.Object({ x: Type.Number(), y: Type.Number() }),
      { minItems: 2 },
    ),
    label: Type.Optional(Type.String()),
    benchmark: Type.Literal("treat_all"),
};

export const TreatAllReferenceSchema = Type.Union([
  Type.Object({
    ...TreatAllGeometry,
    scope: Type.Literal("population"),
    population: Type.String(),
  }),
  Type.Object({
    ...TreatAllGeometry,
    scope: Type.Literal("population_horizon"),
    population: Type.String(),
    horizon: Type.Number({ minimum: 0 }),
  }),
]);

export const DecisionCurveV2ReferenceSchema = Type.Union([
  TreatNoneReferenceSchema,
  TreatAllReferenceSchema,
]);

export const DecisionCurveV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  OperatingPointSpecSchema,
  Type.Object({
    type: Type.Literal("decision_curve"),
    evaluations: Type.Array(DecisionCurveV2EvaluationSchema, { minItems: 1 }),
    series: Type.Array(DecisionCurveV2SeriesSchema, { minItems: 1 }),
    data: Type.Array(DecisionCurveV2DatumSchema),
    x: Type.Literal("threshold"),
    y: Type.Literal("netBenefit"),
    references: Type.Array(DecisionCurveV2ReferenceSchema, { minItems: 2 }),
  }),
]);

export type DecisionCurveV2Datum = Static<typeof DecisionCurveV2DatumSchema>;
export type DecisionCurveV2Evaluation = Static<typeof DecisionCurveV2EvaluationSchema>;
export type DecisionCurveV2Series = Static<typeof DecisionCurveV2SeriesSchema>;
export type DecisionCurveV2Reference = Static<typeof DecisionCurveV2ReferenceSchema>;
export type DecisionCurveV2Spec = Static<typeof DecisionCurveV2SpecSchema>;
