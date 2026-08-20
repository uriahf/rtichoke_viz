import type { RocDatum, RocSpec } from "../spec/roc.js";

export type RPerformanceRocRow = {
  model?: string;
  population?: string;
  probability_threshold: number;
  sensitivity: number;
  specificity: number;
  FPR?: number;
};

export type PythonPerformanceRocRow = {
  reference_group: string;
  chosen_cutoff: number;
  sensitivity: number;
  specificity: number;
  false_positive_rate?: number;
};

export type PythonSeriesRole = "model" | "population";

export type PythonRocAdapterOptions = {
  seriesRole?: PythonSeriesRole;
  defaultModel?: string;
};

const defaultRocFrame = {
  schemaVersion: "1.0" as const,
  type: "roc" as const,
  x: "false_positive_rate" as const,
  y: "sensitivity" as const,
  xAxis: { label: "1 - Specificity", domain: [0, 1] as [number, number] },
  yAxis: { label: "Sensitivity", domain: [0, 1] as [number, number] },
  references: [{ type: "identity" as const }],
};

function buildRocSpec(data: RocDatum[]): RocSpec {
  return { ...defaultRocFrame, data };
}

/** Map rows returned by rtichoke R `prepare_performance_data()` to the canonical ROC spec. */
export function rocSpecFromRPerformanceData(rows: RPerformanceRocRow[]): RocSpec {
  const data = rows.map<RocDatum>((row) => ({
    model: row.model ?? "Model",
    ...(row.population === undefined ? {} : { population: row.population }),
    cutoff: row.probability_threshold,
    sensitivity: row.sensitivity,
    specificity: row.specificity,
  }));

  return buildRocSpec(data);
}

/** Map rows returned by rtichoke_python `prepare_performance_data()` to the canonical ROC spec. */
export function rocSpecFromPythonPerformanceData(
  rows: PythonPerformanceRocRow[],
  options: PythonRocAdapterOptions = {},
): RocSpec {
  const seriesRole = options.seriesRole ?? "model";
  const defaultModel = options.defaultModel ?? "Model";

  const data = rows.map<RocDatum>((row) => ({
    model: seriesRole === "model" ? row.reference_group : defaultModel,
    ...(seriesRole === "population" ? { population: row.reference_group } : {}),
    cutoff: row.chosen_cutoff,
    sensitivity: row.sensitivity,
    specificity: row.specificity,
  }));

  return buildRocSpec(data);
}
