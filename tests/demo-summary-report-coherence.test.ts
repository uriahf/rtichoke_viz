// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Load composed demo report specs
import { demoReport1, demoReport2, demoReport3 } from "../src/demo-reports.js";

// Load standalone demo specs
import roc1 from "../fixtures/v2/demo/model-a-test-roc.json";
import pr1 from "../fixtures/v2/demo/model-a-test-precision-recall.json";
import gains1 from "../fixtures/v2/demo/model-a-test-gains.json";
import lift1 from "../fixtures/v2/demo/model-a-test-lift.json";
import calib1 from "../fixtures/v2/demo/model-a-test-calibration.json";
import pd1 from "../fixtures/v2/demo/model-a-test-prediction-distribution.json";
import sm1 from "../fixtures/v2/demo/model-a-test-summary-metrics.json";
import perf1 from "../fixtures/v2/demo/model-a-test-performance-table.json";

import roc2 from "../fixtures/v2/demo/models-a-b-test-roc.json";
import pr2 from "../fixtures/v2/demo/models-a-b-test-precision-recall.json";
import gains2 from "../fixtures/v2/demo/models-a-b-test-gains.json";
import lift2 from "../fixtures/v2/demo/models-a-b-test-lift.json";
import calib2 from "../fixtures/v2/demo/models-a-b-test-calibration.json";
import pd2 from "../fixtures/v2/demo/models-a-b-test-prediction-distribution.json";
import sm2 from "../fixtures/v2/demo/models-a-b-test-summary-metrics.json";
import perf2 from "../fixtures/v2/demo/models-a-b-test-performance-table.json";

import roc3 from "../fixtures/v2/demo/model-a-train-test-val-roc.json";
import pr3 from "../fixtures/v2/demo/model-a-train-test-val-precision-recall.json";
import gains3 from "../fixtures/v2/demo/model-a-train-test-val-gains.json";
import lift3 from "../fixtures/v2/demo/model-a-train-test-val-lift.json";
import calib3 from "../fixtures/v2/demo/model-a-train-test-val-calibration.json";
import pd3 from "../fixtures/v2/demo/model-a-train-test-val-prediction-distribution.json";
import sm3 from "../fixtures/v2/demo/model-a-train-test-val-summary-metrics.json";
import perf3 from "../fixtures/v2/demo/model-a-train-test-val-performance-table.json";

import { assertReportReferentialIntegrity } from "../src/spec/validate-report.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";
import { assertPredictionDistributionReferentialIntegrity } from "../src/spec/v2/validate-prediction-distribution.js";
import { assertSummaryMetricsReferentialIntegrity } from "../src/spec/v2/validate-summary-metrics.js";
import { assertPerformanceTableReferentialIntegrity } from "../src/spec/v2/validate-performance-table.js";

import { Value } from "@sinclair/typebox/value";
import { ReportSpecV1_1Schema } from "../src/spec/report.js";
import { RocV2SpecSchema } from "../src/spec/v2/roc.js";
import { CalibrationV2SpecSchema } from "../src/spec/v2/calibration.js";
import { PrecisionRecallV2SpecSchema } from "../src/spec/v2/precision_recall.js";
import { GainsV2SpecSchema } from "../src/spec/v2/gains.js";
import { LiftV2SpecSchema } from "../src/spec/v2/lift.js";
import { PredictionDistributionSpecSchema } from "../src/spec/v2/prediction-distribution.js";
import { SummaryMetricsSpecSchema } from "../src/spec/v2/summary-metrics.js";
import { PerformanceTableSpecSchema } from "../src/spec/v2/performance-table.js";

import { renderReport } from "../src/render/report.js";

describe("Summary Report Demo Coherence and Integrity Tests", () => {
  describe("Evaluation Design", () => {
    it("Report 1 contains exactly Model A — Test", () => {
      expect(demoReport1.title).toBe("Summary Report — One Model, One Population");
      const evs = sm1.evaluations;
      expect(evs).toHaveLength(1);
      expect(evs[0].id).toBe("Model A - Test");
      expect(evs[0].model).toBe("Model A");
      expect(evs[0].population).toBe("Test");
    });

    it("Report 2 contains exactly Model A — Test and Model B — Test", () => {
      expect(demoReport2.title).toBe("Summary Report — Multiple Models, One Population");
      const evs = sm2.evaluations;
      expect(evs).toHaveLength(2);
      expect(evs[0].id).toBe("Model A - Test");
      expect(evs[0].model).toBe("Model A");
      expect(evs[0].population).toBe("Test");

      expect(evs[1].id).toBe("Model B - Test");
      expect(evs[1].model).toBe("Model B");
      expect(evs[1].population).toBe("Test");
    });

    it("Report 3 contains exactly Model A across Train, Test, and Validation", () => {
      expect(demoReport3.title).toBe("Summary Report — One Model, Multiple Populations");
      const evs = sm3.evaluations;
      expect(evs).toHaveLength(3);

      expect(evs[0].id).toBe("Model A - Train");
      expect(evs[0].model).toBe("Model A");
      expect(evs[0].population).toBe("Train");

      expect(evs[1].id).toBe("Model A - Test");
      expect(evs[1].model).toBe("Model A");
      expect(evs[1].population).toBe("Test");

      expect(evs[2].id).toBe("Model A - Validation");
      expect(evs[2].model).toBe("Model A");
      expect(evs[2].population).toBe("Validation");
    });
  });

  describe("Same-Population Invariants (Model A vs Model B on Test)", () => {
    it("Model A — Test and Model B — Test share identical N, event totals, non-event totals, and prevalence", () => {
      const evA_bins = pd2.bins.filter((b: any) => b.evaluationId === "Model A - Test");
      const evB_bins = pd2.bins.filter((b: any) => b.evaluationId === "Model B - Test");

      const posA = evA_bins.reduce((acc: number, b: any) => acc + b.nPositive, 0);
      const negA = evA_bins.reduce((acc: number, b: any) => acc + b.nNegative, 0);

      const posB = evB_bins.reduce((acc: number, b: any) => acc + b.nPositive, 0);
      const negB = evB_bins.reduce((acc: number, b: any) => acc + b.nNegative, 0);

      expect(posA).toBe(posB);
      expect(negA).toBe(negB);
      expect(posA + negA).toBe(3000);
      expect(posB + negB).toBe(3000);

      const prevMetric = sm2.metrics.find((m: any) => m.metric === "prevalence");
      expect(prevMetric).toBeDefined();
      expect(prevMetric?.estimate).toBe(round(posA / 3000, 4));
    });
  });

  describe("Same-Model Invariants (Model A across Train, Test, Validation)", () => {
    it("Model A on Train, Test, and Validation shares model ID but has distinct population IDs and credible sample sizes", () => {
      const trainBins = pd3.bins.filter((b: any) => b.evaluationId === "Model A - Train");
      const testBins = pd3.bins.filter((b: any) => b.evaluationId === "Model A - Test");
      const valBins = pd3.bins.filter((b: any) => b.evaluationId === "Model A - Validation");

      const trainN = trainBins.reduce((acc: number, b: any) => acc + b.nPositive + b.nNegative, 0);
      const testN = testBins.reduce((acc: number, b: any) => acc + b.nPositive + b.nNegative, 0);
      const valN = valBins.reduce((acc: number, b: any) => acc + b.nPositive + b.nNegative, 0);

      expect(trainN).toBe(5000);
      expect(testN).toBe(3000);
      expect(valN).toBe(2000);

      expect(trainN).toBeGreaterThanOrEqual(1000);
      expect(testN).toBeGreaterThanOrEqual(1000);
      expect(valN).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("Cross-Component Operating Point Consistency", () => {
    it("ROC, PR, Gains, Lift, Performance Table, and Prediction Distribution agree at corresponding cutoff operating points", () => {
      const cutoffTarget = 0.50;

      const rocPoint = roc1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(rocPoint).toBeDefined();

      const prPoint = pr1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(prPoint).toBeDefined();
      expect(prPoint?.sensitivity).toBe(rocPoint?.sensitivity);

      const gainsPoint = gains1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(gainsPoint).toBeDefined();
      expect(gainsPoint?.sensitivity).toBe(rocPoint?.sensitivity);

      const liftPoint = lift1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(liftPoint).toBeDefined();

      const perfRow = perf1.rows.find((r: any) => r.operatingPoint.cutoff === cutoffTarget);
      expect(perfRow).toBeDefined();
      const sensVal = perfRow?.values.find((v: any) => v.metricId === "sensitivity")?.estimate;
      const specVal = perfRow?.values.find((v: any) => v.metricId === "specificity")?.estimate;
      const ppvVal = perfRow?.values.find((v: any) => v.metricId === "ppv")?.estimate;
      const liftVal = perfRow?.values.find((v: any) => v.metricId === "lift")?.estimate;

      expect(sensVal).toBe(rocPoint?.sensitivity);
      expect(specVal).toBe(rocPoint?.specificity);
      expect(ppvVal).toBe(prPoint?.ppv);
      expect(liftVal).toBe(liftPoint?.lift);

      const pdOp = pd1.operatingPoints.find((o: any) => o.type === "probability_threshold" && o.cutoff === cutoffTarget);
      expect(pdOp).toBeDefined();
      const pdSens = pdOp?.performance.find((m: any) => m.metricId === "sensitivity")?.estimate;
      const pdSpec = pdOp?.performance.find((m: any) => m.metricId === "specificity")?.estimate;
      expect(pdSens).toBe(rocPoint?.sensitivity);
      expect(pdSpec).toBe(rocPoint?.specificity);
    });
  });

  describe("Calibration Identities", () => {
    it("Calibration discrete groups and distribution histogram sum exactly to population N with finite numbers", () => {
      const testCases = [
        { spec: calib1, expectedN: [3000], expectedEvents: [1257] },
        { spec: calib2, expectedN: [3000, 3000], expectedEvents: [1257, 1257] },
        { spec: calib3, expectedN: [5000, 3000, 2000], expectedEvents: [2076, 1257, 924] },
      ];

      testCases.forEach(({ spec, expectedN, expectedEvents }) => {
        spec.evaluations.forEach((ev: any, idx: number) => {
          const seriesId = `series-${ev.id}`;
          const discreteRows = spec.data.filter((d: any) => d.seriesId === seriesId);
          expect(discreteRows.length).toBeGreaterThanOrEqual(10);

          const groupSumN = discreteRows.reduce((acc: number, d: any) => acc + d.total, 0);
          const groupSumEvents = discreteRows.reduce((acc: number, d: any) => acc + d.events, 0);

          expect(Number.isFinite(groupSumN)).toBe(true);
          expect(Number.isFinite(groupSumEvents)).toBe(true);
          expect(groupSumN).toBe(expectedN[idx]);
          expect(groupSumEvents).toBe(expectedEvents[idx]);

          const distBins = spec.distribution.filter((d: any) => d.seriesId === seriesId);
          const distSumN = distBins.reduce((acc: number, d: any) => acc + d.count, 0);

          expect(Number.isFinite(distSumN)).toBe(true);
          expect(distSumN).toBe(expectedN[idx]);
          expect(groupSumN).toBe(distSumN);

          discreteRows.forEach((d: any) => {
            expect(Number.isFinite(d.total)).toBe(true);
            expect(Number.isFinite(d.events)).toBe(true);
            expect(Number.isFinite(d.predicted)).toBe(true);
            expect(Number.isFinite(d.observed)).toBe(true);
            expect(d.events).toBeLessThanOrEqual(d.total);
            expect(d.observed).toBe(round(d.events / d.total, 4));
          });
        });
      });
    });
  });

  describe("Referential Integrity, Schema Checking, and Report Component ID Uniqueness", () => {
    it("all 3 report specs pass strict Value.Check(ReportSpecV1_1Schema) and referential integrity", () => {
      [demoReport1, demoReport2, demoReport3].forEach((report) => {
        expect(Value.Check(ReportSpecV1_1Schema, report)).toBe(true);
        assertReportReferentialIntegrity(report);
      });
    });

    it("all standalone demo component specs pass explicit Value.Check and V2 referential integrity", () => {
      const testPairs: [any, any][] = [
        [roc1, RocV2SpecSchema],
        [roc2, RocV2SpecSchema],
        [roc3, RocV2SpecSchema],
        [calib1, CalibrationV2SpecSchema],
        [calib2, CalibrationV2SpecSchema],
        [calib3, CalibrationV2SpecSchema],
        [pr1, PrecisionRecallV2SpecSchema],
        [pr2, PrecisionRecallV2SpecSchema],
        [pr3, PrecisionRecallV2SpecSchema],
        [gains1, GainsV2SpecSchema],
        [gains2, GainsV2SpecSchema],
        [gains3, GainsV2SpecSchema],
        [lift1, LiftV2SpecSchema],
        [lift2, LiftV2SpecSchema],
        [lift3, LiftV2SpecSchema],
      ];

      testPairs.forEach(([spec, schema]) => {
        expect(Value.Check(schema, spec)).toBe(true);
        assertV2ReferentialIntegrity(spec);
      });

      [pd1, pd2, pd3].forEach((pd: any) => {
        expect(Value.Check(PredictionDistributionSpecSchema, pd)).toBe(true);
        assertPredictionDistributionReferentialIntegrity(pd);
      });

      [sm1, sm2, sm3].forEach((sm: any) => {
        expect(Value.Check(SummaryMetricsSpecSchema, sm)).toBe(true);
        assertSummaryMetricsReferentialIntegrity(sm);
      });

      [perf1, perf2, perf3].forEach((perf: any) => {
        expect(Value.Check(PerformanceTableSpecSchema, perf)).toBe(true);
        assertPerformanceTableReferentialIntegrity(perf);
      });
    });

    it("component IDs are globally unique across all three demo reports", () => {
      const getCompIds = (report: any) => {
        const ids: string[] = [];
        report.sections.forEach((sec: any) => {
          sec.items.forEach((item: any) => {
            if (item.type === "component") {
              ids.push(item.id);
            } else if (item.type === "group") {
              item.components.forEach((c: any) => ids.push(c.id));
            }
          });
        });
        return ids;
      };

      const ids1 = getCompIds(demoReport1);
      const ids2 = getCompIds(demoReport2);
      const ids3 = getCompIds(demoReport3);

      expect(new Set(ids1).size).toBe(ids1.length);
      expect(new Set(ids2).size).toBe(ids2.length);
      expect(new Set(ids3).size).toBe(ids3.length);

      const allIds = [...ids1, ...ids2, ...ids3];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("rendered report DOM elements have globally unique element IDs", () => {
      const container = document.createElement("div");
      container.append(renderReport(demoReport1));
      container.append(renderReport(demoReport2));
      container.append(renderReport(demoReport3));

      const elementsWithId = container.querySelectorAll("[id]");
      const domIds = Array.from(elementsWithId).map((el) => el.getAttribute("id")!);

      expect(new Set(domIds).size).toBe(domIds.length);
    });
  });

  describe("Generator Reproducibility and Protected Fixture Invariants", () => {
    it("generator output in a temporary directory matches committed demo fixtures byte-for-byte", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rtichoke-fixture-test-"));
      try {
        execSync(`python3 scripts/generate-realistic-fixtures.py "${tmpDir}"`);

        const committedDir = path.resolve(__dirname, "../fixtures/v2/demo");
        const generatedFiles = fs.readdirSync(tmpDir).sort();
        const committedFiles = fs.readdirSync(committedDir).sort();

        expect(generatedFiles).toEqual(committedFiles);

        for (const filename of generatedFiles) {
          const genPath = path.join(tmpDir, filename);
          const comPath = path.join(committedDir, filename);

          const genBuf = fs.readFileSync(genPath);
          const comBuf = fs.readFileSync(comPath);

          expect(genBuf.equals(comBuf)).toBe(true);
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("protected prediction distribution canonical fixtures remain byte-identical to origin/main", () => {
      const protectedFiles = [
        "fixtures/v2/prediction-distribution-single.json",
        "fixtures/v2/prediction-distribution-multi.json",
        "fixtures/v2/prediction-distribution-visual.json",
      ];

      for (const relPath of protectedFiles) {
        const currentContent = fs.readFileSync(relPath);
        const originContent = execSync(`git show origin/main:${relPath}`);
        expect(currentContent.equals(originContent)).toBe(true);
      }
    });
  });
});

function round(val: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(val * factor) / factor;
}
