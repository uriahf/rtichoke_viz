import assert from "node:assert/strict";

const viz = await import("../dist/rtichoke-viz.js");

for (const name of [
  "CalibrationSpecSchema", "CalibrationV2SpecSchema", "DecisionCurveV2SpecSchema",
  "EvaluationSpecSchema", "GainsV2SpecSchema", "LiftV2SpecSchema",
  "PerformanceTableSpecSchema", "PrecisionRecallV2SpecSchema", "ReferenceLineV2SpecSchema",
  "ReportComponentSchema", "ReportComponentV1_1Schema", "ReportGroupSchema", "ReportSectionSchema",
  "ReportSpecSchema", "ReportSpecV1_0Schema", "ReportSpecV1_1Schema", "RocSpecSchema", "RocV2SpecSchema",
  "RtichokeChartSpecSchema", "RtichokeChartSpecV2Schema", "SeriesSpecSchema",
  "TreatAllReferenceSchema", "TreatNoneReferenceSchema",
  "assertPerformanceTableReferentialIntegrity", "assertReportReferentialIntegrity", "assertV2ReferentialIntegrity",
  "calibrationSpecFromRtichokeRows", "calibrationV2SpecFromRtichokeRows",
  "renderCalibration", "renderCalibrationV2", "renderDecisionCurveV2", "renderGainsV2", "renderLiftV2",
  "renderPerformanceTable", "renderPrecisionRecallV2", "renderReport", "renderRoc", "renderRocV2",
  "rocSpecFromRtichokePython", "rocSpecFromRtichokeR", "rocV2SpecFromRtichokePython", "rocV2SpecFromRtichokeR",
]) assert.ok(name in viz, `compiled bundle is missing export: ${name}`);

assert.equal(viz.RtichokeChartSpecSchema.$id, "https://rtichoke.dev/schema/viz/1.0.json");
assert.equal(viz.RtichokeChartSpecV2Schema.$id, "https://rtichoke.dev/schema/viz/2.0.json");
assert.equal(viz.ReportSpecSchema.$id, "https://rtichoke.dev/schema/viz/report.json");
