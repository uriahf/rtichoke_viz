// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { RocV2SpecSchema, type RocV2Spec } from "../src/spec/v2/roc.js";
import { PrecisionRecallV2SpecSchema, type PrecisionRecallV2Spec } from "../src/spec/v2/precision_recall.js";
import { GainsV2SpecSchema, type GainsV2Spec } from "../src/spec/v2/gains.js";
import { LiftV2SpecSchema, type LiftV2Spec } from "../src/spec/v2/lift.js";
import { DecisionCurveV2SpecSchema, type DecisionCurveV2Spec } from "../src/spec/v2/decision-curve.js";
import { InterventionsAvoidedV2SpecSchema, type InterventionsAvoidedV2Spec } from "../src/spec/v2/interventions-avoided.js";
import {
  renderRocV2,
  renderPrecisionRecallV2,
  renderGainsV2,
  renderLiftV2,
  buildCarriedPerformanceTooltipFields,
  tooltip,
} from "../src/render/v2.js";
import { renderDecisionCurveV2 } from "../src/render/decision-curve.js";
import { renderInterventionsAvoidedV2 } from "../src/render/interventions-avoided.js";

const baseRocSpec: RocV2Spec = {
  schemaVersion: "2.0",
  type: "roc",
  evaluations: [{ id: "eval-1", population: "Pop 1" }],
  series: [{ id: "ser-1", evaluationId: "eval-1", display: { label: "Model A", group: "grp-1", role: "model" } }],
  xAxis: { label: "False Positive Rate", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  x: "false_positive_rate",
  y: "sensitivity",
  operatingPoint: { dimension: "probability_threshold" },
  data: [
    {
      seriesId: "ser-1",
      cutoff: 0.5,
      ppcr: 0.3,
      sensitivity: 0.8,
      specificity: 0.9,
    },
  ],
};

const basePrSpec: PrecisionRecallV2Spec = {
  schemaVersion: "2.0",
  type: "precision_recall",
  evaluations: [{ id: "eval-1", population: "Pop 1" }],
  series: [{ id: "ser-1", evaluationId: "eval-1", display: { label: "Model A", group: "grp-1", role: "model" } }],
  xAxis: { label: "Sensitivity", domain: [0, 1] },
  yAxis: { label: "PPV", domain: [0, 1] },
  x: "sensitivity",
  y: "ppv",
  operatingPoint: { dimension: "probability_threshold" },
  data: [
    {
      seriesId: "ser-1",
      cutoff: 0.5,
      ppcr: 0.3,
      sensitivity: 0.8,
      ppv: 0.75,
    },
  ],
};

const baseGainsSpec: GainsV2Spec = {
  schemaVersion: "2.0",
  type: "gains",
  evaluations: [{ id: "eval-1", population: "Pop 1" }],
  series: [{ id: "ser-1", evaluationId: "eval-1", display: { label: "Model A", group: "grp-1", role: "model" } }],
  xAxis: { label: "PPCR", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  x: "ppcr",
  y: "sensitivity",
  operatingPoint: { dimension: "ppcr" },
  data: [
    {
      seriesId: "ser-1",
      cutoff: 0.5,
      ppcr: 0.3,
      sensitivity: 0.8,
    },
  ],
};

const baseLiftSpec: LiftV2Spec = {
  schemaVersion: "2.0",
  type: "lift",
  evaluations: [{ id: "eval-1", population: "Pop 1" }],
  series: [{ id: "ser-1", evaluationId: "eval-1", display: { label: "Model A", group: "grp-1", role: "model" } }],
  xAxis: { label: "PPCR", domain: [0, 1] },
  yAxis: { label: "Lift", domain: [0, 5] },
  x: "ppcr",
  y: "lift",
  operatingPoint: { dimension: "ppcr" },
  data: [
    {
      seriesId: "ser-1",
      cutoff: 0.5,
      ppcr: 0.3,
      lift: 2.5,
    },
  ],
};

const baseDcaSpec: DecisionCurveV2Spec = {
  schemaVersion: "2.0",
  type: "decision_curve",
  evaluations: [{ id: "evaluation-1", model: "Model A", population: "Pop 1" }],
  series: [{ id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } }],
  xAxis: { label: "Probability Threshold", domain: [0, 1] },
  yAxis: { label: "Net Benefit", domain: [0, 0.5] },
  x: "threshold",
  y: "netBenefit",
  operatingPoint: { dimension: "probability_threshold" },
  references: [
    { type: "horizontal", value: 0, scope: "global", benchmark: "treat_none" },
    { type: "path", scope: "population", population: "Pop 1", benchmark: "treat_all", points: [{ x: 0, y: 0.1 }, { x: 1, y: 0 }] },
  ],
  data: [
    {
      seriesId: "series-1",
      threshold: 0.2,
      netBenefit: 0.12,
    },
  ],
};

const baseIaSpec: InterventionsAvoidedV2Spec = {
  schemaVersion: "2.0",
  type: "interventions_avoided",
  evaluations: [{ id: "evaluation-1", model: "Model A", population: "Pop 1" }],
  series: [{ id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } }],
  xAxis: { label: "Probability Threshold", domain: [0, 1] },
  yAxis: { label: "Interventions Avoided", domain: [0, 100] },
  x: "threshold",
  y: "interventionsAvoided",
  operatingPoint: { dimension: "probability_threshold" },
  references: [
    { type: "horizontal", value: 0, scope: "global", benchmark: "treat_all" },
    { type: "path", scope: "population", population: "Pop 1", benchmark: "treat_none", points: [{ x: 0, y: 0 }, { x: 1, y: 50 }] },
  ],
  data: [
    {
      seriesId: "series-1",
      threshold: 0.2,
      interventionsAvoided: 35,
    },
  ],
};

describe("Canonical Hover Carriage & Parity Tests", () => {
  describe("Schema Tests", () => {
    it("accepts rich optional performance metric carriage across all 6 curve components", () => {
      const perfPayload = [
        { metricId: "true_positives", estimate: 80 },
        { metricId: "true_negatives", estimate: 900 },
        { metricId: "false_positives", estimate: 100 },
        { metricId: "false_negatives", estimate: 20 },
        { metricId: "sensitivity", estimate: 0.8 },
        { metricId: "specificity", estimate: 0.9 },
        { metricId: "false_positive_rate", estimate: 0.1 },
        { metricId: "ppv", estimate: 0.444 },
        { metricId: "npv", estimate: 0.978 },
        { metricId: "lift", estimate: 2.222 },
        { metricId: "net_benefit", estimate: 0.06 },
        { metricId: "predicted_positives", estimate: 180 },
        { metricId: "ppcr", estimate: 0.164 },
        { metricId: "net_benefit_interventions_avoided", estimate: 35 },
      ] as const;

      const rocWithPerf: RocV2Spec = {
        ...baseRocSpec,
        data: [{ ...baseRocSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(RocV2SpecSchema, rocWithPerf)).toBe(true);

      const prWithPerf: PrecisionRecallV2Spec = {
        ...basePrSpec,
        data: [{ ...basePrSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(PrecisionRecallV2SpecSchema, prWithPerf)).toBe(true);

      const gainsWithPerf: GainsV2Spec = {
        ...baseGainsSpec,
        data: [{ ...baseGainsSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(GainsV2SpecSchema, gainsWithPerf)).toBe(true);

      const liftWithPerf: LiftV2Spec = {
        ...baseLiftSpec,
        data: [{ ...baseLiftSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(LiftV2SpecSchema, liftWithPerf)).toBe(true);

      const dcaWithPerf: DecisionCurveV2Spec = {
        ...baseDcaSpec,
        data: [{ ...baseDcaSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(DecisionCurveV2SpecSchema, dcaWithPerf)).toBe(true);

      const iaWithPerf: InterventionsAvoidedV2Spec = {
        ...baseIaSpec,
        data: [{ ...baseIaSpec.data[0], performance: [...perfPayload] }],
      };
      expect(Value.Check(InterventionsAvoidedV2SpecSchema, iaWithPerf)).toBe(true);
    });

    it("rejects invalid metric IDs in performance payload", () => {
      const invalidRoc = {
        ...baseRocSpec,
        data: [
          {
            ...baseRocSpec.data[0],
            performance: [{ metricId: "invalid_metric_name", estimate: 123 }],
          },
        ],
      };
      expect(Value.Check(RocV2SpecSchema, invalidRoc)).toBe(false);
    });

    it("maintains backward compatibility when performance is omitted", () => {
      expect(Value.Check(RocV2SpecSchema, baseRocSpec)).toBe(true);
      expect(Value.Check(PrecisionRecallV2SpecSchema, basePrSpec)).toBe(true);
      expect(Value.Check(GainsV2SpecSchema, baseGainsSpec)).toBe(true);
      expect(Value.Check(LiftV2SpecSchema, baseLiftSpec)).toBe(true);
      expect(Value.Check(DecisionCurveV2SpecSchema, baseDcaSpec)).toBe(true);
      expect(Value.Check(InterventionsAvoidedV2SpecSchema, baseIaSpec)).toBe(true);
    });
  });

  describe("Tooltip Tests for Full and Partial Performance Payloads", () => {
    it("renders exact ordering and formatting for ROC tooltip with full carried performance metrics", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        data: [
          {
            ...baseRocSpec.data[0],
            performance: [
              { metricId: "true_positives", estimate: 80 },
              { metricId: "true_negatives", estimate: 900 },
              { metricId: "false_positives", estimate: 100 },
              { metricId: "false_negatives", estimate: 20 },
              { metricId: "sensitivity", estimate: 0.8 },
              { metricId: "specificity", estimate: 0.9 },
              { metricId: "false_positive_rate", estimate: 0.1 },
              { metricId: "ppv", estimate: 0.444 },
              { metricId: "npv", estimate: 0.978 },
              { metricId: "lift", estimate: 2.222 },
              { metricId: "net_benefit", estimate: 0.06 },
              { metricId: "predicted_positives", estimate: 180 },
            ],
          },
        ],
      };

      const datum = spec.data[0];
      const fpr = 1 - datum.specificity;
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["Cutoff", datum.cutoff],
        ["PPCR", datum.ppcr],
        ["Sensitivity", datum.sensitivity],
        ["Specificity", datum.specificity],
        ["FPR", fpr],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "sensitivity",
            "specificity",
            "false_positive_rate",
            "ppv",
            "npv",
            "lift",
            "net_benefit",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["sensitivity", "specificity", "false_positive_rate"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "FPR: 0.100",
        "PPV: 0.444",
        "NPV: 0.978",
        "Lift: 2.222",
        "Net Benefit: 0.060",
        "Predicted Positives: 180",
        "TP: 80",
        "TN: 900",
        "FP: 100",
        "FN: 20",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("supplements ROC native fields without duplication when partial performance is supplied", () => {
      const partialRocSpec: RocV2Spec = {
        ...baseRocSpec,
        data: [
          {
            ...baseRocSpec.data[0],
            performance: [{ metricId: "true_positives", estimate: 80 }],
          },
        ],
      };

      const datum = partialRocSpec.data[0];
      const fpr = 1 - datum.specificity;
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["Cutoff", datum.cutoff],
        ["PPCR", datum.ppcr],
        ["Sensitivity", datum.sensitivity],
        ["Specificity", datum.specificity],
        ["FPR", fpr],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "sensitivity",
            "specificity",
            "false_positive_rate",
            "ppv",
            "npv",
            "lift",
            "net_benefit",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["sensitivity", "specificity", "false_positive_rate"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "FPR: 0.100",
        "TP: 80",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("supplements Precision-Recall native fields when partial performance is supplied", () => {
      const partialPrSpec: PrecisionRecallV2Spec = {
        ...basePrSpec,
        data: [
          {
            ...basePrSpec.data[0],
            performance: [{ metricId: "true_negatives", estimate: 900 }],
          },
        ],
      };

      const datum = partialPrSpec.data[0];
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["Cutoff", datum.cutoff],
        ["PPCR", datum.ppcr],
        ["Sensitivity", datum.sensitivity],
        ["PPV", datum.ppv],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "sensitivity",
            "ppv",
            "specificity",
            "false_positive_rate",
            "npv",
            "lift",
            "net_benefit",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["sensitivity", "ppv"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "PPV: 0.750",
        "TN: 900",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("supplements Gains native fields when partial performance is supplied", () => {
      const partialGainsSpec: GainsV2Spec = {
        ...baseGainsSpec,
        data: [
          {
            ...baseGainsSpec.data[0],
            performance: [{ metricId: "ppv", estimate: 0.75 }],
          },
        ],
      };

      const datum = partialGainsSpec.data[0];
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["PPCR", datum.ppcr],
        ["Cutoff", datum.cutoff],
        ["Sensitivity", datum.sensitivity],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "sensitivity",
            "specificity",
            "false_positive_rate",
            "ppv",
            "npv",
            "lift",
            "net_benefit",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["sensitivity"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
        "Sensitivity: 0.800",
        "PPV: 0.750",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("supplements Lift native fields when partial performance is supplied", () => {
      const partialLiftSpec: LiftV2Spec = {
        ...baseLiftSpec,
        data: [
          {
            ...baseLiftSpec.data[0],
            performance: [{ metricId: "sensitivity", estimate: 0.8 }],
          },
        ],
      };

      const datum = partialLiftSpec.data[0];
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["PPCR", datum.ppcr],
        ["Cutoff", datum.cutoff],
        ["Lift", datum.lift],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "lift",
            "sensitivity",
            "specificity",
            "false_positive_rate",
            "ppv",
            "npv",
            "net_benefit",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["lift"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
        "Lift: 2.500",
        "Sensitivity: 0.800",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("supplements Decision Curve native fields when partial performance is supplied", () => {
      const partialDcaSpec: DecisionCurveV2Spec = {
        ...baseDcaSpec,
        data: [
          {
            ...baseDcaSpec.data[0],
            performance: [{ metricId: "true_positives", estimate: 80 }],
          },
        ],
      };

      const datum = partialDcaSpec.data[0];
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["Threshold", datum.threshold],
        ["Net Benefit", datum.netBenefit],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "net_benefit",
            "ppcr",
            "sensitivity",
            "specificity",
            "false_positive_rate",
            "ppv",
            "npv",
            "lift",
            "predicted_positives",
            "true_positives",
            "true_negatives",
            "false_positives",
            "false_negatives",
          ],
          3,
          new Set(["net_benefit"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Net Benefit: 0.120",
        "TP: 80",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });

    it("renders exact ordering for Interventions Avoided tooltip without duplicate IA carriage", () => {
      const spec: InterventionsAvoidedV2Spec = {
        ...baseIaSpec,
        data: [
          {
            ...baseIaSpec.data[0],
            performance: [
              { metricId: "net_benefit_interventions_avoided", estimate: 35 },
              { metricId: "net_benefit", estimate: 0.07 },
              { metricId: "predicted_positives", estimate: 180 },
              { metricId: "ppcr", estimate: 0.18 },
              { metricId: "true_negatives", estimate: 820 },
              { metricId: "false_negatives", estimate: 20 },
            ],
          },
        ],
      };

      const datum = spec.data[0];
      const fields: Array<[string, unknown]> = [
        ["Series", "Model A"],
        ["Threshold", datum.threshold],
        ["Interventions Avoided", datum.interventionsAvoided],
      ];
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          [
            "net_benefit_interventions_avoided",
            "net_benefit",
            "predicted_positives",
            "ppcr",
            "true_negatives",
            "false_negatives",
          ],
          3,
          new Set(["net_benefit_interventions_avoided"]),
        ),
      );

      const titleText = tooltip(3, fields);
      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Interventions Avoided: 35.000",
        "Net Benefit: 0.070",
        "Predicted Positives: 180",
        "PPCR: 0.180",
        "TN: 820",
        "FN: 20",
      ];
      expect(titleText).toBe(expectedLines.join("\n"));
    });
  });

  describe("Operating Point Marker Tests", () => {
    it("renders selected operating point marker at 12px diameter (r=6) by default", () => {
      const element = renderRocV2(baseRocSpec) as HTMLElement;
      const selectedDot = element.querySelector(".rtichoke-selected-operating-point circle, circle.rtichoke-selected-operating-point");
      expect(selectedDot).not.toBeNull();
      expect(selectedDot?.getAttribute("r")).toBe("6");
    });

    it("allows explicit theme marker radius override for selected operating point marker", () => {
      const element = renderRocV2(baseRocSpec, {
        theme: { marker: { radius: 8 } },
      }) as HTMLElement;
      const selectedDot = element.querySelector(".rtichoke-selected-operating-point circle, circle.rtichoke-selected-operating-point");
      expect(selectedDot).not.toBeNull();
      expect(selectedDot?.getAttribute("r")).toBe("8");
    });

    it("ensures selected operating point marker element is rendered for selected operating point with identical datum title", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        data: [
          {
            ...baseRocSpec.data[0],
            performance: [
              { metricId: "true_positives", estimate: 80 },
              { metricId: "sensitivity", estimate: 0.8 },
            ],
          },
        ],
      };
      const element = renderRocV2(spec) as HTMLElement;
      expect(element).not.toBeNull();
      const selectedDot = element.querySelector(".rtichoke-selected-operating-point circle");
      expect(selectedDot).not.toBeNull();
      expect(selectedDot?.getAttribute("r")).toBe("6");
    });
  });
});
