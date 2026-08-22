import { Type, type Static } from "@sinclair/typebox";
import { BaseChartV2SpecSchema } from "./common.js";

export const GainsV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  cutoff: Type.Number(),
  ppcr: Type.Number({ minimum: 0, maximum: 1 }),
  sensitivity: Type.Number({ minimum: 0, maximum: 1 }),
});

export const GainsV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  Type.Object({
    type: Type.Literal("gains"),
    data: Type.Array(GainsV2DatumSchema),
    x: Type.Literal("ppcr"),
    y: Type.Literal("sensitivity"),
  }),
]);

export type GainsV2Datum = Static<typeof GainsV2DatumSchema>;
export type GainsV2Spec = Static<typeof GainsV2SpecSchema>;
