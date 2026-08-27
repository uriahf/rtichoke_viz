import { Type, type Static } from "@sinclair/typebox";
import { RtichokeChartSpecV2Schema } from "./v2/chart.js";
import { PerformanceTableSpecSchema } from "./v2/performance-table.js";

export const StandaloneCanonicalSpecSchema = Type.Union([
  RtichokeChartSpecV2Schema,
  PerformanceTableSpecSchema,
]);

/** Flat ReportSpec v1.0 component wrapper. */
export const ReportComponentSchema = Type.Object({
  id: Type.String(),
  title: Type.Optional(Type.String()),
  spec: StandaloneCanonicalSpecSchema,
});

/**
 * Canonical report-level composition contract.
 *
 * Each component embeds a complete standalone canonical spec. Component ids
 * form a report-local identity domain; evaluation ids remain local to each
 * embedded spec and do not imply cross-component identity.
 */
export const ReportSpecV1_0Schema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  type: Type.Literal("report"),
  title: Type.Optional(Type.String()),
  components: Type.Array(ReportComponentSchema, { minItems: 1 }),
});

/** Structured ReportSpec v1.1 component wrapper. */
export const ReportComponentV1_1Schema = Type.Object({
  type: Type.Literal("component"),
  id: Type.String(),
  title: Type.Optional(Type.String()),
  spec: StandaloneCanonicalSpecSchema,
});

/** One non-recursive grouping level within a structured report section. */
export const ReportGroupSchema = Type.Object({
  type: Type.Literal("group"),
  id: Type.String(),
  title: Type.String(),
  components: Type.Array(ReportComponentV1_1Schema, { minItems: 1 }),
});

export const ReportSectionSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  items: Type.Array(
    Type.Union([ReportComponentV1_1Schema, ReportGroupSchema]),
    { minItems: 1 },
  ),
});

export const ReportSpecV1_1Schema = Type.Object({
  schemaVersion: Type.Literal("1.1"),
  type: Type.Literal("report"),
  title: Type.Optional(Type.String()),
  sections: Type.Array(ReportSectionSchema, { minItems: 1 }),
});

/** Supported canonical report contracts. */
export const ReportSpecSchema = Type.Union(
  [ReportSpecV1_0Schema, ReportSpecV1_1Schema],
  {
    $id: "https://rtichoke.dev/schema/viz/report.json",
    title: "rtichoke report specification",
  },
);

export type StandaloneCanonicalSpec = Static<
  typeof StandaloneCanonicalSpecSchema
>;
export type ReportComponent = Static<typeof ReportComponentSchema>;
export type ReportSpecV1_0 = Static<typeof ReportSpecV1_0Schema>;
export type ReportComponentV1_1 = Static<typeof ReportComponentV1_1Schema>;
export type ReportGroup = Static<typeof ReportGroupSchema>;
export type ReportSection = Static<typeof ReportSectionSchema>;
export type ReportSpecV1_1 = Static<typeof ReportSpecV1_1Schema>;
export type ReportSpec = Static<typeof ReportSpecSchema>;
