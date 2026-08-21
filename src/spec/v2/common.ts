import { Type, type Static } from "@sinclair/typebox";
import { AxisSpecSchema } from "../common.js";

export const EvaluationSpecSchema = Type.Object({
  id: Type.String(),
  model: Type.Optional(Type.String()),
  population: Type.String(),
  label: Type.Optional(Type.String()),
});

export const DisplayRoleSchema = Type.Union([
  Type.Literal("model"),
  Type.Literal("population"),
  Type.Literal("evaluation"),
  Type.Literal("context"),
]);

export const DisplayGroupingSpecSchema = Type.Object({
  label: Type.String(),
  group: Type.String(),
  role: DisplayRoleSchema,
});

export const SeriesSpecSchema = Type.Object({
  id: Type.String(),
  evaluationId: Type.String(),
  horizon: Type.Optional(Type.Number({ minimum: 0 })),
  display: DisplayGroupingSpecSchema,
});

export const ReferencePointSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
});

const ReferenceGeometrySchema = Type.Union([
  Type.Object({
    type: Type.Literal("identity"),
    label: Type.Optional(Type.String()),
  }),
  Type.Object({
    type: Type.Literal("horizontal"),
    value: Type.Number(),
    label: Type.Optional(Type.String()),
  }),
  Type.Object({
    type: Type.Literal("vertical"),
    value: Type.Number(),
    label: Type.Optional(Type.String()),
  }),
  Type.Object({
    type: Type.Literal("path"),
    points: Type.Array(ReferencePointSchema, { minItems: 2 }),
    label: Type.Optional(Type.String()),
  }),
]);

const GlobalReferenceLineSpecSchema = Type.Intersect([
  ReferenceGeometrySchema,
  Type.Object({ scope: Type.Literal("global") }),
]);

const PopulationReferenceLineSpecSchema = Type.Intersect([
  ReferenceGeometrySchema,
  Type.Object({
    scope: Type.Literal("population"),
    population: Type.String(),
  }),
]);

const PopulationHorizonReferenceLineSpecSchema = Type.Intersect([
  ReferenceGeometrySchema,
  Type.Object({
    scope: Type.Literal("population_horizon"),
    population: Type.String(),
    horizon: Type.Number({ minimum: 0 }),
  }),
]);

export const ReferenceLineV2SpecSchema = Type.Union([
  GlobalReferenceLineSpecSchema,
  PopulationReferenceLineSpecSchema,
  PopulationHorizonReferenceLineSpecSchema,
]);

export const BaseChartV2SpecSchema = Type.Object({
  schemaVersion: Type.Literal("2.0"),
  title: Type.Optional(Type.String()),
  evaluations: Type.Array(EvaluationSpecSchema),
  series: Type.Array(SeriesSpecSchema),
  xAxis: AxisSpecSchema,
  yAxis: AxisSpecSchema,
  references: Type.Optional(Type.Array(ReferenceLineV2SpecSchema)),
});

export type EvaluationSpec = Static<typeof EvaluationSpecSchema>;
export type DisplayRole = Static<typeof DisplayRoleSchema>;
export type DisplayGroupingSpec = Static<typeof DisplayGroupingSpecSchema>;
export type SeriesSpec = Static<typeof SeriesSpecSchema>;
export type ReferencePoint = Static<typeof ReferencePointSchema>;
export type ReferenceLineV2Spec = Static<typeof ReferenceLineV2SpecSchema>;
