import { Type, type Static } from "@sinclair/typebox";
import { CalibrationSpecSchema } from "./calibration.js";
import { RocSpecSchema } from "./roc.js";

/** Canonical union of all rtichoke visualization specifications. */
export const RtichokeChartSpecSchema = Type.Union([
  RocSpecSchema,
  CalibrationSpecSchema,
], {
  $id: "https://rtichoke.dev/schema/viz/1.0.json",
  title: "rtichoke visualization specification",
});

export type RtichokeChartSpec = Static<typeof RtichokeChartSpecSchema>;
