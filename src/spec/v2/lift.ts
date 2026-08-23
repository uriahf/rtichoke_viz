import { Type, type Static } from "@sinclair/typebox";
import { BaseChartV2SpecSchema } from "./common.js";

export const LiftV2DatumSchema = Type.Object({
  seriesId: Type.String(),
  cutoff: Type.Number(),
  ppcr: Type.Number({ minimum: 0, maximum: 1 }),
  lift: Type.Number(),
});

export const LiftV2SpecSchema = Type.Intersect([
  BaseChartV2SpecSchema,
  Type.Object({
    type: Type.Literal("lift"),
    data: Type.Array(LiftV2DatumSchema),
    x: Type.Literal("ppcr"),
    y: Type.Literal("lift"),
  }),
]);

export type LiftV2Datum = Static<typeof LiftV2DatumSchema>;
export type LiftV2Spec = Static<typeof LiftV2SpecSchema>;
