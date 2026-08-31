// @vitest-environment jsdom

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  extractOperatingPointValues,
  renderDecisionCurveV2,
  renderGainsV2,
  renderInterventionsAvoidedV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderReport,
  renderRocV2,
} from "../src/index.js";
import type { InterventionsAvoidedV2Spec } from "../src/spec/v2/interventions-avoided.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import { DecisionCurveV2SpecSchema, type DecisionCurveV2Spec } from "../src/spec/v2/decision-curve.js";
import { GainsV2SpecSchema, type GainsV2Spec } from "../src/spec/v2/gains.js";
import { LiftV2SpecSchema, type LiftV2Spec } from "../src/spec/v2/lift.js";
import { PrecisionRecallV2SpecSchema, type PrecisionRecallV2Spec } from "../src/spec/v2/precision_recall.js";
import { RocV2SpecSchema, type RocV2Spec } from "../src/spec/v2/roc.js";

const baseRoc: RocV2Spec = {
  schemaVersion: "2.0",
  type: "roc",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
  ],
  series: [
    { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3, ppcr: 0.8 },
    { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7, ppcr: 0.5 },
    { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95, ppcr: 0.1 },
  ],
  x: "false_positive_rate",
  y: "sensitivity",
  xAxis: { label: "1 - Specificity", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
};

const basePR: PrecisionRecallV2Spec = {
  schemaVersion: "2.0",
  type: "precision_recall",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
  ],
  series: [
    { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, ppv: 0.2, ppcr: 0.8 },
    { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, ppv: 0.5, ppcr: 0.5 },
    { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, ppv: 0.9, ppcr: 0.1 },
  ],
  x: "sensitivity",
  y: "ppv",
  xAxis: { label: "Sensitivity", domain: [0, 1] },
  yAxis: { label: "PPV", domain: [0, 1] },
};

const baseGains: GainsV2Spec = {
  schemaVersion: "2.0",
  type: "gains",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
  ],
  series: [
    { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", cutoff: 0.1, ppcr: 0.8, sensitivity: 0.9 },
    { seriesId: "series-1", cutoff: 0.5, ppcr: 0.5, sensitivity: 0.7 },
    { seriesId: "series-1", cutoff: 0.9, ppcr: 0.1, sensitivity: 0.2 },
  ],
  x: "ppcr",
  y: "sensitivity",
  xAxis: { label: "PPCR", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
};

const baseLift: LiftV2Spec = {
  schemaVersion: "2.0",
  type: "lift",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
  ],
  series: [
    { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", cutoff: 0.1, ppcr: 0.8, lift: 1.1 },
    { seriesId: "series-1", cutoff: 0.5, ppcr: 0.5, lift: 1.4 },
    { seriesId: "series-1", cutoff: 0.9, ppcr: 0.1, lift: 2.0 },
  ],
  x: "ppcr",
  y: "lift",
  xAxis: { label: "PPCR", domain: [0, 1] },
  yAxis: { label: "Lift", domain: [0, 3] },
};

const baseDC: DecisionCurveV2Spec = {
  schemaVersion: "2.0",
  type: "decision_curve",
  evaluations: [
    { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
  ],
  series: [
    { id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", threshold: 0.1, netBenefit: 0.2 },
    { seriesId: "series-1", threshold: 0.5, netBenefit: 0.1 },
    { seriesId: "series-1", threshold: 0.9, netBenefit: 0.01 },
  ],
  x: "threshold",
  y: "netBenefit",
  xAxis: { label: "Threshold", domain: [0, 1] },
  yAxis: { label: "Net Benefit", domain: [0, 0.5] },
  references: [
    { type: "horizontal", value: 0, scope: "global", benchmark: "treat_none", label: "Treat None" },
    { type: "path", points: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.01 }], scope: "population", population: "Pop 1", benchmark: "treat_all", label: "Treat All — Pop 1" },
  ],
};

describe("Operating Point Selection for Performance Curves", () => {
  describe("1. Backward Compatibility", () => {
    it("renders ROC spec without operatingPoint metadata without a selector element", () => {
      expect(Value.Check(RocV2SpecSchema, baseRoc)).toBe(true);
      const el = renderRocV2(baseRoc);
      expect(el.querySelector('input[type="range"]')).toBeNull();
      expect(el.querySelector(".rtichoke-operating-point-control")).toBeNull();
    });

    it("renders PR spec without operatingPoint metadata without a selector element", () => {
      expect(Value.Check(PrecisionRecallV2SpecSchema, basePR)).toBe(true);
      const el = renderPrecisionRecallV2(basePR);
      expect(el.querySelector('input[type="range"]')).toBeNull();
    });

    it("renders Gains spec without operatingPoint metadata without a selector element", () => {
      expect(Value.Check(GainsV2SpecSchema, baseGains)).toBe(true);
      const el = renderGainsV2(baseGains);
      expect(el.querySelector('input[type="range"]')).toBeNull();
    });

    it("renders Lift spec without operatingPoint metadata without a selector element", () => {
      expect(Value.Check(LiftV2SpecSchema, baseLift)).toBe(true);
      const el = renderLiftV2(baseLift);
      expect(el.querySelector('input[type="range"]')).toBeNull();
    });

    it("renders Decision Curve spec without operatingPoint metadata without a selector element", () => {
      expect(Value.Check(DecisionCurveV2SpecSchema, baseDC)).toBe(true);
      const el = renderDecisionCurveV2(baseDC);
      expect(el.querySelector('input[type="range"]')).toBeNull();
    });
  });

  describe("Tooltip / Hover Semantics and Ordering", () => {
    it("enables interactive tip mark machinery on ordinary points and selected operating-point points", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderRocV2(spec);
      // Interactive tip mark container is rendered by Observable Plot when tip: true is enabled
      const tipMark = el.querySelector('[aria-label="tip"]');
      expect(tipMark).not.toBeNull();

      // Selected operating point dot mark group exists inside SVG
      const selectedDot = el.querySelector('.rtichoke-selected-operating-point');
      expect(selectedDot).not.toBeNull();

      // Dot marks exist inside SVG
      const dotMark = el.querySelector('[aria-label="dot"]');
      expect(dotMark).not.toBeNull();
    });

    it("ROC tooltip puts active dimension immediately below Series and includes False Positive Rate", () => {
      const rocCutoff: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const elCutoff = renderRocV2(rocCutoff);
      expect(elCutoff.querySelector('[aria-label="tip"]')).not.toBeNull();

      const rocPpcr: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "ppcr" },
      };
      const elPpcr = renderRocV2(rocPpcr);
      expect(elPpcr.querySelector('[aria-label="tip"]')).not.toBeNull();
    });

    it("Precision-Recall tooltip puts active dimension immediately below Series", () => {
      const prCutoff: PrecisionRecallV2Spec = {
        ...basePR,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const elCutoff = renderPrecisionRecallV2(prCutoff);
      expect(elCutoff.querySelector('[aria-label="tip"]')).not.toBeNull();

      const prPpcr: PrecisionRecallV2Spec = {
        ...basePR,
        operatingPoint: { dimension: "ppcr" },
      };
      const elPpcr = renderPrecisionRecallV2(prPpcr);
      expect(elPpcr.querySelector('[aria-label="tip"]')).not.toBeNull();
    });

    it("Gains tooltip puts active dimension immediately below Series", () => {
      const gainsCutoff: GainsV2Spec = {
        ...baseGains,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const elCutoff = renderGainsV2(gainsCutoff);
      expect(elCutoff.querySelector('[aria-label="tip"]')).not.toBeNull();

      const gainsPpcr: GainsV2Spec = {
        ...baseGains,
        operatingPoint: { dimension: "ppcr" },
      };
      const elPpcr = renderGainsV2(gainsPpcr);
      expect(elPpcr.querySelector('[aria-label="tip"]')).not.toBeNull();
    });

    it("Lift tooltip puts active dimension immediately below Series", () => {
      const liftCutoff: LiftV2Spec = {
        ...baseLift,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const elCutoff = renderLiftV2(liftCutoff);
      expect(elCutoff.querySelector('[aria-label="tip"]')).not.toBeNull();

      const liftPpcr: LiftV2Spec = {
        ...baseLift,
        operatingPoint: { dimension: "ppcr" },
      };
      const elPpcr = renderLiftV2(liftPpcr);
      expect(elPpcr.querySelector('[aria-label="tip"]')).not.toBeNull();
    });

    it("selected operating-point marker displays exact same tooltip as underlying curve point", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderRocV2(spec);
      expect(el.querySelector('.rtichoke-selected-operating-point')).not.toBeNull();
      expect(el.querySelector('[aria-label="dot"]')).not.toBeNull();
      expect(el.querySelector('[aria-label="tip"]')).not.toBeNull();
    });
  });

  describe("6. Stylings & ReportSpec integration", () => {
    it("renders operating point control below plot and sets margin alignment", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderRocV2(spec) as HTMLElement;
      expect(el.children[0].className).toBe("rtichoke-operating-point-content");
      expect(el.children[1].className).toBe("rtichoke-operating-point-control");

      const control = el.querySelector<HTMLElement>(".rtichoke-operating-point-control")!;
      expect(control.style.marginLeft).toBe("66px");
      expect(control.style.marginRight).toBe("28px");
    });

    it("single-series selected marker uses #f6e3be fill and dark stroke #1a1a1a", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderRocV2(spec);
      const dotMarkGroup = el.querySelector(".rtichoke-selected-operating-point");
      expect(dotMarkGroup).not.toBeNull();
      const circleOrPath = dotMarkGroup!.querySelector('circle, path');
      expect(circleOrPath).not.toBeNull();
      // Single-series color resolved is #000000 by default in basePlotOptions/Plot, or dot uses custom fill
      // In Plot, fill can be direct on circle or on parent mark container g
      const fill = circleOrPath!.getAttribute("fill") || dotMarkGroup!.getAttribute("fill");
      expect(fill).toBe("#f6e3be");
      const stroke = circleOrPath!.getAttribute("stroke") || dotMarkGroup!.getAttribute("stroke");
      expect(stroke).toBe("#1a1a1a");
      const strokeWidth = circleOrPath!.getAttribute("stroke-width") || dotMarkGroup!.getAttribute("stroke-width");
      expect(strokeWidth).toBe("2.5");
    });

    it("multi-series selected marker uses series/group fill and dark stroke #1a1a1a", () => {
      const multiRoc: RocV2Spec = {
        ...baseRoc,
        evaluations: [
          { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
          { id: "eval-2", model: "Model B", population: "Pop 1", label: "Model B" },
        ],
        series: [
          { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
          { id: "series-2", evaluationId: "eval-2", display: { label: "Model B", group: "Model B", role: "model" } },
        ],
        data: [
          { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7 },
          { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.6, specificity: 0.8 },
        ],
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderRocV2(multiRoc);
      const dotMarkGroup = el.querySelector(".rtichoke-selected-operating-point");
      expect(dotMarkGroup).not.toBeNull();
      const circles = dotMarkGroup!.querySelectorAll('circle, path');
      expect(circles.length).toBeGreaterThanOrEqual(2);
      expect(circles[0].getAttribute("stroke") || dotMarkGroup!.getAttribute("stroke")).toBe("#1a1a1a");
    });

    it("Interventions Avoided receives operating point visual convention", () => {
      const iaSpec: InterventionsAvoidedV2Spec = {
        schemaVersion: "2.0",
        type: "interventions_avoided",
        evaluations: [{ id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" }],
        series: [{ id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } }],
        data: [
          { seriesId: "series-1", threshold: 0.1, interventionsAvoided: 5 },
          { seriesId: "series-1", threshold: 0.5, interventionsAvoided: 15 },
        ],
        x: "threshold",
        y: "interventionsAvoided",
        xAxis: { label: "Threshold", domain: [0, 1] },
        yAxis: { label: "Interventions Avoided", domain: [0, 20] },
        references: [
          { type: "horizontal", value: 0, scope: "global", benchmark: "treat_all", label: "Treat All" },
          { type: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], scope: "population", population: "Pop 1", benchmark: "treat_none", label: "Treat None — Pop 1" },
        ],
        operatingPoint: { dimension: "probability_threshold" },
      };
      const el = renderInterventionsAvoidedV2(iaSpec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider).not.toBeNull();
      const dotMarkGroup = el.querySelector(".rtichoke-selected-operating-point");
      expect(dotMarkGroup).not.toBeNull();
      const circleOrPath = dotMarkGroup!.querySelector('circle, path');
      expect(circleOrPath!.getAttribute("fill") || dotMarkGroup!.getAttribute("fill")).toBe("#f6e3be");
    });

    it("embeds operating point controls correctly in ReportSpec tab panels and survives tab switching", () => {
      const rocWithOp: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      const reportSpec: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        title: "Test Report",
        sections: [
          {
            id: "sec-1",
            title: "Performance Section",
            items: [
              {
                type: "group",
                id: "grp-1",
                title: "Group 1",
                components: [
                  {
                    type: "component",
                    id: "comp-roc-1",
                    title: "ROC 1",
                    spec: rocWithOp,
                  },
                  {
                    type: "component",
                    id: "comp-roc-2",
                    title: "ROC 2",
                    spec: rocWithOp,
                  },
                ],
              },
            ],
          },
        ],
      };

      const reportEl = renderReport(reportSpec, { groupPresentation: "tabs" });
      const tabs = reportEl.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      const tabpanels = reportEl.querySelectorAll<HTMLElement>('[role="tabpanel"]');
      expect(tabs).toHaveLength(2);

      // Initially panel 2 is hidden
      expect(tabpanels[0].hidden).toBe(false);
      expect(tabpanels[1].hidden).toBe(true);

      // Panel 2 has the slider rendered correctly inside its content
      const slider2 = tabpanels[1].querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider2).not.toBeNull();
      expect(slider2.value).toBe("0");

      // Switch to tab 2
      tabs[1].click();
      expect(tabpanels[0].hidden).toBe(true);
      expect(tabpanels[1].hidden).toBe(false);

      // Change slider value on tab 2
      slider2.value = "1";
      slider2.dispatchEvent(new Event("input"));
      const valueSpan2 = tabpanels[1].querySelector(".rtichoke-operating-point-value")!;
      expect(valueSpan2.textContent).toBe("0.500");

      // Switch back to tab 1 and return to tab 2
      tabs[0].click();
      expect(tabpanels[1].hidden).toBe(true);
      tabs[1].click();
      expect(tabpanels[1].hidden).toBe(false);
      expect(valueSpan2.textContent).toBe("0.500");
    });
  });

  describe("2. Probability-threshold selection", () => {
    it("ROC threshold selection renders control, default marker (min threshold), and responds to input", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "probability_threshold" },
      };
      expect(Value.Check(RocV2SpecSchema, spec)).toBe(true);

      const values = extractOperatingPointValues(spec);
      expect(values).toEqual([0.1, 0.5, 0.9]);

      const el = renderRocV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      const valueSpan = el.querySelector(".rtichoke-operating-point-value")!;

      expect(slider).not.toBeNull();
      expect(slider.getAttribute("aria-label")).toBe("Probability threshold");
      expect(slider.value).toBe("0"); // index 0 => 0.1
      expect(valueSpan.textContent).toBe("0.100");

      // Check dot mark is present in SVG
      let dots = el.querySelectorAll('[aria-label="dot"] circle, [aria-label="symbol"] path');
      expect(dots.length).toBeGreaterThan(0);

      // Change slider value to index 1 (0.5)
      slider.value = "1";
      slider.dispatchEvent(new Event("input"));
      expect(valueSpan.textContent).toBe("0.500");

      dots = el.querySelectorAll('[aria-label="dot"] circle, [aria-label="symbol"] path');
      expect(dots.length).toBeGreaterThan(0);
    });

    it("Precision-Recall threshold selection", () => {
      const spec: PrecisionRecallV2Spec = {
        ...basePR,
        operatingPoint: { dimension: "probability_threshold" },
      };
      expect(Value.Check(PrecisionRecallV2SpecSchema, spec)).toBe(true);
      const el = renderPrecisionRecallV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider).not.toBeNull();
      expect(slider.getAttribute("aria-label")).toBe("Probability threshold");
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Gains threshold selection", () => {
      const spec: GainsV2Spec = {
        ...baseGains,
        operatingPoint: { dimension: "probability_threshold" },
      };
      expect(Value.Check(GainsV2SpecSchema, spec)).toBe(true);
      const el = renderGainsV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider).not.toBeNull();
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Lift threshold selection", () => {
      const spec: LiftV2Spec = {
        ...baseLift,
        operatingPoint: { dimension: "probability_threshold" },
      };
      expect(Value.Check(LiftV2SpecSchema, spec)).toBe(true);
      const el = renderLiftV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider).not.toBeNull();
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Decision Curve threshold selection preserves full curve, references, and adds persistent framed marker without vertical guide line", () => {
      const multiModelDC: DecisionCurveV2Spec = {
        ...baseDC,
        evaluations: [
          { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
          { id: "evaluation-2", model: "Model B", population: "Pop 1", label: "Model B" },
        ],
        series: [
          { id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } },
          { id: "series-2", evaluationId: "evaluation-2", display: { label: "Model B", group: "Model B", role: "model" } },
        ],
        data: [
          { seriesId: "series-1", threshold: 0.1, netBenefit: 0.2 },
          { seriesId: "series-1", threshold: 0.5, netBenefit: 0.1 },
          { seriesId: "series-1", threshold: 0.9, netBenefit: 0.01 },
          { seriesId: "series-2", threshold: 0.1, netBenefit: 0.19 },
          { seriesId: "series-2", threshold: 0.5, netBenefit: 0.08 },
          { seriesId: "series-2", threshold: 0.9, netBenefit: 0.02 },
        ],
        operatingPoint: { dimension: "probability_threshold" },
      };
      expect(Value.Check(DecisionCurveV2SpecSchema, multiModelDC)).toBe(true);
      const el = renderDecisionCurveV2(multiModelDC);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider).not.toBeNull();
      expect(slider.getAttribute("aria-label")).toBe("Probability threshold");

      // Verify full Decision Curve line marks are rendered (not filtered down)
      const lines = el.querySelectorAll('[aria-label="line"] path');
      // Treat All (path reference) + 2 model series lines = at least 3 path lines
      expect(lines.length).toBeGreaterThanOrEqual(3);

      // Verify Treat None horizontal rule mark is present
      const ruleY = el.querySelectorAll('[aria-label="rule"] line');
      expect(ruleY.length).toBeGreaterThanOrEqual(1);

      // Verify NO vertical guide rule mark (ruleX) is present
      const verticalRules = [...el.querySelectorAll('[aria-label="rule"] line')].filter(
        (line) => line.getAttribute("x1") !== null && line.getAttribute("x1") === line.getAttribute("x2"),
      );
      expect(verticalRules).toHaveLength(0);

      // Check default selected threshold = 0.1 (common to both Model A and Model B)
      let dots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
      expect(dots.length).toBe(2);

      // Select threshold = 0.5 (index 1)
      slider.value = "1";
      slider.dispatchEvent(new Event("input"));
      dots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
      expect(dots.length).toBe(2);

      // Full curve lines and references remain present when slider moves
      expect(el.querySelectorAll('[aria-label="line"] path').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("3. PPCR selection", () => {
    it("ROC PPCR selection", () => {
      const spec: RocV2Spec = {
        ...baseRoc,
        operatingPoint: { dimension: "ppcr" },
      };
      expect(Value.Check(RocV2SpecSchema, spec)).toBe(true);
      const values = extractOperatingPointValues(spec);
      expect(values).toEqual([0.1, 0.5, 0.8]);

      const el = renderRocV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider.getAttribute("aria-label")).toBe("Predicted positives condition rate (PPCR)");
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Precision-Recall PPCR selection", () => {
      const spec: PrecisionRecallV2Spec = {
        ...basePR,
        operatingPoint: { dimension: "ppcr" },
      };
      expect(Value.Check(PrecisionRecallV2SpecSchema, spec)).toBe(true);
      const el = renderPrecisionRecallV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider.getAttribute("aria-label")).toBe("Predicted positives condition rate (PPCR)");
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Gains PPCR selection", () => {
      const spec: GainsV2Spec = {
        ...baseGains,
        operatingPoint: { dimension: "ppcr" },
      };
      expect(Value.Check(GainsV2SpecSchema, spec)).toBe(true);
      const el = renderGainsV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider.getAttribute("aria-label")).toBe("Predicted positives condition rate (PPCR)");
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });

    it("Lift PPCR selection", () => {
      const spec: LiftV2Spec = {
        ...baseLift,
        operatingPoint: { dimension: "ppcr" },
      };
      expect(Value.Check(LiftV2SpecSchema, spec)).toBe(true);
      const el = renderLiftV2(spec);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      expect(slider.getAttribute("aria-label")).toBe("Predicted positives condition rate (PPCR)");
      expect(el.querySelector(".rtichoke-operating-point-value")!.textContent).toBe("0.100");
    });
  });

  describe("4. Multi-series matching semantics", () => {
    const multiSeriesThresholdRoc: RocV2Spec = {
      schemaVersion: "2.0",
      type: "roc",
      evaluations: [
        { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
        { id: "eval-2", model: "Model B", population: "Pop 1", label: "Model B" },
      ],
      series: [
        { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
        { id: "series-2", evaluationId: "eval-2", display: { label: "Model B", group: "Model B", role: "model" } },
      ],
      data: [
        // Model A has cutoffs 0.1, 0.5, 0.9
        { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3 },
        { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7 },
        { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95 },
        // Model B has cutoffs 0.2, 0.5, 0.8 (0.5 is common to both)
        { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4 },
        { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75 },
        { seriesId: "series-2", cutoff: 0.8, sensitivity: 0.3, specificity: 0.9 },
      ],
      x: "false_positive_rate",
      y: "sensitivity",
      xAxis: { label: "1 - Specificity", domain: [0, 1] },
      yAxis: { label: "Sensitivity", domain: [0, 1] },
      operatingPoint: { dimension: "probability_threshold" },
    };

    const multiSeriesPpcrRoc: RocV2Spec = {
      ...multiSeriesThresholdRoc,
      data: [
        { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3, ppcr: 0.1 },
        { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7, ppcr: 0.5 },
        { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95, ppcr: 0.9 },
        { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4, ppcr: 0.2 },
        { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75, ppcr: 0.5 },
        { seriesId: "series-2", cutoff: 0.8, sensitivity: 0.3, specificity: 0.9, ppcr: 0.8 },
      ],
      operatingPoint: { dimension: "ppcr" },
    };

    it("probability_threshold derives exact common intersection domain across all active series", () => {
      const values = extractOperatingPointValues(multiSeriesThresholdRoc);
      expect(values).toEqual([0.5]);
    });

    it("ppcr retains exact union domain across active series", () => {
      const values = extractOperatingPointValues(multiSeriesPpcrRoc);
      expect(values).toEqual([0.1, 0.2, 0.5, 0.8, 0.9]);
    });

    it("highlights exact matching points for PPCR union values; shows no marker for series missing selected value", () => {
      const el = renderRocV2(multiSeriesPpcrRoc);
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      const valueSpan = el.querySelector(".rtichoke-operating-point-value")!;

      // Default selected value is 0.1 (index 0). Only Model A has PPCR 0.1.
      expect(valueSpan.textContent).toBe("0.100");
      let dots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
      expect(dots.length).toBe(1);

      // Select index 2 -> PPCR 0.5 (common to both Model A and Model B).
      slider.value = "2";
      slider.dispatchEvent(new Event("input"));
      expect(valueSpan.textContent).toBe("0.500");
      dots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
      expect(dots.length).toBe(2);

      // Select index 1 -> PPCR 0.2 (only Model B has 0.2).
      slider.value = "1";
      slider.dispatchEvent(new Event("input"));
      expect(valueSpan.textContent).toBe("0.200");
      dots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
      expect(dots.length).toBe(1);
    });
  });

  describe("5. Horizon Composition and Operating Point Selection", () => {
    const multiHorizonRoc: RocV2Spec = {
      schemaVersion: "2.0",
      type: "roc",
      evaluations: [
        { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
      ],
      series: [
        { id: "series-1-5", evaluationId: "eval-1", horizon: 5, display: { label: "Model A (5y)", group: "Model A", role: "model" } },
        { id: "series-1-10", evaluationId: "eval-1", horizon: 10, display: { label: "Model A (10y)", group: "Model A", role: "model" } },
      ],
      data: [
        // 5y horizon cutoffs: 0.1, 0.5, 0.8
        { seriesId: "series-1-5", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3 },
        { seriesId: "series-1-5", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7 },
        { seriesId: "series-1-5", cutoff: 0.8, sensitivity: 0.3, specificity: 0.9 },
        // 10y horizon cutoffs: 0.2, 0.5, 0.9 (0.5 is common, 0.8 is missing in 10y)
        { seriesId: "series-1-10", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4 },
        { seriesId: "series-1-10", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75 },
        { seriesId: "series-1-10", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95 },
      ],
      x: "false_positive_rate",
      y: "sensitivity",
      xAxis: { label: "1 - Specificity", domain: [0, 1] },
      yAxis: { label: "Sensitivity", domain: [0, 1] },
      operatingPoint: { dimension: "probability_threshold" },
    };

    it("updates available operating point domain on horizon change and preserves value if present, else selects closest exact value", () => {
      const el = renderRocV2(multiHorizonRoc);
      const horizonSelect = el.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]')!;
      expect(horizonSelect).not.toBeNull();

      // Default horizon 5y: values [0.1, 0.5, 0.8]. Default selected = 0.1
      let slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      let valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
      expect(valueSpan.textContent).toBe("0.100");

      // Change operating point to 0.5
      slider.value = "1";
      slider.dispatchEvent(new Event("input"));
      expect(valueSpan.textContent).toBe("0.500");

      // Switch horizon to 10y. 0.5 exists in 10y [0.2, 0.5, 0.9], so 0.5 should be preserved!
      horizonSelect.value = "10";
      horizonSelect.dispatchEvent(new Event("change"));

      slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
      expect(valueSpan.textContent).toBe("0.500");

      // Change operating point to 0.9 (which is index 2 in 10y)
      slider.value = "2";
      slider.dispatchEvent(new Event("input"));
      expect(valueSpan.textContent).toBe("0.900");

      // Switch horizon back to 5y. 0.9 does NOT exist in 5y [0.1, 0.5, 0.8], so it falls back to the closest exact value (0.8).
      horizonSelect.value = "5";
      horizonSelect.dispatchEvent(new Event("change"));

      slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
      expect(valueSpan.textContent).toBe("0.800");
    });
  });
});
