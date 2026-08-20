import { Type, type Static } from "@sinclair/typebox";
import { AxisSpecSchema, ReferenceLineSpecSchema } from "./common.js";

export const CalibrationDatumSchema = Type.Object({
  model: Type.String(),
  population: Type.Optional(Type.String()),
  horizon: Type.Optional(Type.Number()),
  predicted: Type.Number({ minimum: 0, maximum: 1 }),
  observed: Type.Number({ minimum: 0, maximum: 1 }),
  method: Type.Union([Type.Literal("discrete"), Type.Literal("smooth")]),
});

export const CalibrationDistributionDatumSchema = Type.Object({
  model: Type.String(),
  population: Type.Optional(Type.String()),
  horizon: Type.Optional(Type.Number()),
  midpoint: Type.Number({ minimum: 0, maximum: 1 }),
  count: Type.Number({ minimum: 0 }),
  binWidth: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
});

export const CalibrationSpecSchema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  type: Type.Literal("calibration"),
  data: Type.Array(CalibrationDatumSchema),
  distribution: Type.Optional(Type.Array(CalibrationDistributionDatumSchema)),
  x: Type.Literal("predicted"),
  y: Type.Literal("observed"),
  xAxis: AxisSpecSchema,
  yAxis: AxisSpecSchema,
  references: Type.Optional(Type.Array(ReferenceLineSpecSchema)),
});

export type CalibrationDatum = Static<typeof CalibrationDatumSchema>;
export type CalibrationDistributionDatum = Static<typeof CalibrationDistributionDatumSchema>;
export type CalibrationSpec = Static<typeof CalibrationSpecSchema>;
