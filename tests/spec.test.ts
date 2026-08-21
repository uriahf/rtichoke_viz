import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { RtichokeChartSpecSchema } from "../src/spec/chart.js";
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
  distribution: [
    { model: "Model A", midpoint: 0.2, count: 12, binWidth: 0.1 },
  ],
  x: "predicted",
  y: "observed",
  xAxis: { label: "Predicted probability", domain: [0, 1] },
  yAxis: { label: "Observed probability", domain: [0, 1] },
  references: [{ type: "identity" }],
} as const;

function invalidCopy<T>(value: T): any {
  return structuredClone(value);
}

describe("rtichoke visualization specs", () => {
  it("accepts valid ROC specifications", () => {
    expect(Value.Check(RocSpecSchema, roc)).toBe(true);
  });

  it.each([
    ["sensitivity", 1.2],
    ["specificity", -0.1],
  ])("rejects ROC %s outside probability bounds", (field, value) => {
    const invalid = invalidCopy(roc);
    invalid.data[0][field] = value;
    expect(Value.Check(RocSpecSchema, invalid)).toBe(false);
  });

  it("accepts valid calibration specifications", () => {
    expect(Value.Check(CalibrationSpecSchema, calibration)).toBe(true);
  });

  it.each([
    ["predicted", 1.01],
    ["observed", -0.01],
  ])("rejects calibration %s outside probability bounds", (field, value) => {
    const invalid = invalidCopy(calibration);
    invalid.data[0][field] = value;
    expect(Value.Check(CalibrationSpecSchema, invalid)).toBe(false);
  });

  it("rejects unknown calibration methods", () => {
    const invalid = invalidCopy(calibration);
    invalid.data[0].method = "loess";
    expect(Value.Check(CalibrationSpecSchema, invalid)).toBe(false);
  });

  it.each([
    ["count", -1],
    ["binWidth", 0],
    ["midpoint", 1.1],
  ])("rejects invalid calibration distribution %s", (field, value) => {
    const invalid = invalidCopy(calibration);
    invalid.distribution[0][field] = value;
    expect(Value.Check(CalibrationSpecSchema, invalid)).toBe(false);
  });

  it("rejects unsupported schema versions", () => {
    const invalid = invalidCopy(roc);
    invalid.schemaVersion = "2.0";
    expect(Value.Check(RtichokeChartSpecSchema, invalid)).toBe(false);
  });

  it("rejects unknown chart types", () => {
    const invalid = invalidCopy(roc);
    invalid.type = "decision_curve";
    expect(Value.Check(RtichokeChartSpecSchema, invalid)).toBe(false);
  });

  it("rejects malformed axis domains", () => {
    const invalid = invalidCopy(roc);
    invalid.xAxis.domain = [0, 0.5, 1];
    expect(Value.Check(RocSpecSchema, invalid)).toBe(false);
  });
});
