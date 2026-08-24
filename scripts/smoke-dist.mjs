import assert from "node:assert/strict";

const viz = await import("../dist/rtichoke-viz.js");

for (const name of [
  "CalibrationSpecSchema",
  "CalibrationV2SpecSchema",
  "EvaluationSpecSchema",
  "GainsV2SpecSchema",
  "LiftV2SpecSchema",
  "PerformanceTableSpecSchema",
  "PrecisionRecallV2SpecSchema",
  "ReferenceLineV2SpecSchema",
  "ReportComponentSchema",
  "ReportSpecSchema",
  "RocSpecSchema",
  "RocV2SpecSchema",
  "RtichokeChartSpecSchema",
  "RtichokeChartSpecV2Schema",
  "SeriesSpecSchema",
  "assertPerformanceTableReferentialIntegrity",
  "assertReportReferentialIntegrity",
  "assertV2ReferentialIntegrity",
  "calibrationSpecFromRtichokeRows",
  "calibrationV2SpecFromRtichokeRows",
  "renderCalibration",
  "renderCalibrationV2",
  "renderGainsV2",
  "renderLiftV2",
  "renderPerformanceTable",
  "renderPrecisionRecallV2",
  "renderRoc",
  "renderRocV2",
  "rocSpecFromRtichokePython",
  "rocSpecFromRtichokeR",
  "rocV2SpecFromRtichokePython",
  "rocV2SpecFromRtichokeR",
]) {
  assert.ok(name in viz, `compiled bundle is missing export: ${name}`);
}

assert.equal(
  viz.RtichokeChartSpecSchema.$id,
  "https://rtichoke.dev/schema/viz/1.0.json",
);
assert.equal(
  viz.RtichokeChartSpecV2Schema.$id,
  "https://rtichoke.dev/schema/viz/2.0.json",
);
assert.equal(viz.ReportSpecSchema.$id, undefined);
