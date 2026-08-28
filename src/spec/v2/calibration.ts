import { Type, type Static } from "@sinclair/typebox";
import { BaseChartV2SpecSchema } from "./common.js";

export const DiscreteCalibrationV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  predicted: Type.Number({ minimum: 0, maximum: 1 }),
  observed: Type.Number({ minimum: 0, maximum: 1 }),
  method: Type.Literal("discrete"),
  events: Type.Optional(Type.Number({ minimum: 0 })),
  total: Type.Optional(Type.Number({ minimum: 0 })),
});

export const SmoothCalibrationV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  predicted: Type.Number({ minimum: 0, maximum: 1 }),
  observed: Type.Number(),
  method: Type.Literal("smooth"),
  events: Type.Optional(Type.Number({ minimum: 0 })),
  total: Type.Optional(Type.Number({ minimum: 0 })),
});

export const CalibrationV2DatumSchema = Type.Union([
  DiscreteCalibrationV2DatumSchema,
  SmoothCalibrationV2DatumSchema,
]);

export const CalibrationV2DistributionDatumSchema = Type.Object({
  seriesId: Type.String(),
  midpoint: Type.Number({ minimum: 0, maximum: 1 }),
  count: Type.Number({ minimum: 0 }),
  binWidth: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
});

export const CalibrationV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  Type.Object({
    type: Type.Literal("calibration"),
    data: Type.Array(CalibrationV2DatumSchema),
    distribution: Type.Optional(Type.Array(CalibrationV2DistributionDatumSchema)),
    x: Type.Literal("predicted"),
    y: Type.Literal("observed"),
  }),
]);

export type CalibrationV2Datum = Static<typeof CalibrationV2DatumSchema>;
export type CalibrationV2DistributionDatum = Static<
  typeof CalibrationV2DistributionDatumSchema
>;
export type CalibrationV2Spec = Static<typeof CalibrationV2SpecSchema>;
