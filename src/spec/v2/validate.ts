import type { CalibrationV2Spec } from "./calibration.js";
import type { PrecisionRecallV2Spec } from "./precision_recall.js";
import type { RocV2Spec } from "./roc.js";

export type ChartV2Spec = RocV2Spec | CalibrationV2Spec | PrecisionRecallV2Spec;

/** Validate cross-object identity references that JSON Schema cannot express. */
export function assertV2ReferentialIntegrity(spec: ChartV2Spec): void {
  const evaluationIds = new Set(spec.evaluations.map((evaluation) => evaluation.id));
  const seriesIds = new Set<string>();

  if (evaluationIds.size !== spec.evaluations.length) {
    throw new Error("duplicate evaluation id");
  }

  for (const series of spec.series) {
    if (seriesIds.has(series.id)) {
      throw new Error(`duplicate series id: ${series.id}`);
    }
    seriesIds.add(series.id);
    if (!evaluationIds.has(series.evaluationId)) {
      throw new Error(`unknown evaluation id: ${series.evaluationId}`);
    }
  }

  for (const datum of spec.data) {
    if (!seriesIds.has(datum.seriesId)) {
      throw new Error(`unknown series id: ${datum.seriesId}`);
    }
  }

  if (spec.type === "calibration") {
    for (const datum of spec.distribution ?? []) {
      if (!seriesIds.has(datum.seriesId)) {
        throw new Error(`unknown distribution series id: ${datum.seriesId}`);
      }
    }
  }
}
