import { Type, type Static } from "@sinclair/typebox";
import { BaseChartV2SpecSchema, OperatingPointSpecSchema } from "./common.js";

export const PrecisionRecallV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  cutoff: Type.Number(),
  ppcr: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  sensitivity: Type.Number({ minimum: 0, maximum: 1 }),
  ppv: Type.Number({ minimum: 0, maximum: 1 }),
});

export const PrecisionRecallV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  OperatingPointSpecSchema,
  Type.Object({
    type: Type.Literal("precision_recall"),
    data: Type.Array(PrecisionRecallV2DatumSchema),
    x: Type.Literal("sensitivity"),
    y: Type.Literal("ppv"),
  }),
]);

export type PrecisionRecallV2Datum = Static<typeof PrecisionRecallV2DatumSchema>;
export type PrecisionRecallV2Spec = Static<typeof PrecisionRecallV2SpecSchema>;
