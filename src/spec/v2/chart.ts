import { Type, type Static } from "@sinclair/typebox";
import { CalibrationV2SpecSchema } from "./calibration.js";
import { DecisionCurveV2SpecSchema } from "./decision-curve.js";
import { GainsV2SpecSchema } from "./gains.js";
import { LiftV2SpecSchema } from "./lift.js";
import { PrecisionRecallV2SpecSchema } from "./precision_recall.js";
import { RocV2SpecSchema } from "./roc.js";

/** Canonical v2 union with explicit evaluation and reference ownership. */
export const RtichokeChartSpecV2Schema = Type.Union(
  [
    RocV2SpecSchema,
    CalibrationV2SpecSchema,
    PrecisionRecallV2SpecSchema,
    GainsV2SpecSchema,
    LiftV2SpecSchema,
    DecisionCurveV2SpecSchema,
  ],
  {
    $id: "https://rtichoke.dev/schema/viz/2.0.json",
    title: "rtichoke visualization specification v2",
  },
);

export type RtichokeChartSpecV2 = Static<typeof RtichokeChartSpecV2Schema>;
