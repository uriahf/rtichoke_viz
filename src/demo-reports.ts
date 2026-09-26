import type { ReportSpec } from "./spec/report.js";

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

function buildDemoReport(
  reportPrefix: string,
  reportTitle: string,
  specs: {
    sm: any;
    calib: any;
    roc: any;
    pr: any;
    gains: any;
    lift: any;
    pd: any;
    perf: any;
  }
): ReportSpec {
  return {
    schemaVersion: "1.1",
    type: "report",
    title: reportTitle,
    sections: [
      {
        id: `${reportPrefix}-section-summary-metrics`,
        title: "Summary Metrics",
        items: [
          {
            type: "component",
            id: `${reportPrefix}-summary-metrics`,
            title: "Performance & Prevalence Summary",
            spec: specs.sm,
          },
        ],
      },
      {
        id: `${reportPrefix}-section-calibration`,
        title: "Calibration",
        items: [
          {
            type: "component",
            id: `${reportPrefix}-calibration`,
            title: "Calibration Analysis",
            spec: specs.calib,
          },
        ],
      },
      {
        id: `${reportPrefix}-section-discrimination`,
        title: "Discrimination",
        items: [
          {
            type: "group",
            id: `${reportPrefix}-probability-threshold`,
            title: "By Probability Threshold",
            components: [
              {
                type: "component",
                id: `${reportPrefix}-roc`,
                title: "Receiver Operating Characteristic (ROC)",
                spec: specs.roc,
              },
              {
                type: "component",
                id: `${reportPrefix}-pr`,
                title: "Precision-Recall Curve",
                spec: specs.pr,
              },
              {
                type: "component",
                id: `${reportPrefix}-gains`,
                title: "Cumulative Gains Chart",
                spec: specs.gains,
              },
              {
                type: "component",
                id: `${reportPrefix}-lift`,
                title: "Lift Chart",
                spec: specs.lift,
              },
            ],
          },
        ],
      },
      {
        id: `${reportPrefix}-section-prediction-distribution`,
        title: "Prediction Distribution",
        items: [
          {
            type: "component",
            id: `${reportPrefix}-prediction-distribution`,
            title: "Prediction Score Distribution",
            spec: specs.pd,
          },
        ],
      },
      {
        id: `${reportPrefix}-section-performance-table`,
        title: "Performance Table",
        items: [
          {
            type: "component",
            id: `${reportPrefix}-performance-table`,
            title: "Performance Metrics Summary Table",
            spec: specs.perf,
          },
        ],
      },
    ],
  };
}

export const demoReport1: ReportSpec = buildDemoReport(
  "report-1",
  "Summary Report — One Model, One Population",
  { sm: sm1, calib: calib1, roc: roc1, pr: pr1, gains: gains1, lift: lift1, pd: pd1, perf: perf1 }
);

export const demoReport2: ReportSpec = buildDemoReport(
  "report-2",
  "Summary Report — Multiple Models, One Population",
  { sm: sm2, calib: calib2, roc: roc2, pr: pr2, gains: gains2, lift: lift2, pd: pd2, perf: perf2 }
);

export const demoReport3: ReportSpec = buildDemoReport(
  "report-3",
  "Summary Report — One Model, Multiple Populations",
  { sm: sm3, calib: calib3, roc: roc3, pr: pr3, gains: gains3, lift: lift3, pd: pd3, perf: perf3 }
);
