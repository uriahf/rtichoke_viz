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
} from "../src/render/v2.js";
import { renderDecisionCurveV2 } from "../src/render/decision-curve.js";
import { renderInterventionsAvoidedV2 } from "../src/render/interventions-avoided.js";

if (typeof SVGElement !== "undefined") {
  const polyfillBBox = () => ({ x: 0, y: 0, width: 100, height: 20 });
  if (!(SVGElement.prototype as any).getBBox) (SVGElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGGElement !== "undefined" && !(SVGGElement.prototype as any).getBBox) (SVGGElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGTextElement !== "undefined" && !(SVGTextElement.prototype as any).getBBox) (SVGTextElement.prototype as any).getBBox = polyfillBBox;
  if (typeof SVGPathElement !== "undefined" && !(SVGPathElement.prototype as any).getBBox) (SVGPathElement.prototype as any).getBBox = polyfillBBox;
}

function getDomTipLines(element: HTMLElement | SVGSVGElement): string[] {
  const circle = element.querySelector("circle");
  if (circle) {
    const cx = Number(circle.getAttribute("cx") ?? 100);
    const cy = Number(circle.getAttribute("cy") ?? 100);
    circle.dispatchEvent(
      new (window as any).PointerEvent("pointermove", {
        bubbles: true,
        clientX: cx,
        clientY: cy,
      }),
    );
  } else {
    element.dispatchEvent(
      new (window as any).PointerEvent("pointermove", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
  }

  const tipTextEls = Array.from(element.querySelectorAll('g[aria-label="tip"] text'));
  for (const tipTextEl of tipTextEls) {
    const topTspans = Array.from(tipTextEl.children).filter(
      (el) => el.tagName.toLowerCase() === "tspan",
    );
    if (topTspans.length > 0) {
      const boldEl = topTspans[0].querySelector('tspan[font-weight="bold"]');
      const firstLabel = boldEl ? boldEl.textContent?.trim() ?? "" : "";
      if (firstLabel === "Reference") continue;
      return topTspans.map((ts) => {
        const bold = ts.querySelector('tspan[font-weight="bold"]');
        const label = bold ? bold.textContent?.trim() ?? "" : "";
        const rawText = (ts.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
        const val = rawText.slice(label.length).trim();
        return `${label}: ${val}`;
      });
    }
  }
  return [];
}

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

const fullPerfPayload = [
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

describe("Canonical Hover Carriage & Parity Tests", () => {
  describe("Schema Tests", () => {
    it("accepts rich optional performance metric carriage across all 6 curve components", () => {
      const rocWithPerf: RocV2Spec = {
        ...baseRocSpec,
        data: [{ ...baseRocSpec.data[0], performance: [...fullPerfPayload] }],
      };
      expect(Value.Check(RocV2SpecSchema, rocWithPerf)).toBe(true);

      const prWithPerf: PrecisionRecallV2Spec = {
        ...basePrSpec,
        data: [{ ...basePrSpec.data[0], performance: [...fullPerfPayload] }],
      };
      expect(Value.Check(PrecisionRecallV2SpecSchema, prWithPerf)).toBe(true);

      const gainsWithPerf: GainsV2Spec = {
        ...baseGainsSpec,
        data: [{ ...baseGainsSpec.data[0], performance: [...fullPerfPayload] }],
      };
      expect(Value.Check(GainsV2SpecSchema, gainsWithPerf)).toBe(true);

      const liftWithPerf: LiftV2Spec = {
        ...baseLiftSpec,
        data: [{ ...baseLiftSpec.data[0], performance: [...fullPerfPayload] }],
      };
      expect(Value.Check(LiftV2SpecSchema, liftWithPerf)).toBe(true);

      const dcaWithPerf: DecisionCurveV2Spec = {
        ...baseDcaSpec,
        data: [{ ...baseDcaSpec.data[0], performance: [...fullPerfPayload] }],
      };
      expect(Value.Check(DecisionCurveV2SpecSchema, dcaWithPerf)).toBe(true);

      const iaWithPerf: InterventionsAvoidedV2Spec = {
        ...baseIaSpec,
        data: [{ ...baseIaSpec.data[0], performance: [...fullPerfPayload] }],
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

  describe("Renderer-Level DOM Tooltip Assertions for All Six Components", () => {
    it("renders exact ROC DOM tooltip content/order with full carried performance metrics", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        data: [{ ...baseRocSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderRocV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

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
      expect(lines).toEqual(expectedLines);
    });

    it("renders exact Precision-Recall DOM tooltip content/order with full carried performance metrics", () => {
      const spec: PrecisionRecallV2Spec = {
        ...basePrSpec,
        data: [{ ...basePrSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderPrecisionRecallV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "PPV: 0.750",
        "Specificity: 0.900",
        "FPR: 0.100",
        "NPV: 0.978",
        "Lift: 2.222",
        "Net Benefit: 0.060",
        "Predicted Positives: 180",
        "TP: 80",
        "TN: 900",
        "FP: 100",
        "FN: 20",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("renders exact Gains DOM tooltip content/order with full carried performance metrics", () => {
      const spec: GainsV2Spec = {
        ...baseGainsSpec,
        data: [{ ...baseGainsSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderGainsV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
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
      expect(lines).toEqual(expectedLines);
    });

    it("renders exact Lift DOM tooltip content/order with full carried performance metrics", () => {
      const spec: LiftV2Spec = {
        ...baseLiftSpec,
        data: [{ ...baseLiftSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderLiftV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
        "Lift: 2.500",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "FPR: 0.100",
        "PPV: 0.444",
        "NPV: 0.978",
        "Net Benefit: 0.060",
        "Predicted Positives: 180",
        "TP: 80",
        "TN: 900",
        "FP: 100",
        "FN: 20",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("renders exact Decision Curve DOM tooltip content/order with full carried performance metrics", () => {
      const spec: DecisionCurveV2Spec = {
        ...baseDcaSpec,
        data: [{ ...baseDcaSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderDecisionCurveV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Net Benefit: 0.120",
        "PPCR: 0.164",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "FPR: 0.100",
        "PPV: 0.444",
        "NPV: 0.978",
        "Lift: 2.222",
        "Predicted Positives: 180",
        "TP: 80",
        "TN: 900",
        "FP: 100",
        "FN: 20",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("renders exact Interventions Avoided DOM tooltip content/order with narrower conventional metrics", () => {
      const spec: InterventionsAvoidedV2Spec = {
        ...baseIaSpec,
        data: [{ ...baseIaSpec.data[0], performance: [...fullPerfPayload] }],
      };
      const element = renderInterventionsAvoidedV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Interventions Avoided: 35.000",
        "Net Benefit: 0.060",
        "Predicted Positives: 180",
        "PPCR: 0.164",
        "TN: 900",
        "FN: 20",
      ];
      expect(lines).toEqual(expectedLines);
    });
  });

  describe("Renderer-Level Partial Payload DOM Tooltip Assertions", () => {
    it("supplements ROC native fields in DOM without duplication when partial performance is supplied", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        data: [{ ...baseRocSpec.data[0], performance: [{ metricId: "true_positives", estimate: 80 }] }],
      };
      const element = renderRocV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "FPR: 0.100",
        "TP: 80",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("supplements Precision-Recall native fields in DOM when partial performance is supplied", () => {
      const spec: PrecisionRecallV2Spec = {
        ...basePrSpec,
        data: [{ ...basePrSpec.data[0], performance: [{ metricId: "true_negatives", estimate: 900 }] }],
      };
      const element = renderPrecisionRecallV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "PPV: 0.750",
        "TN: 900",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("supplements Gains native fields in DOM when partial performance is supplied", () => {
      const spec: GainsV2Spec = {
        ...baseGainsSpec,
        data: [{ ...baseGainsSpec.data[0], performance: [{ metricId: "ppv", estimate: 0.75 }] }],
      };
      const element = renderGainsV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
        "Sensitivity: 0.800",
        "PPV: 0.750",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("supplements Lift native fields in DOM when partial performance is supplied", () => {
      const spec: LiftV2Spec = {
        ...baseLiftSpec,
        data: [{ ...baseLiftSpec.data[0], performance: [{ metricId: "sensitivity", estimate: 0.8 }] }],
      };
      const element = renderLiftV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "PPCR: 0.300",
        "Cutoff: 0.500",
        "Lift: 2.500",
        "Sensitivity: 0.800",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("supplements Decision Curve native fields in DOM when partial performance is supplied", () => {
      const spec: DecisionCurveV2Spec = {
        ...baseDcaSpec,
        data: [{ ...baseDcaSpec.data[0], performance: [{ metricId: "true_positives", estimate: 80 }] }],
      };
      const element = renderDecisionCurveV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Net Benefit: 0.120",
        "TP: 80",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("supplements Interventions Avoided native fields in DOM when partial performance is supplied", () => {
      const spec: InterventionsAvoidedV2Spec = {
        ...baseIaSpec,
        data: [{ ...baseIaSpec.data[0], performance: [{ metricId: "true_negatives", estimate: 820 }] }],
      };
      const element = renderInterventionsAvoidedV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Threshold: 0.200",
        "Interventions Avoided: 35.000",
        "TN: 820",
      ];
      expect(lines).toEqual(expectedLines);
    });

    it("preserves exact fallback DOM tooltip with 'False Positive Rate' when ROC performance is omitted", () => {
      const element = renderRocV2(baseRocSpec) as HTMLElement;
      const lines = getDomTipLines(element);

      const expectedLines = [
        "Series: Model A",
        "Cutoff: 0.500",
        "PPCR: 0.300",
        "Sensitivity: 0.800",
        "Specificity: 0.900",
        "False Positive Rate: 0.100",
      ];
      expect(lines).toEqual(expectedLines);
    });
  });

  describe("Operating Point Marker DOM Tests", () => {
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

    it("ensures selected operating point marker element is rendered for selected operating point with identical DOM tooltip as underlying datum", () => {
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
      const selectedDot = element.querySelector(".rtichoke-selected-operating-point circle, circle.rtichoke-selected-operating-point");
      expect(selectedDot).not.toBeNull();
      expect(selectedDot?.getAttribute("r")).toBe("6");

      const lines = getDomTipLines(element);
      expect(lines).toContain("Series: Model A");
      expect(lines).toContain("Sensitivity: 0.800");
      expect(lines).toContain("TP: 80");
    });
  });

  describe("Structured Tooltip DOM Hierarchy & Operating Point Ordering Tests", () => {
    it("proves native structured tip DOM structure exists with bold label tspans", () => {
      const element = renderRocV2(baseRocSpec) as HTMLElement;
      const circle = element.querySelector("circle");
      expect(circle).not.toBeNull();
      const cx = Number(circle!.getAttribute("cx") ?? 100);
      const cy = Number(circle!.getAttribute("cy") ?? 100);
      circle!.dispatchEvent(
        new (window as any).PointerEvent("pointermove", {
          bubbles: true,
          clientX: cx,
          clientY: cy,
        }),
      );

      const tipTextEl = element.querySelector('g[aria-label="tip"] text');
      expect(tipTextEl).not.toBeNull();
      const boldLabels = Array.from(tipTextEl!.querySelectorAll('tspan[font-weight="bold"]')).map(
        (el) => el.textContent?.trim(),
      );
      expect(boldLabels).toEqual(["Series", "Cutoff", "PPCR", "Sensitivity", "Specificity", "False Positive Rate"]);
    });

    it("renders Cutoff before PPCR when operatingPoint dimension is probability_threshold", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const element = renderRocV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);
      const cutoffIndex = lines.findIndex((line) => line.startsWith("Cutoff:"));
      const ppcrIndex = lines.findIndex((line) => line.startsWith("PPCR:"));
      expect(cutoffIndex).toBeGreaterThan(-1);
      expect(ppcrIndex).toBeGreaterThan(-1);
      expect(cutoffIndex).toBeLessThan(ppcrIndex);
    });

    it("renders PPCR before Cutoff when operatingPoint dimension is ppcr", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        operatingPoint: { dimension: "ppcr" },
      };
      const element = renderRocV2(spec) as HTMLElement;
      const lines = getDomTipLines(element);
      const cutoffIndex = lines.findIndex((line) => line.startsWith("Cutoff:"));
      const ppcrIndex = lines.findIndex((line) => line.startsWith("PPCR:"));
      expect(cutoffIndex).toBeGreaterThan(-1);
      expect(ppcrIndex).toBeGreaterThan(-1);
      expect(ppcrIndex).toBeLessThan(cutoffIndex);
    });

    it("ensures canonical field order is strictly deterministic when rows contain heterogeneous partial performance payloads", () => {
      const spec: RocV2Spec = {
        ...baseRocSpec,
        data: [
          {
            seriesId: "ser-1",
            cutoff: 0.8,
            ppcr: 0.1,
            sensitivity: 0.4,
            specificity: 0.95,
            performance: [{ metricId: "true_positives", estimate: 40 }],
          },
          {
            seriesId: "ser-1",
            cutoff: 0.5,
            ppcr: 0.3,
            sensitivity: 0.8,
            specificity: 0.9,
            performance: [
              { metricId: "ppv", estimate: 0.444 },
              { metricId: "true_positives", estimate: 80 },
            ],
          },
        ],
      };
      const element = renderRocV2(spec) as HTMLElement;
      const circles = Array.from(element.querySelectorAll("circle"));
      expect(circles.length).toBeGreaterThan(1);

      const targetCircle = circles[1];
      const cx = Number(targetCircle.getAttribute("cx") ?? 100);
      const cy = Number(targetCircle.getAttribute("cy") ?? 100);
      targetCircle.dispatchEvent(
        new (window as any).PointerEvent("pointermove", {
          bubbles: true,
          clientX: cx,
          clientY: cy,
        }),
      );

      const tipTextEl = element.querySelector('g[aria-label="tip"] text');
      expect(tipTextEl).not.toBeNull();
      const boldLabels = Array.from(tipTextEl!.querySelectorAll('tspan[font-weight="bold"]')).map(
        (el) => el.textContent?.trim(),
      );
      const ppvIdx = boldLabels.indexOf("PPV");
      const tpIdx = boldLabels.indexOf("TP");
      expect(ppvIdx).toBeGreaterThan(-1);
      expect(tpIdx).toBeGreaterThan(-1);
      expect(ppvIdx).toBeLessThan(tpIdx);
    });

    it("renders native structured tip for generic curve reference lines and Decision Curve reference lines", () => {
      const elementRoc = renderRocV2(baseRocSpec) as HTMLElement;
      const refLine = elementRoc.querySelector('g[aria-label="line"] path');
      expect(refLine).not.toBeNull();
      refLine!.dispatchEvent(
        new (window as any).PointerEvent("pointermove", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
      const tipGroup = elementRoc.querySelector('g[aria-label="tip"]');
      expect(tipGroup).not.toBeNull();

      const elementDca = renderDecisionCurveV2(baseDcaSpec) as HTMLElement;
      const refRule = elementDca.querySelector('g[aria-label="rule"] line, g[aria-label="line"] path');
      expect(refRule).not.toBeNull();
      refRule!.dispatchEvent(
        new (window as any).PointerEvent("pointermove", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        }),
      );
      const tipGroupDca = elementDca.querySelector('g[aria-label="tip"]');
      expect(tipGroupDca).not.toBeNull();
    });
  });
});
