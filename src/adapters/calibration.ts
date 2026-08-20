import type {
  CalibrationDatum,
  CalibrationDistributionDatum,
  CalibrationSpec,
} from "../spec/calibration.js";

export type CalibrationMethod = "discrete" | "smooth";

/** Common plotted calibration-row shape already produced by rtichoke R and Python. */
export interface RtichokeCalibrationRow {
  reference_group: string;
  x: number;
  y: number;
  sum_reals?: number;
  total_obs?: number;
  n_reals?: number;
  n?: number;
}

/** Histogram row shape produced by rtichoke calibration helpers. */
export interface RtichokeCalibrationDistributionRow {
  reference_group: string;
  mids: number;
  counts: number;
}

/** Map plotted calibration rows from either rtichoke implementation to the canonical spec. */
export function calibrationSpecFromRtichokeRows(
  rows: RtichokeCalibrationRow[],
  method: CalibrationMethod,
  distributionRows?: RtichokeCalibrationDistributionRow[],
): CalibrationSpec {
  const data: CalibrationDatum[] = rows.map((row) => {
    const events = row.sum_reals ?? row.n_reals;
    const total = row.total_obs ?? row.n;

    return {
      model: row.reference_group,
      predicted: row.x,
      observed: row.y,
      method,
      ...(method === "discrete" && events !== undefined ? { events } : {}),
      ...(method === "discrete" && total !== undefined ? { total } : {}),
    };
  });

  const distribution: CalibrationDistributionDatum[] | undefined =
    distributionRows?.map((row) => ({
      model: row.reference_group,
      midpoint: row.mids,
      count: row.counts,
      binWidth: 0.01,
    }));

  return {
    schemaVersion: "1.0",
    type: "calibration",
    data,
    ...(distribution ? { distribution } : {}),
    x: "predicted",
    y: "observed",
    xAxis: { label: "Predicted probability", domain: [0, 1] },
    yAxis: { label: "Observed probability", domain: [0, 1] },
    references: [{ type: "identity" }],
  };
}
