import { Type, type Static } from "@sinclair/typebox";
import {
  BaseChartV2SpecSchema,
  EvaluationSpecSchema,
  ThresholdOperatingPointSpecSchema,
  SeriesSpecSchema,
} from "./common.js";

export const InterventionsAvoidedV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  threshold: Type.Number({ minimum: 0, maximum: 1 }),
  interventionsAvoided: Type.Number(),
});

export const InterventionsAvoidedV2EvaluationSchema = Type.Intersect([
  EvaluationSpecSchema,
  Type.Object({ id: Type.String({ pattern: "^evaluation-[1-9][0-9]*$" }) }),
]);

export const InterventionsAvoidedV2SeriesSchema = Type.Intersect([
  SeriesSpecSchema,
  Type.Object({
    id: Type.String({ pattern: "^series-[1-9][0-9]*$" }),
    evaluationId: Type.String({ pattern: "^evaluation-[1-9][0-9]*$" }),
  }),
]);

export const InterventionsAvoidedTreatAllReferenceSchema = Type.Object({
  type: Type.Literal("horizontal"),
  value: Type.Literal(0),
  label: Type.Optional(Type.String()),
  scope: Type.Literal("global"),
  benchmark: Type.Literal("treat_all"),
});

const TreatNoneGeometry = {
  type: Type.Literal("path"),
  points: Type.Array(
    Type.Object({ x: Type.Number(), y: Type.Number() }),
    { minItems: 2 },
  ),
  label: Type.Optional(Type.String()),
  benchmark: Type.Literal("treat_none"),
};

export const InterventionsAvoidedTreatNoneReferenceSchema = Type.Union([
  Type.Object({
    ...TreatNoneGeometry,
    scope: Type.Literal("population"),
    population: Type.String(),
  }),
  Type.Object({
    ...TreatNoneGeometry,
    scope: Type.Literal("population_horizon"),
    population: Type.String(),
    horizon: Type.Number({ minimum: 0 }),
  }),
]);

export const InterventionsAvoidedV2ReferenceSchema = Type.Union([
  InterventionsAvoidedTreatAllReferenceSchema,
  InterventionsAvoidedTreatNoneReferenceSchema,
]);

export const InterventionsAvoidedV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  ThresholdOperatingPointSpecSchema,
  Type.Object({
    type: Type.Literal("interventions_avoided"),
    evaluations: Type.Array(InterventionsAvoidedV2EvaluationSchema, { minItems: 1 }),
    series: Type.Array(InterventionsAvoidedV2SeriesSchema, { minItems: 1 }),
    data: Type.Array(InterventionsAvoidedV2DatumSchema),
    x: Type.Literal("threshold"),
    y: Type.Literal("interventionsAvoided"),
    references: Type.Array(InterventionsAvoidedV2ReferenceSchema, { minItems: 2 }),
  }),
]);

export type InterventionsAvoidedV2Datum = Static<typeof InterventionsAvoidedV2DatumSchema>;
export type InterventionsAvoidedV2Evaluation = Static<typeof InterventionsAvoidedV2EvaluationSchema>;
export type InterventionsAvoidedV2Series = Static<typeof InterventionsAvoidedV2SeriesSchema>;
export type InterventionsAvoidedV2Reference = Static<typeof InterventionsAvoidedV2ReferenceSchema>;
export type InterventionsAvoidedV2Spec = Static<typeof InterventionsAvoidedV2SpecSchema>;
