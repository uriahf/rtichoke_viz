import assert from "node:assert/strict";

const viz = await import("../dist/rtichoke-viz.js");

for (const name of [
  "CalibrationSpecSchema",
  "RocSpecSchema",
  "RtichokeChartSpecSchema",
  "calibrationSpecFromRtichokeRows",
  "renderCalibration",
  "renderRoc",
  "rocSpecFromRtichokePython",
  "rocSpecFromRtichokeR",
]) {
  assert.ok(name in viz, `compiled bundle is missing export: ${name}`);
}
