// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  renderDecisionCurveV2,
  renderGainsV2,
  renderInterventionsAvoidedV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderReport,
  renderRocV2,
} from "../src/index.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import type { DecisionCurveV2Spec } from "../src/spec/v2/decision-curve.js";
import type { GainsV2Spec } from "../src/spec/v2/gains.js";
import type { InterventionsAvoidedV2Spec } from "../src/spec/v2/interventions-avoided.js";
import type { LiftV2Spec } from "../src/spec/v2/lift.js";
import type { PrecisionRecallV2Spec } from "../src/spec/v2/precision_recall.js";
import type { RocV2Spec } from "../src/spec/v2/roc.js";

const multiSeriesRocSpec: RocV2Spec = {
  schemaVersion: "2.0",
  type: "roc",
  evaluations: [
    { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
    { id: "evaluation-2", model: "Model B", population: "Pop 1", label: "Model B" },
  ],
  series: [
    { id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } },
    { id: "series-2", evaluationId: "evaluation-2", display: { label: "Model B", group: "Model B", role: "model" } },
  ],
  data: [
    // Model A: cutoffs 0.1, 0.5, 0.9
    { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3, ppcr: 0.8 },
    { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7, ppcr: 0.5 },
    { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95, ppcr: 0.1 },
    // Model B: cutoffs 0.2, 0.5, 0.8 (0.5 is common intersection)
    { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4, ppcr: 0.75 },
    { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75, ppcr: 0.45 },
    { seriesId: "series-2", cutoff: 0.8, sensitivity: 0.3, specificity: 0.92, ppcr: 0.15 },
  ],
  x: "false_positive_rate",
  y: "sensitivity",
  xAxis: { label: "1 - Specificity", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  operatingPoint: { dimension: "probability_threshold" },
};

const singleSeriesRocSpec: RocV2Spec = {
  ...multiSeriesRocSpec,
  evaluations: [multiSeriesRocSpec.evaluations[0]],
  series: [multiSeriesRocSpec.series[0]],
  data: multiSeriesRocSpec.data.filter((d) => d.seriesId === "series-1"),
};

describe("Interactive Multi-Series Legend Filtering", () => {
  it("omits legend UI for single-series plots", () => {
    const el = renderRocV2(singleSeriesRocSpec);
    expect(el.querySelector(".rtichoke-legend")).toBeNull();
  });

  it("renders custom interactive HTML legend buttons for multi-series plots", () => {
    const el = renderRocV2(multiSeriesRocSpec);
    const legendNav = el.querySelector(".rtichoke-legend");
    expect(legendNav).not.toBeNull();
    const buttons = legendNav!.querySelectorAll<HTMLButtonElement>("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0].textContent).toContain("Model A");
    expect(buttons[1].textContent).toContain("Model B");
  });

  it("toggles series visibility on legend click (hides line, ordinary dots, selected dot, hover targets)", () => {
    const el = renderRocV2(multiSeriesRocSpec);
    const buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");

    // Initial state: 2 series lines, ordinary points, selected dots
    let lines = el.querySelectorAll('[aria-label="line"] path');
    let selectedDots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
    expect(lines).toHaveLength(2);
    expect(selectedDots.length).toBeGreaterThan(0);

    // Click Model B legend button to hide Model B
    buttons[1].click();
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");

    // Model B elements should be gone from the rendered DOM
    lines = el.querySelectorAll('[aria-label="line"] path');
    expect(lines).toHaveLength(1);

    // SVG elements rendered for visible series (Model A)
    const selectedPoints = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
    expect(selectedPoints.length).toBe(1);

    // Click Model B legend button again to restore Model B
    buttons[1].click();
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    lines = el.querySelectorAll('[aria-label="line"] path');
    expect(lines).toHaveLength(2);
  });

  it("prevents hiding the final visible series (zero-visible-series rule)", () => {
    const el = renderRocV2(multiSeriesRocSpec);
    const buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");

    // Hide Model A
    buttons[0].click();
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");

    // Attempt to hide Model B (the last remaining visible series)
    buttons[1].click();

    // Model B remains active/visible!
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    const lines = el.querySelectorAll('[aria-label="line"] path');
    expect(lines).toHaveLength(1);
  });

  it("recomputes probability threshold domain as intersection of active series and resolves fallback deterministically", () => {
    const spec: RocV2Spec = {
      ...multiSeriesRocSpec,
      data: [
        // Model A: 0.1, 0.5, 0.9
        { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3 },
        { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7 },
        { seriesId: "series-1", cutoff: 0.9, sensitivity: 0.2, specificity: 0.95 },
        // Model B: 0.2, 0.5, 0.8
        { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4 },
        { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75 },
        { seriesId: "series-2", cutoff: 0.8, sensitivity: 0.3, specificity: 0.92 },
      ],
      operatingPoint: { dimension: "probability_threshold" },
    };

    const el = renderRocV2(spec);
    const buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");

    // Active domain when both are visible: intersection [0.5]
    let slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    let valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
    expect(slider.max).toBe("0");
    expect(valueSpan.textContent).toBe("0.500");

    // Hide Model B -> Model A alone active: domain expands to [0.1, 0.5, 0.9]
    // Active preferred value 0.5 remains valid in Model A, so it is preserved!
    buttons[1].click();
    slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
    expect(slider.max).toBe("2");
    expect(valueSpan.textContent).toBe("0.500");

    // Select cutoff 0.1 (index 0)
    slider.value = "0";
    slider.dispatchEvent(new Event("input"));
    expect(valueSpan.textContent).toBe("0.100");

    // Restore Model B -> intersection collapses back to [0.5].
    // Previous value 0.1 is no longer valid, so fallback picks closest exact value in domain (0.5).
    buttons[1].click();
    slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
    expect(slider.max).toBe("0");
    expect(valueSpan.textContent).toBe("0.500");
  });

  it("recomputes PPCR domain as union of active series", () => {
    const spec: RocV2Spec = {
      ...multiSeriesRocSpec,
      data: [
        { seriesId: "series-1", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3, ppcr: 0.1 },
        { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7, ppcr: 0.5 },
        { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4, ppcr: 0.2 },
        { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75, ppcr: 0.5 },
      ],
      operatingPoint: { dimension: "ppcr" },
    };

    const el = renderRocV2(spec);
    const buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");
    let slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    let valueSpan = el.querySelector(".rtichoke-operating-point-value")!;

    // Initial union: [0.1, 0.2, 0.5] (length 3, max index 2)
    expect(slider.max).toBe("2");
    expect(valueSpan.textContent).toBe("0.100");

    // Hide Model A -> Model B active: domain [0.2, 0.5]
    // Fallback for 0.1 is closest value 0.2!
    buttons[0].click();
    slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
    expect(slider.max).toBe("1");
    expect(valueSpan.textContent).toBe("0.200");
  });

  it("composes legend filtering with time horizon selection", () => {
    const multiHorizonRoc: RocV2Spec = {
      schemaVersion: "2.0",
      type: "roc",
      evaluations: [
        { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
        { id: "evaluation-2", model: "Model B", population: "Pop 1", label: "Model B" },
      ],
      series: [
        { id: "series-1-5", evaluationId: "evaluation-1", horizon: 5, display: { label: "Model A", group: "Model A", role: "model" } },
        { id: "series-2-5", evaluationId: "evaluation-2", horizon: 5, display: { label: "Model B", group: "Model B", role: "model" } },
        { id: "series-1-10", evaluationId: "evaluation-1", horizon: 10, display: { label: "Model A", group: "Model A", role: "model" } },
        { id: "series-2-10", evaluationId: "evaluation-2", horizon: 10, display: { label: "Model B", group: "Model B", role: "model" } },
      ],
      data: [
        // Horizon 5y
        { seriesId: "series-1-5", cutoff: 0.1, sensitivity: 0.9, specificity: 0.3 },
        { seriesId: "series-1-5", cutoff: 0.5, sensitivity: 0.7, specificity: 0.7 },
        { seriesId: "series-2-5", cutoff: 0.2, sensitivity: 0.85, specificity: 0.4 },
        { seriesId: "series-2-5", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75 },
        // Horizon 10y
        { seriesId: "series-1-10", cutoff: 0.2, sensitivity: 0.8, specificity: 0.4 },
        { seriesId: "series-1-10", cutoff: 0.5, sensitivity: 0.65, specificity: 0.75 },
        { seriesId: "series-2-10", cutoff: 0.3, sensitivity: 0.75, specificity: 0.5 },
        { seriesId: "series-2-10", cutoff: 0.5, sensitivity: 0.55, specificity: 0.85 },
      ],
      x: "false_positive_rate",
      y: "sensitivity",
      xAxis: { label: "1 - Specificity", domain: [0, 1] },
      yAxis: { label: "Sensitivity", domain: [0, 1] },
      operatingPoint: { dimension: "probability_threshold" },
    };

    const el = renderRocV2(multiHorizonRoc);
    const horizonSelect = el.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]')!;
    let buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");

    // Hide Model A at horizon 5
    buttons[0].click();
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");

    // Line geometry for Model A is gone, only 1 line mark rendered (Model B)
    expect(el.querySelectorAll('[aria-label="line"] path')).toHaveLength(1);

    // Selected operating point dot exists only for visible Model B
    let selectedDots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
    expect(selectedDots).toHaveLength(1);

    // Switch horizon to 10
    horizonSelect.value = "10";
    horizonSelect.dispatchEvent(new Event("change"));

    buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");

    // 1. Model A remains hidden (aria-pressed="false") at horizon 10
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");

    // 2. Only visible series line/points/selected marker are rendered (1 line, 1 selected dot for Model B)
    expect(el.querySelectorAll('[aria-label="line"] path')).toHaveLength(1);
    selectedDots = el.querySelectorAll('.rtichoke-selected-operating-point circle, .rtichoke-selected-operating-point path');
    expect(selectedDots).toHaveLength(1);

    // 3. Operating-point domain is recomputed from visible series at horizon 10 (Model B: [0.2, 0.5])
    const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    const valueSpan = el.querySelector(".rtichoke-operating-point-value")!;
    expect(valueSpan.textContent).toBe("0.500"); // 0.5 preserved at horizon 10
  });

  it("works seamlessly when embedded inside ReportSpec", () => {
    const reportSpec: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-1",
              title: "ROC Component",
              spec: multiSeriesRocSpec,
            },
          ],
        },
      ],
    };

    const reportEl = renderReport(reportSpec);
    const legendNav = reportEl.querySelector(".rtichoke-legend");
    expect(legendNav).not.toBeNull();
    const buttons = legendNav!.querySelectorAll<HTMLButtonElement>("button");
    expect(buttons).toHaveLength(2);

    // Toggle click inside report
    buttons[0].click();
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(reportEl.querySelectorAll('[aria-label="line"] path')).toHaveLength(1);
  });

  it("does not mutate the canonical input spec", () => {
    const originalSpecCopy = JSON.parse(JSON.stringify(multiSeriesRocSpec));
    const el = renderRocV2(multiSeriesRocSpec);
    const buttons = el.querySelectorAll<HTMLButtonElement>(".rtichoke-legend button");
    buttons[0].click();

    expect(multiSeriesRocSpec).toEqual(originalSpecCopy);
  });

  it("applies interactive legend filtering to PR, Gains, Lift, Decision Curve, and Interventions Avoided", () => {
    const multiPR: PrecisionRecallV2Spec = {
      schemaVersion: "2.0",
      type: "precision_recall",
      evaluations: [
        { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
        { id: "evaluation-2", model: "Model B", population: "Pop 1", label: "Model B" },
      ],
      series: [
        { id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } },
        { id: "series-2", evaluationId: "evaluation-2", display: { label: "Model B", group: "Model B", role: "model" } },
      ],
      data: [
        { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.7, ppv: 0.5 },
        { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.6, ppv: 0.4 },
      ],
      x: "sensitivity",
      y: "ppv",
      xAxis: { label: "Sensitivity", domain: [0, 1] },
      yAxis: { label: "PPV", domain: [0, 1] },
    };

    const prEl = renderPrecisionRecallV2(multiPR);
    expect(prEl.querySelector(".rtichoke-legend")).not.toBeNull();

    const multiGains: GainsV2Spec = {
      ...multiPR,
      type: "gains",
      data: [
        { seriesId: "series-1", cutoff: 0.5, ppcr: 0.5, sensitivity: 0.7 },
        { seriesId: "series-2", cutoff: 0.5, ppcr: 0.5, sensitivity: 0.6 },
      ],
      x: "ppcr",
      y: "sensitivity",
      xAxis: { label: "PPCR", domain: [0, 1] },
      yAxis: { label: "Sensitivity", domain: [0, 1] },
    };
    const gainsEl = renderGainsV2(multiGains);
    expect(gainsEl.querySelector(".rtichoke-legend")).not.toBeNull();

    const multiLift: LiftV2Spec = {
      ...multiPR,
      type: "lift",
      data: [
        { seriesId: "series-1", cutoff: 0.5, ppcr: 0.5, lift: 1.4 },
        { seriesId: "series-2", cutoff: 0.5, ppcr: 0.5, lift: 1.2 },
      ],
      x: "ppcr",
      y: "lift",
      xAxis: { label: "PPCR", domain: [0, 1] },
      yAxis: { label: "Lift", domain: [0, 3] },
    };
    const liftEl = renderLiftV2(multiLift);
    expect(liftEl.querySelector(".rtichoke-legend")).not.toBeNull();

    const multiDC: DecisionCurveV2Spec = {
      schemaVersion: "2.0",
      type: "decision_curve",
      evaluations: [
        { id: "evaluation-1", model: "Model A", population: "Pop 1", label: "Model A" },
        { id: "evaluation-2", model: "Model B", population: "Pop 1", label: "Model B" },
      ],
      series: [
        { id: "series-1", evaluationId: "evaluation-1", display: { label: "Model A", group: "Model A", role: "model" } },
        { id: "series-2", evaluationId: "evaluation-2", display: { label: "Model B", group: "Model B", role: "model" } },
      ],
      data: [
        { seriesId: "series-1", threshold: 0.5, netBenefit: 0.1 },
        { seriesId: "series-2", threshold: 0.5, netBenefit: 0.08 },
      ],
      x: "threshold",
      y: "netBenefit",
      xAxis: { label: "Threshold", domain: [0, 1] },
      yAxis: { label: "Net Benefit", domain: [0, 0.5] },
      references: [
        { type: "horizontal", value: 0, scope: "global", benchmark: "treat_none", label: "Treat None" },
        { type: "path", scope: "population", population: "Pop 1", benchmark: "treat_all", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], label: "Treat All — Pop 1" },
      ],
    };
    const dcEl = renderDecisionCurveV2(multiDC);
    expect(dcEl.querySelector(".rtichoke-legend")).not.toBeNull();

    const multiIA: InterventionsAvoidedV2Spec = {
      ...multiDC,
      type: "interventions_avoided",
      data: [
        { seriesId: "series-1", threshold: 0.5, interventionsAvoided: 15 },
        { seriesId: "series-2", threshold: 0.5, interventionsAvoided: 10 },
      ],
      x: "threshold",
      y: "interventionsAvoided",
      xAxis: { label: "Threshold", domain: [0, 1] },
      yAxis: { label: "Interventions Avoided", domain: [0, 20] },
      references: [
        { type: "horizontal", value: 0, scope: "global", benchmark: "treat_all", label: "Treat All" },
        { type: "path", scope: "population", population: "Pop 1", benchmark: "treat_none", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], label: "Treat None — Pop 1" },
      ],
    };
    const iaEl = renderInterventionsAvoidedV2(multiIA);
    expect(iaEl.querySelector(".rtichoke-legend")).not.toBeNull();
  });
});
