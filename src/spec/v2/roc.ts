import { Type, type Static } from "@sinclair/typebox";
import { BaseChartV2SpecSchema } from "./common.js";

export const RocV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  cutoff: Type.Number(),
  sensitivity: Type.Number({ minimum: 0, maximum: 1 }),
  specificity: Type.Number({ minimum: 0, maximum: 1 }),
});

export const RocV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  Type.Object({
    type: Type.Literal("roc"),
    data: Type.Array(RocV2DatumSchema),
    x: Type.Literal("false_positive_rate"),
    y: Type.Literal("sensitivity"),
  }),
]);

export type RocV2Datum = Static<typeof RocV2DatumSchema>;
export type RocV2Spec = Static<typeof RocV2SpecSchema>;
