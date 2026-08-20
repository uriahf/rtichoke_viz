import { Type, type Static } from "@sinclair/typebox";
import { AxisSpecSchema, ReferenceLineSpecSchema } from "./common.js";

export const RocDatumSchema = Type.Object({
  model: Type.String(),
  population: Type.Optional(Type.String()),
  horizon: Type.Optional(Type.Number()),
  cutoff: Type.Number(),
  sensitivity: Type.Number({ minimum: 0, maximum: 1 }),
  specificity: Type.Number({ minimum: 0, maximum: 1 }),
});

export const RocSpecSchema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  type: Type.Literal("roc"),
  data: Type.Array(RocDatumSchema),
  x: Type.Literal("false_positive_rate"),
  y: Type.Literal("sensitivity"),
  xAxis: AxisSpecSchema,
  yAxis: AxisSpecSchema,
  references: Type.Optional(Type.Array(ReferenceLineSpecSchema)),
});

export type RocDatum = Static<typeof RocDatumSchema>;
export type RocSpec = Static<typeof RocSpecSchema>;
