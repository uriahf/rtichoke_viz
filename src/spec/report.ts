import { Type, type Static } from "@sinclair/typebox";
import { RtichokeChartSpecV2Schema } from "./v2/chart.js";
import { PerformanceTableSpecSchema } from "./v2/performance-table.js";

export const ReportComponentSchema = Type.Object({
  id: Type.String(),
  title: Type.Optional(Type.String()),
  spec: Type.Union([RtichokeChartSpecV2Schema, PerformanceTableSpecSchema]),
});

/**
 * Canonical report-level composition contract.
 *
 * Each component embeds a complete standalone canonical spec. Component ids
 * form a report-local identity domain; evaluation ids remain local to each
 * embedded spec and do not imply cross-component identity.
 */
export const ReportSpecSchema = Type.Object({
  schemaVersion: Type.Literal("1.0"),
  type: Type.Literal("report"),
  title: Type.Optional(Type.String()),
  components: Type.Array(ReportComponentSchema, { minItems: 1 }),
});

export type ReportComponent = Static<typeof ReportComponentSchema>;
export type ReportSpec = Static<typeof ReportSpecSchema>;
