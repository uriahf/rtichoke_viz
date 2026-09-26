import calibration from "./calibration.json" with { type: "json" };
import decisionCurve from "./decision-curve-single.json" with { type: "json" };
import gains from "./gains-shared-population.json" with { type: "json" };
import interventionsAvoided from "./interventions-avoided-single.json" with { type: "json" };
import lift from "./lift-shared-population.json" with { type: "json" };
import performanceTable from "../performance-table.json" with { type: "json" };
import precisionRecall from "./precision-recall-shared-population.json" with { type: "json" };
import roc from "./roc.json" with { type: "json" };
import type { ReportSpecV1_1, StandaloneCanonicalSpec } from "../../../src/spec/report.js";

export const demoStructuredReportFixture: ReportSpecV1_1 = {
  schemaVersion: "1.1",
  type: "report",
  title: "Comprehensive Model Performance Summary Report",
  sections: [
    {
      id: "calibration",
      title: "Calibration",
      items: [
        {
          type: "component",
          id: "calibration-discrete",
          title: "Discrete Calibration",
          spec: (calibration as unknown) as StandaloneCanonicalSpec,
        },
      ],
    },
    {
      id: "discrimination",
      title: "Discrimination",
      items: [
        {
          type: "group",
          id: "probability-threshold",
          title: "By Probability Threshold",
          components: [
            {
              type: "component",
              id: "roc-threshold",
              title: "Receiver Operating Characteristic (ROC)",
              spec: (roc as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "pr-threshold",
              title: "Precision-Recall Curve",
              spec: (precisionRecall as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "gains-threshold",
              title: "Cumulative Gains Chart",
              spec: (gains as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "lift-threshold",
              title: "Lift Chart",
              spec: (lift as unknown) as StandaloneCanonicalSpec,
            },
          ],
        },
        {
          type: "group",
          id: "ppcr",
          title: "By PPCR",
          components: [
            {
              type: "component",
              id: "roc-ppcr",
              title: "ROC Curve (by PPCR)",
              spec: (roc as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "pr-ppcr",
              title: "Precision-Recall Curve (by PPCR)",
              spec: (precisionRecall as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "gains-ppcr",
              title: "Cumulative Gains Chart (by PPCR)",
              spec: (gains as unknown) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "lift-ppcr",
              title: "Lift Chart (by PPCR)",
              spec: (lift as unknown) as StandaloneCanonicalSpec,
            },
          ],
        },
      ],
    },
    {
      id: "utility",
      title: "Utility",
      items: [
        {
          type: "component",
          id: "decision-curve",
          title: "Decision Curve Analysis",
          spec: (decisionCurve as unknown) as StandaloneCanonicalSpec,
        },
        {
          type: "component",
          id: "interventions-avoided",
          title: "Net Interventions Avoided",
          spec: (interventionsAvoided as unknown) as StandaloneCanonicalSpec,
        },
      ],
    },
    {
      id: "performance-table",
      title: "Performance Table",
      items: [
        {
          type: "group",
          id: "performance-probability-threshold",
          title: "By Probability Threshold",
          components: [
            {
              type: "component",
              id: "perf-table-thresh",
              title: "Performance Summary (by Probability Threshold)",
              spec: (performanceTable as unknown) as StandaloneCanonicalSpec,
            },
          ],
        },
        {
          type: "group",
          id: "performance-ppcr",
          title: "By PPCR",
          components: [
            {
              type: "component",
              id: "perf-table-ppcr",
              title: "Performance Summary (by PPCR)",
              spec: (performanceTable as unknown) as StandaloneCanonicalSpec,
            },
          ],
        },
      ],
    },
  ],
};
