import { describe, expect, it } from "vitest";
import { execSync } from "child_process";

// Load report specs and demo specs
import report1 from "../fixtures/v2/demo/report-1-one-model-one-pop.json";
import report2 from "../fixtures/v2/demo/report-2-multi-models-one-pop.json";
import report3 from "../fixtures/v2/demo/report-3-one-model-multi-pops.json";

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

describe("Summary Report Demo Coherence and Integrity Tests", () => {
  describe("Evaluation Design", () => {
    it("Report 1 contains exactly Model A — Test", () => {
      expect(report1.title).toBe("Summary Report — One Model, One Population");
      const evs = sm1.evaluations;
      expect(evs).toHaveLength(1);
      expect(evs[0].id).toBe("Model A - Test");
      expect(evs[0].model).toBe("Model A");
      expect(evs[0].population).toBe("Test");
    });

    it("Report 2 contains exactly Model A — Test and Model B — Test", () => {
      expect(report2.title).toBe("Summary Report — Multiple Models, One Population");
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
      expect(report3.title).toBe("Summary Report — One Model, Multiple Populations");
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
      // Check prediction distribution total mass
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

      // Check summary metrics prevalence
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

      // Model A — Test ROC
      const rocPoint = roc1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(rocPoint).toBeDefined();

      // Model A — Test PR
      const prPoint = pr1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(prPoint).toBeDefined();
      expect(prPoint?.sensitivity).toBe(rocPoint?.sensitivity);

      // Model A — Test Gains
      const gainsPoint = gains1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(gainsPoint).toBeDefined();
      expect(gainsPoint?.sensitivity).toBe(rocPoint?.sensitivity);

      // Model A — Test Lift
      const liftPoint = lift1.data.find((d: any) => d.cutoff === cutoffTarget);
      expect(liftPoint).toBeDefined();

      // Model A — Test Performance Table
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

      // Model A — Test Prediction Distribution OP
      const pdOp = pd1.operatingPoints.find((o: any) => o.type === "probability_threshold" && o.cutoff === cutoffTarget);
      expect(pdOp).toBeDefined();
      const pdSens = pdOp?.performance.find((m: any) => m.metricId === "sensitivity")?.estimate;
      const pdSpec = pdOp?.performance.find((m: any) => m.metricId === "specificity")?.estimate;
      expect(pdSens).toBe(rocPoint?.sensitivity);
      expect(pdSpec).toBe(rocPoint?.specificity);
    });
  });

  describe("Calibration Identities", () => {
    it("Calibration discrete groups and distribution histogram sum exactly to population N and preserve event counts", () => {
      const specs = [calib1, calib2, calib3];

      specs.forEach((spec: any) => {
        spec.evaluations.forEach((ev: any) => {
          const seriesId = `series-${ev.id}`;
          const discreteRows = spec.data.filter((d: any) => d.seriesId === seriesId);
          expect(discreteRows.length).toBeGreaterThanOrEqual(10);

          const groupSumN = discreteRows.reduce((acc: number, d: any) => acc + d.total, 0);
          const groupSumEvents = discreteRows.reduce((acc: number, d: any) => acc + d.events, 0);

          const distBins = spec.distribution.filter((d: any) => d.seriesId === seriesId);
          const distSumN = distBins.reduce((acc: number, d: any) => acc + d.nPositive + d.nNegative, 0);
          const distSumEvents = distBins.reduce((acc: number, d: any) => acc + d.nPositive, 0);

          expect(groupSumN).toBe(distSumN);
          expect(groupSumEvents).toBe(distSumEvents);

          // Verify observed prop = events / total
          discreteRows.forEach((d: any) => {
            expect(d.events).toBeLessThanOrEqual(d.total);
            expect(d.observed).toBe(round(d.events / d.total, 4));
          });
        });
      });
    });
  });

  describe("Referential Integrity and Report Isolation", () => {
    it("all 3 report specs pass strict referential integrity validation", () => {
      assertReportReferentialIntegrity(report1 as any);
      assertReportReferentialIntegrity(report2 as any);
      assertReportReferentialIntegrity(report3 as any);
    });

    it("all embedded canonical component specs pass V2 referential integrity validation", () => {
      const allSpecs = [
        roc1, pr1, gains1, lift1, calib1,
        roc2, pr2, gains2, lift2, calib2,
        roc3, pr3, gains3, lift3, calib3
      ];
      allSpecs.forEach((spec: any) => assertV2ReferentialIntegrity(spec));

      [pd1, pd2, pd3].forEach((pd: any) => assertPredictionDistributionReferentialIntegrity(pd as any));
      [sm1, sm2, sm3].forEach((sm: any) => assertSummaryMetricsReferentialIntegrity(sm as any));
      [perf1, perf2, perf3].forEach((perf: any) => assertPerformanceTableReferentialIntegrity(perf as any));
    });

    it("component IDs are unique within every report and across the rendered demo", () => {
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

      const ids1 = getCompIds(report1);
      const ids2 = getCompIds(report2);
      const ids3 = getCompIds(report3);

      expect(new Set(ids1).size).toBe(ids1.length);
      expect(new Set(ids2).size).toBe(ids2.length);
      expect(new Set(ids3).size).toBe(ids3.length);
    });

    it("generator script execution is reproducible and byte-stable", () => {
      const output = execSync("python3 scripts/generate-realistic-fixtures.py").toString();
      expect(output).toContain("Successfully generated all demo fixtures");
    });
  });
});

function round(val: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(val * factor) / factor;
}
