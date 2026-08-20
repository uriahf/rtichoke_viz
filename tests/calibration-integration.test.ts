import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import pythonRows from "../fixtures/integration/calibration-rtichoke-python.json" with { type: "json" };
import rRows from "../fixtures/integration/calibration-rtichoke-r.json" with { type: "json" };
import {
  calibrationSpecFromRtichokeRows,
  type RtichokeCalibrationRow,
} from "../src/adapters/calibration.js";
import { CalibrationSpecSchema } from "../src/spec/calibration.js";

function commonRows(rows: Array<{ reference_group: string; x: number; y: number }>) {
  return rows.map(({ reference_group, x, y }) => ({ reference_group, x, y }));
}

describe("real calibration output-shape integration", () => {
  it("maps R and Python discrete calibration rows to the same canonical spec", () => {
    const fromR = calibrationSpecFromRtichokeRows(
      rRows as RtichokeCalibrationRow[],
      "discrete",
    );
    const fromPython = calibrationSpecFromRtichokeRows(
      pythonRows as RtichokeCalibrationRow[],
      "discrete",
    );

    expect(fromR).toEqual(fromPython);
    expect(fromR.data[0]).toMatchObject({ events: 8, total: 100 });
    expect(Value.Check(CalibrationSpecSchema, fromR)).toBe(true);
  });

  it("records smoothing as canonical method semantics without discrete count metadata", () => {
    const smooth = calibrationSpecFromRtichokeRows(
      rRows as RtichokeCalibrationRow[],
      "smooth",
    );

    expect(smooth.data.every((datum) => datum.method === "smooth")).toBe(true);
    expect(smooth.data.every((datum) => datum.events === undefined)).toBe(true);
    expect(smooth.data.every((datum) => datum.total === undefined)).toBe(true);
    expect(Value.Check(CalibrationSpecSchema, smooth)).toBe(true);
  });

  it("maps rtichoke histogram rows without recomputing bins in the renderer", () => {
    const spec = calibrationSpecFromRtichokeRows(commonRows(rRows), "discrete", [
      { reference_group: "Model A", mids: 0.005, counts: 4 },
      { reference_group: "Model A", mids: 0.015, counts: 9 },
    ]);

    expect(spec.distribution).toEqual([
      { model: "Model A", midpoint: 0.005, count: 4, binWidth: 0.01 },
      { model: "Model A", midpoint: 0.015, count: 9, binWidth: 0.01 },
    ]);
    expect(Value.Check(CalibrationSpecSchema, spec)).toBe(true);
  });
});
