import type { CalibrationDatum, CalibrationSpec } from "../spec/calibration.js";

export type CalibrationMethod = "discrete" | "smooth";

/** Common plotted calibration-row shape already produced by rtichoke R and Python. */
export interface RtichokeCalibrationRow {
  reference_group: string;
  x: number;
  y: number;
}

/** Map plotted calibration rows from either rtichoke implementation to the canonical spec. */
export function calibrationSpecFromRtichokeRows(
  rows: RtichokeCalibrationRow[],
  method: CalibrationMethod,
): CalibrationSpec {
  const data: CalibrationDatum[] = rows.map((row) => ({
    model: row.reference_group,
    predicted: row.x,
    observed: row.y,
    method,
  }));

  return {
    schemaVersion: "1.0",
    type: "calibration",
    data,
    x: "predicted",
    y: "observed",
    xAxis: { label: "Predicted probability", domain: [0, 1] },
    yAxis: { label: "Observed probability", domain: [0, 1] },
    references: [{ type: "identity" }],
  };
}
