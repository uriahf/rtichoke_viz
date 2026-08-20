import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { CalibrationSpecSchema } from "../src/spec/calibration.js";
import { RocSpecSchema } from "../src/spec/roc.js";

const roc = {
  schemaVersion: "1.0",
  type: "roc",
  data: [
    { model: "Model A", cutoff: 0.5, sensitivity: 0.8, specificity: 0.7 },
  ],
  x: "false_positive_rate",
  y: "sensitivity",
  xAxis: { label: "1 - Specificity", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  references: [{ type: "identity" }],
} as const;

const calibration = {
  schemaVersion: "1.0",
  type: "calibration",
  data: [
    { model: "Model A", predicted: 0.2, observed: 0.18, method: "discrete" },
  ],
  x: "predicted",
  y: "observed",
  xAxis: { label: "Predicted probability", domain: [0, 1] },
  yAxis: { label: "Observed probability", domain: [0, 1] },
  references: [{ type: "identity" }],
} as const;

describe("rtichoke visualization specs", () => {
  it("accepts valid ROC specifications", () => {
    expect(Value.Check(RocSpecSchema, roc)).toBe(true);
  });

  it("rejects ROC values outside probability bounds", () => {
    const invalid = structuredClone(roc) as any;
    invalid.data[0].sensitivity = 1.2;
    expect(Value.Check(RocSpecSchema, invalid)).toBe(false);
  });

  it("accepts valid calibration specifications", () => {
    expect(Value.Check(CalibrationSpecSchema, calibration)).toBe(true);
  });

  it("rejects unknown calibration methods", () => {
    const invalid = structuredClone(calibration) as any;
    invalid.data[0].method = "loess";
    expect(Value.Check(CalibrationSpecSchema, invalid)).toBe(false);
  });
});
