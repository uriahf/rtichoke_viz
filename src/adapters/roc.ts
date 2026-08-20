import type { RocDatum, RocSpec } from "../spec/roc.js";

export interface RtichokeRRocRow {
  model: string;
  probability_threshold: number;
  sensitivity: number;
  specificity: number;
}

export interface RtichokePythonRocRow {
  reference_group: string;
  chosen_cutoff: number;
  sensitivity: number;
  specificity: number;
}

function buildRocSpec(data: RocDatum[]): RocSpec {
  return {
    schemaVersion: "1.0",
    type: "roc",
    data,
    x: "false_positive_rate",
    y: "sensitivity",
    xAxis: { label: "1 - Specificity", domain: [0, 1] },
    yAxis: { label: "Sensitivity", domain: [0, 1] },
    references: [{ type: "identity" }],
  };
}

/** Map rtichoke R performance-data rows for multiple models to the canonical ROC spec. */
export function rocSpecFromRtichokeR(rows: RtichokeRRocRow[]): RocSpec {
  return buildRocSpec(
    rows.map((row) => ({
      model: row.model,
      cutoff: row.probability_threshold,
      sensitivity: row.sensitivity,
      specificity: row.specificity,
    })),
  );
}

/** Map rtichoke_python performance-data rows for multiple models to the canonical ROC spec. */
export function rocSpecFromRtichokePython(rows: RtichokePythonRocRow[]): RocSpec {
  return buildRocSpec(
    rows.map((row) => ({
      model: row.reference_group,
      cutoff: row.chosen_cutoff,
      sensitivity: row.sensitivity,
      specificity: row.specificity,
    })),
  );
}
