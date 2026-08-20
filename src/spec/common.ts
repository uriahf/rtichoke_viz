import { Type, type Static } from "@sinclair/typebox";

export const AxisSpecSchema = Type.Object({
  label: Type.String(),
  domain: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
});

export const ReferenceLineSpecSchema = Type.Object({
  type: Type.Union([
    Type.Literal("identity"),
    Type.Literal("horizontal"),
    Type.Literal("vertical"),
  ]),
  value: Type.Optional(Type.Number()),
});

export const BaseChartSpecSchema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  title: Type.Optional(Type.String()),
  xAxis: AxisSpecSchema,
  yAxis: AxisSpecSchema,
  references: Type.Optional(Type.Array(ReferenceLineSpecSchema)),
});

export type AxisSpec = Static<typeof AxisSpecSchema>;
export type ReferenceLineSpec = Static<typeof ReferenceLineSpecSchema>;
