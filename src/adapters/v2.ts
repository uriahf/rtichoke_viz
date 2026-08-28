import type { CalibrationMethod, RtichokeCalibrationDistributionRow, RtichokeCalibrationRow } from "./calibration.js";
import type { RtichokePythonRocRow, RtichokeRRocRow } from "./roc.js";
import type { CalibrationV2Spec } from "../spec/v2/calibration.js";
import type { DisplayRole, EvaluationSpec, SeriesSpec } from "../spec/v2/common.js";
import type { RocV2Spec } from "../spec/v2/roc.js";

export interface V2GroupingContext {
  role: DisplayRole;
  population?: string;
}

function identityForGroup(group: string, context: V2GroupingContext): {
  evaluation: EvaluationSpec;
  series: SeriesSpec;
} {
  const population = context.role === "model" ? (context.population ?? "population") : group;
  const evaluationId = `evaluation:${group}`;
  return {
    evaluation: {
      id: evaluationId,
      ...(context.role === "model" ? { model: group } : {}),
      population,
      label: group,
    },
    series: {
      id: `series:${group}`,
      evaluationId,
      display: { label: group, group, role: context.role },
    },
  };
}

function identities(groups: string[], context: V2GroupingContext) {
  const unique = [...new Set(groups)];
  return unique.map((group) => identityForGroup(group, context));
}

export function rocV2SpecFromRtichokeR(
  rows: RtichokeRRocRow[],
  population = "population",
): RocV2Spec {
  const byGroup = identities(rows.map((row) => row.model), { role: "model", population });
  return {
    schemaVersion: "2.0",
    type: "roc",
    evaluations: byGroup.map((item) => item.evaluation),
    series: byGroup.map((item) => item.series),
    data: rows.map((row) => ({
      seriesId: `series:${row.model}`,
      cutoff: row.probability_threshold,
      sensitivity: row.sensitivity,
      specificity: row.specificity,
    })),
    x: "false_positive_rate",
    y: "sensitivity",
    xAxis: { label: "1 - Specificity", domain: [0, 1] },
    yAxis: { label: "Sensitivity", domain: [0, 1] },
    references: [{ type: "identity", scope: "global", label: "Random Guess" }],
  };
}

export function rocV2SpecFromRtichokePython(
  rows: RtichokePythonRocRow[],
  context: V2GroupingContext,
): RocV2Spec {
  const byGroup = identities(rows.map((row) => row.reference_group), context);
  return {
    schemaVersion: "2.0",
    type: "roc",
    evaluations: byGroup.map((item) => item.evaluation),
    series: byGroup.map((item) => item.series),
    data: rows.map((row) => ({
      seriesId: `series:${row.reference_group}`,
      cutoff: row.chosen_cutoff,
      sensitivity: row.sensitivity,
      specificity: row.specificity,
    })),
    x: "false_positive_rate",
    y: "sensitivity",
    xAxis: { label: "1 - Specificity", domain: [0, 1] },
    yAxis: { label: "Sensitivity", domain: [0, 1] },
    references: [{ type: "identity", scope: "global", label: "Random Guess" }],
  };
}

export function calibrationV2SpecFromRtichokeRows(
  rows: RtichokeCalibrationRow[],
  method: CalibrationMethod,
  context: V2GroupingContext,
  distributionRows?: RtichokeCalibrationDistributionRow[],
): CalibrationV2Spec {
  const byGroup = identities(rows.map((row) => row.reference_group), context);
  const observedValues = rows.map((row) => row.y).filter(Number.isFinite);
  const minY = Math.min(0, ...observedValues);
  const maxY = Math.max(1, ...observedValues);
  return {
    schemaVersion: "2.0",
    type: "calibration",
    evaluations: byGroup.map((item) => item.evaluation),
    series: byGroup.map((item) => item.series),
    data: rows.map((row) => {
      const events = row.sum_reals ?? row.n_reals;
      const total = row.total_obs ?? row.n;
      return {
        seriesId: `series:${row.reference_group}`,
        predicted: row.x,
        observed: row.y,
        method,
        ...(method === "discrete" && events !== undefined ? { events } : {}),
        ...(method === "discrete" && total !== undefined ? { total } : {}),
      };
    }),
    ...(distributionRows ? {
      distribution: distributionRows.map((row) => ({
        seriesId: `series:${row.reference_group}`,
        midpoint: row.mids,
        count: row.counts,
        binWidth: 0.01,
      })),
    } : {}),
    x: "predicted",
    y: "observed",
    xAxis: { label: "Predicted probability", domain: [0, 1] },
    yAxis: { label: "Observed probability", domain: [minY, maxY] },
    references: [{ type: "identity", scope: "global", label: "Perfectly Calibrated" }],
  };
}
