import * as Plot from "@observablehq/plot";
import type {
  HorizonExclusionCounts,
  OutcomeDistributionSpec,
  PopulationExclusion,
} from "../spec/v2/outcome-distribution.js";
import type { StateDistribution } from "../spec/v2/state-distribution.js";
import {
  assertOutcomeDistributionReferentialIntegrity,
  inferTopologicalStateOrder,
} from "../spec/v2/validate-outcome-distribution.js";
import {
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type V2RenderOptions,
} from "./v2.js";

let outcomeDistributionInstanceCounter = 0;
let outcomeDistributionSliderCounter = 0;

/** Canonical default user-facing labels for internal state IDs */
const CANONICAL_STATE_LABELS: Record<string, string> = {
  real_positive: "Event",
  target_event: "Event",
  real_competing: "Competing event",
  competing_outcome: "Competing event",
  real_negative: "Event-free",
  no_target_event: "Event-free",
  real_censored: "Censored",
  unknown: "Censored",
};

/** Palette for outcome states matching prevalence/outcome-accounting style */
const PREFERRED_STATE_COLORS: Record<string, string> = {
  primary: "#4C5454",
  real_positive: "#4C5454",
  real_positives_est: "#4C5454",
  target_event: "#4C5454",
  event_free: "#E0E0E0",
  real_negative: "#E0E0E0",
  real_negatives_est: "#E0E0E0",
  no_target_event: "#E0E0E0",
  competing: "#C880B7",
  real_competing: "#C880B7",
  real_competing_est: "#C880B7",
  competing_outcome: "#C880B7",
  censored: "#E3F09B",
  real_censored: "#E3F09B",
  real_censored_est: "#E3F09B",
  unknown: "#E3F09B",
};

const STATE_COLOR_PALETTE = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#66a61e",
  "#e6ab02",
  "#a6761d",
  "#666666",
];

/** True Blue sequential palette stops for ordinal state scales (8 stops from lowest/lightest to highest/darkest) */
export const TRUE_BLUE_PALETTE_STOPS = [
  "#EDF5FD",
  "#D5E8FA",
  "#AFD4F3",
  "#7EB9E7",
  "#4999D7",
  "#2477BB",
  "#155A98",
  "#103C70",
];

/** Colorful Minimal palette for nominal outcome states in observed-step distributions */
export const NOMINAL_COLORFUL_MINIMAL_PALETTE = [
  "#2672B9",
  "#FFC247",
  "#9E91CF",
  "#E68A31",
  "#7CC4E4",
  "#6D7797",
  "#D7B86B",
  "#B9B1CC",
];

const EXCLUSION_COLORS = {
  censored: "#E3F09B",
  competing: "#C880B7",
  total: "#475569",
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function interpolateHex(
  color1: string,
  color2: string,
  factor: number,
): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(
    r1 + factor * (r2 - r1),
    g1 + factor * (g2 - g1),
    b1 + factor * (b2 - b1),
  );
}

/** Resolve sequential True Blue colors for N ordered levels (supporting arbitrary N >= 1) */
export function getOrdinalTrueBluePalette(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1)
    return [TRUE_BLUE_PALETTE_STOPS[TRUE_BLUE_PALETTE_STOPS.length - 1]];

  const maxIdx = TRUE_BLUE_PALETTE_STOPS.length - 1;
  const colors: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = (i * maxIdx) / (n - 1);
    if (n <= 8) {
      colors.push(TRUE_BLUE_PALETTE_STOPS[Math.round(t)]);
    } else {
      const idx1 = Math.floor(t);
      const idx2 = Math.min(maxIdx, Math.ceil(t));
      const factor = t - idx1;
      colors.push(
        interpolateHex(
          TRUE_BLUE_PALETTE_STOPS[idx1],
          TRUE_BLUE_PALETTE_STOPS[idx2],
          factor,
        ),
      );
    }
  }
  return colors;
}

export function resolveCanonicalStateLabels(
  spec: OutcomeDistributionSpec,
): Map<string, string> {
  const canonicalMap = new Map<string, string>();

  const processDistributions = (dists: StateDistribution[]) => {
    for (const dist of dists) {
      for (const s of dist.states) {
        if (s.label !== undefined && s.label !== null) {
          const trimmed = s.label.trim();
          if (trimmed !== "") {
            canonicalMap.set(s.stateId, trimmed);
          }
        }
      }
    }
  };

  if (spec.stateDistributions) {
    processDistributions(spec.stateDistributions);
  }

  if (spec.variants) {
    for (const variant of Object.values(spec.variants)) {
      if (
        variant &&
        variant.status === "available" &&
        variant.stateDistributions
      ) {
        processDistributions(variant.stateDistributions);
      }
    }
  }

  return canonicalMap;
}

function resolveStateLabel(
  stateId: string,
  customLabel?: string | null,
  canonicalMap?: Map<string, string>,
): string {
  if (customLabel && customLabel.trim() !== "") {
    return customLabel.trim();
  }
  if (canonicalMap && canonicalMap.has(stateId)) {
    return canonicalMap.get(stateId)!;
  }
  if (CANONICAL_STATE_LABELS[stateId]) {
    return CANONICAL_STATE_LABELS[stateId];
  }
  return stateId;
}

function selectNearestStep(
  currentStep: number,
  availableSteps: number[],
): number {
  if (availableSteps.length === 0) return currentStep;
  if (availableSteps.includes(currentStep)) return currentStep;

  let bestStep = availableSteps[0];
  let minDiff = Math.abs(availableSteps[0] - currentStep);

  for (let i = 1; i < availableSteps.length; i++) {
    const step = availableSteps[i];
    const diff = Math.abs(step - currentStep);
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = step;
    } else if (diff === minDiff && step < bestStep) {
      bestStep = step;
    }
  }
  return bestStep;
}

interface ProcessedStateRow {
  stateId: string;
  label: string;
  proportion: number;
  percentage: number;
  estimate: number | null;
  mass: number | null;
  count: number | null;
}

interface ProcessedHorizonData {
  evaluationId: string;
  horizon: number;
  estimator: string;
  estimateOrigin?: string;
  censoringHeuristic?: string;
  competingHeuristic?: string;
  states: ProcessedStateRow[];
  totalMass: number | null;
  totalCount: number | null;
}

function processStateDistribution(
  dist: StateDistribution,
  canonicalMap?: Map<string, string>,
  masterStateOrder?: string[],
): ProcessedHorizonData {
  const horizon = dist.horizon ?? 0;
  const isObservedStep = dist.estimateOrigin === "observed_step";

  let hasMass = false;
  let hasCount = false;

  for (const s of dist.states) {
    if (s.mass !== undefined && s.mass !== null) hasMass = true;
    if (s.count !== undefined && s.count !== null) hasCount = true;
  }

  let totalMass: number | null = null;
  let totalCount: number | null = null;

  if (hasMass) {
    totalMass = dist.states.reduce(
      (acc, s) => acc + (s.mass !== undefined && s.mass !== null ? s.mass : 0),
      0,
    );
  }

  if (hasCount) {
    totalCount = dist.states.reduce(
      (acc, s) =>
        acc + (s.count !== undefined && s.count !== null ? s.count : 0),
      0,
    );
  }

  let effectiveStateIds: string[];
  if (isObservedStep && masterStateOrder && masterStateOrder.length > 0) {
    effectiveStateIds = masterStateOrder;
  } else {
    effectiveStateIds = dist.states.map((s) => s.stateId);
  }

  const stateMap = new Map<string, (typeof dist.states)[0]>();
  for (const s of dist.states) {
    stateMap.set(s.stateId, s);
  }

  const processedStates: ProcessedStateRow[] = effectiveStateIds.map(
    (stateId) => {
      const s = stateMap.get(stateId);
      if (s) {
        const label = resolveStateLabel(s.stateId, s.label, canonicalMap);
        let proportion = 0;

        if (
          dist.estimator === "aalen_johansen" &&
          s.estimate !== undefined &&
          s.estimate !== null
        ) {
          proportion = s.estimate;
        } else if (
          dist.estimator === "raw" &&
          s.count !== undefined &&
          s.count !== null &&
          totalCount &&
          totalCount > 0
        ) {
          proportion = s.count / totalCount;
        } else if (
          s.estimate !== undefined &&
          s.estimate !== null
        ) {
          proportion = s.estimate;
        } else if (
          hasMass &&
          s.mass !== undefined &&
          s.mass !== null &&
          totalMass &&
          totalMass > 0
        ) {
          proportion = s.mass / totalMass;
        } else if (
          hasCount &&
          s.count !== undefined &&
          s.count !== null &&
          totalCount &&
          totalCount > 0
        ) {
          proportion = s.count / totalCount;
        }

        return {
          stateId: s.stateId,
          label,
          proportion,
          percentage: proportion * 100,
          estimate: s.estimate ?? null,
          mass: s.mass ?? null,
          count: s.count ?? null,
        };
      } else {
        const label = resolveStateLabel(stateId, null, canonicalMap);
        return {
          stateId,
          label,
          proportion: 0,
          percentage: 0,
          estimate: dist.estimator === "aalen_johansen" ? 0 : null,
          mass: null,
          count: dist.estimator === "raw" ? 0 : null,
        };
      }
    },
  );

  return {
    evaluationId: dist.evaluationId,
    horizon,
    estimator: dist.estimator,
    estimateOrigin: dist.estimateOrigin,
    censoringHeuristic: dist.censoringHeuristic,
    competingHeuristic: dist.competingHeuristic,
    states: processedStates,
    totalMass,
    totalCount,
  };
}

function buildOutcomeTooltip(
  horizon: number,
  st: ProcessedStateRow,
  totalCount: number | null,
  totalMass: number | null,
  digits: number,
  isTrajectory: boolean,
  estimator?: string,
  estimateOrigin?: string,
): string {
  const fields: Array<[string, unknown]> = [];

  if (estimateOrigin === "observed_step") {
    fields.push(["Step", horizon]);
    fields.push(["State", st.label]);

    if (estimator === "aalen_johansen") {
      if (st.estimate !== null) {
        fields.push(["AJ estimated occupancy", st.estimate.toFixed(digits)]);
      }
      fields.push(["Percentage", `${st.percentage.toFixed(1)}%`]);
    } else {
      if (st.count !== null) {
        fields.push(["Observed count", st.count]);
      }
      if (totalCount !== null) {
        fields.push(["Observed denominator", totalCount]);
      }
      fields.push(["Observed percentage", `${st.percentage.toFixed(1)}%`]);
    }
  } else {
    fields.push([isTrajectory ? "Time" : "Horizon", horizon]);
    fields.push(["Outcome status", st.label]);

    const countVal = st.count ?? st.mass;
    const totalVal = totalCount ?? totalMass;

    if (countVal !== null && countVal !== undefined) {
      fields.push(["Count", countVal]);
    }
    fields.push(["Percent", `${st.percentage.toFixed(1)}%`]);
    if (totalVal !== null && totalVal !== undefined) {
      fields.push(["Denominator", totalVal]);
    }
    fields.push(["Accounting", "Raw observed status"]);

    if (
      st.stateId === "real_censored" ||
      st.label.toLowerCase().includes("censored")
    ) {
      fields.push([
        "Note",
        "Censored before horizon; no censoring adjustment is applied.",
      ]);
    }
  }

  return tooltip(digits, fields);
}

function buildExclusionTooltip(
  horizon: number,
  categoryLabel: string,
  count: number,
  sampleSize: number,
  digits: number,
): string {
  const pct = sampleSize > 0 ? (count / sampleSize) * 100 : 0;
  const fields: Array<[string, unknown]> = [
    ["Horizon", horizon],
    ["Exclusion category", categoryLabel],
    ["Excluded count", count],
    ["Original sample size N", sampleSize],
    ["Excluded percentage", `${pct.toFixed(1)}%`],
  ];
  return tooltip(digits, fields);
}

export function renderOutcomeDistribution(
  spec: OutcomeDistributionSpec,
  options: V2RenderOptions = {},
): HTMLElement {
  assertOutcomeDistributionReferentialIntegrity(spec);

  const instanceId = ++outcomeDistributionInstanceCounter;
  const resolved = resolveV2RenderOptions(2, options);
  const { theme } = resolved;
  const digits = theme.tip.digits;

  const canonicalMap = resolveCanonicalStateLabels(spec);

  let currentEvalId = spec.evaluations[0].id;

  // Outer Root Container
  const container = document.createElement("div");
  container.className = "rtichoke-outcome-distribution";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Title
  if (spec.title) {
    const titleEl = document.createElement("h3");
    titleEl.className = "rtichoke-outcome-distribution__title";
    titleEl.textContent = spec.title;
    container.append(titleEl);
  }

  // Controls Container
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-outcome-distribution__controls";
  container.append(controlsDiv);

  // Slider Control Container (Single Shared Interaction)
  const sliderControl = document.createElement("div");
  sliderControl.className = "rtichoke-operating-point-control";
  sliderControl.style.marginLeft = `${theme.margins.left}px`;
  sliderControl.style.marginRight = `${theme.margins.right}px`;

  const sliderId = `rtichoke-od-slider-${++outcomeDistributionSliderCounter}`;

  const sliderLabel = document.createElement("label");
  sliderLabel.className = "rtichoke-operating-point-label";
  sliderLabel.htmlFor = sliderId;

  const sliderLabelText = document.createElement("span");
  const sliderValueText = document.createElement("span");
  sliderValueText.className = "rtichoke-operating-point-value";
  sliderLabel.append(sliderLabelText, sliderValueText);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = sliderId;
  slider.className = "rtichoke-operating-point-slider";

  sliderControl.append(sliderLabel, slider);

  // Panels Grid Layout Container
  const panelsGrid = document.createElement("div");
  panelsGrid.className = "rtichoke-outcome-distribution__panels";

  // Panel A Container
  const panelA = document.createElement("section");
  panelA.className = "rtichoke-outcome-distribution__panel rtichoke-outcome-distribution__panel--a";
  panelA.setAttribute("aria-label", "Outcome Distribution");

  const panelATitle = document.createElement("h4");
  panelATitle.className = "rtichoke-outcome-distribution__panel-title";
  panelATitle.textContent = "Outcome Distribution";

  const readoutADiv = document.createElement("div");
  readoutADiv.className = "rtichoke-outcome-distribution__readout";

  const legendADiv = document.createElement("div");
  legendADiv.className = "rtichoke-legend";

  const chartADiv = document.createElement("div");
  chartADiv.className = "rtichoke-outcome-distribution__chart";

  panelA.append(panelATitle, legendADiv, chartADiv);

  // Panel B Container (Secondary Compact Plot directly below Panel A)
  const panelB = document.createElement("section");
  panelB.className = "rtichoke-outcome-distribution__panel rtichoke-outcome-distribution__panel--b";
  panelB.setAttribute("aria-label", "Excluded Observations");

  const chartBDiv = document.createElement("div");
  chartBDiv.className = "rtichoke-outcome-distribution__chart";

  panelB.append(chartBDiv);

  panelsGrid.append(panelA, panelB);
  container.append(controlsDiv, sliderControl, panelsGrid, readoutADiv);

  // Determine authoritative state scale from component spec
  const effectiveStateScale = spec.stateScale ?? "nominal";
  const isOrdinal = effectiveStateScale === "ordinal";

  // Pre-initialize state color palette mapping strictly by stateId across all state distributions
  const stateColorMap = new Map<string, string>();
  if (spec.stateDistributions.length > 0) {
    const isObservedStep = spec.stateDistributions.some(
      (d) => d.estimateOrigin === "observed_step",
    );
    const uniqueStateIds: string[] = [];
    for (const dist of spec.stateDistributions) {
      for (const s of dist.states) {
        if (!uniqueStateIds.includes(s.stateId)) {
          uniqueStateIds.push(s.stateId);
        }
      }
    }
    const nStates = uniqueStateIds.length;

    if (isOrdinal) {
      const ordinalPalette = getOrdinalTrueBluePalette(nStates);
      uniqueStateIds.forEach((sId, idx) => {
        stateColorMap.set(sId, ordinalPalette[idx]);
      });
    } else if (isObservedStep) {
      uniqueStateIds.forEach((sId, idx) => {
        const col =
          NOMINAL_COLORFUL_MINIMAL_PALETTE[
            idx % NOMINAL_COLORFUL_MINIMAL_PALETTE.length
          ];
        stateColorMap.set(sId, col);
      });
    }
  }

  let nextColorIdx = 0;

  const getStateColor = (stateId: string): string => {
    if (stateColorMap.has(stateId)) return stateColorMap.get(stateId)!;

    const isObservedStep = spec.stateDistributions.some(
      (d) => d.estimateOrigin === "observed_step",
    );

    if (!isOrdinal && !isObservedStep && PREFERRED_STATE_COLORS[stateId]) {
      const col = PREFERRED_STATE_COLORS[stateId];
      stateColorMap.set(stateId, col);
      return col;
    }

    const palette = isObservedStep
      ? NOMINAL_COLORFUL_MINIMAL_PALETTE
      : STATE_COLOR_PALETTE;
    const col = palette[nextColorIdx % palette.length];
    nextColorIdx++;
    stateColorMap.set(stateId, col);
    return col;
  };

  let currentActiveHorizon: number | null = null;

  const updateChart = () => {
    controlsDiv.replaceChildren();

    // 1. Evaluation selection (if > 1 evaluation)
    if (spec.evaluations.length > 1) {
      const evalGroup = document.createElement("div");
      evalGroup.className = "rtichoke-pd-radio-group";
      evalGroup.setAttribute("role", "radiogroup");
      evalGroup.setAttribute("aria-label", "Evaluation");

      const evalGroupLabel = document.createElement("span");
      evalGroupLabel.className = "rtichoke-pd-radio-group-label";
      evalGroupLabel.textContent = "Evaluation:";
      evalGroup.append(evalGroupLabel);

      const evalOptions = document.createElement("div");
      evalOptions.className = "rtichoke-pd-radio-options";

      for (const ev of spec.evaluations) {
        const evLabelText = ev.label ?? ev.model ?? ev.population ?? ev.id;
        const optionLabel = document.createElement("label");
        optionLabel.className = "rtichoke-pd-radio-option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `od-eval-${instanceId}`;
        radio.value = ev.id;
        radio.checked = ev.id === currentEvalId;

        radio.addEventListener("change", () => {
          if (radio.checked) {
            currentEvalId = ev.id;
            updateChart();
          }
        });

        const span = document.createElement("span");
        span.textContent = evLabelText;

        optionLabel.append(radio, span);
        evalOptions.append(optionLabel);
      }

      evalGroup.append(evalOptions);
      controlsDiv.append(evalGroup);
    }

    // Filter distributions for current evaluation
    const evalDists = spec.stateDistributions.filter(
      (d) => d.evaluationId === currentEvalId,
    );

    if (evalDists.length === 0) {
      sliderControl.style.display = "none";
      readoutADiv.replaceChildren();
      legendADiv.style.display = "none";
      chartADiv.replaceChildren();
      panelB.style.display = "none";
      panelsGrid.className = "rtichoke-outcome-distribution__panels";
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "rtichoke-outcome-distribution__empty";
      emptyMsg.textContent = "No state distribution data available.";
      chartADiv.append(emptyMsg);
      return;
    }

    // Defensive check: detect if multiple heuristic/method variants exist for any (estimateOrigin, horizon)
    const originHorizonKeys = new Set<string>();
    let hasMultipleHeuristicVariants = false;

    for (const d of evalDists) {
      const originKey = d.estimateOrigin ?? "unspecified";
      const key = `${originKey}:${d.horizon ?? 0}`;
      if (originHorizonKeys.has(key)) {
        hasMultipleHeuristicVariants = true;
        break;
      }
      originHorizonKeys.add(key);
    }

    if (hasMultipleHeuristicVariants) {
      sliderControl.style.display = "none";
      readoutADiv.replaceChildren();
      legendADiv.style.display = "none";
      chartADiv.replaceChildren();
      panelB.style.display = "none";
      panelsGrid.className = "rtichoke-outcome-distribution__panels";
      const msg = document.createElement("p");
      msg.className = "rtichoke-outcome-distribution__empty";
      msg.textContent =
        "Multiple heuristic/method variants detected for evaluation; unsupported data state.";
      chartADiv.append(msg);
      return;
    }

    const observedStepDists = evalDists.filter(
      (d) => d.estimateOrigin === "observed_step",
    );

    let masterStateOrder: string[] = [];
    if (observedStepDists.length > 0) {
      const stepOrders = observedStepDists.map((d) =>
        d.states.map((s) => s.stateId),
      );
      masterStateOrder = inferTopologicalStateOrder(stepOrders) ?? [];
    }

    const eventTableRows = evalDists
      .filter((d) => d.estimateOrigin === "event_table")
      .map((d) => processStateDistribution(d, canonicalMap))
      .sort((a, b) => a.horizon - b.horizon);

    const fixedHorizonRows = evalDists
      .filter((d) => d.estimateOrigin === "fixed_time_horizon")
      .map((d) => processStateDistribution(d, canonicalMap))
      .sort((a, b) => a.horizon - b.horizon);

    const observedStepRows = evalDists
      .filter((d) => d.estimateOrigin === "observed_step")
      .map((d) => processStateDistribution(d, canonicalMap, masterStateOrder))
      .sort((a, b) => a.horizon - b.horizon);

    const isObservedStepMode = observedStepRows.length > 0;

    // Extract available step/horizon points
    // For fixed-time horizon, the time axis and slider begin at time 0
    let availableSteps: number[];
    if (isObservedStepMode) {
      availableSteps = Array.from(
        new Set(observedStepRows.map((r) => r.horizon)),
      ).sort((a, b) => a - b);
    } else {
      const suppliedHorizons = Array.from(
        new Set(
          (fixedHorizonRows.length > 0 ? fixedHorizonRows : eventTableRows).map(
            (r) => r.horizon,
          ),
        ),
      ).sort((a, b) => a - b);
      availableSteps = suppliedHorizons.includes(0)
        ? suppliedHorizons
        : [0, ...suppliedHorizons];
    }

    if (
      eventTableRows.length === 0 &&
      fixedHorizonRows.length === 0 &&
      observedStepRows.length === 0
    ) {
      sliderControl.style.display = "none";
      readoutADiv.replaceChildren();
      legendADiv.style.display = "none";
      chartADiv.replaceChildren();
      panelB.style.display = "none";
      panelsGrid.className = "rtichoke-outcome-distribution__panels";
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "rtichoke-outcome-distribution__empty";
      emptyMsg.textContent =
        "No outcome distribution data found for current selection.";
      chartADiv.append(emptyMsg);
      return;
    }

    const isTrajectoryMode =
      eventTableRows.length > 0 ||
      (isObservedStepMode && observedStepRows.length > 1);

    // Slider setup
    if (isObservedStepMode) {
      if (observedStepRows.length > 1) {
        sliderControl.style.display = "flex";
        if (currentActiveHorizon === null) {
          currentActiveHorizon = availableSteps[availableSteps.length - 1];
        } else {
          currentActiveHorizon = selectNearestStep(
            currentActiveHorizon,
            availableSteps,
          );
        }

        const hIdx = availableSteps.indexOf(currentActiveHorizon);
        const maxIdx = availableSteps.length - 1;

        slider.min = "0";
        slider.max = String(Math.max(0, maxIdx));
        slider.step = "1";
        slider.value = String(Math.max(0, hIdx));

        sliderLabelText.textContent = "Step: ";
        sliderValueText.textContent = String(currentActiveHorizon);
        slider.setAttribute("aria-label", "Step");
        slider.setAttribute("aria-valuetext", String(currentActiveHorizon));
      } else {
        sliderControl.style.display = "none";
        currentActiveHorizon = availableSteps[0];
      }
    } else if (availableSteps.length > 0) {
      sliderControl.style.display = "flex";
      if (currentActiveHorizon === null) {
        currentActiveHorizon = availableSteps[availableSteps.length - 1];
      } else {
        currentActiveHorizon = selectNearestStep(
          currentActiveHorizon,
          availableSteps,
        );
      }

      const hIdx = availableSteps.indexOf(currentActiveHorizon);
      const maxIdx = availableSteps.length - 1;

      slider.min = "0";
      slider.max = String(Math.max(0, maxIdx));
      slider.step = "1";
      slider.value = String(Math.max(0, hIdx));

      sliderLabelText.textContent = "Time: ";
      sliderValueText.textContent = currentActiveHorizon.toFixed(digits);
      slider.setAttribute("aria-label", "Time horizon");
      slider.setAttribute(
        "aria-valuetext",
        currentActiveHorizon.toFixed(digits),
      );
    } else {
      sliderControl.style.display = "none";
    }

    // Evaluate Panel B Visibility & Incomplete Metadata
    const popExclusion = spec.exclusions?.find(
      (e) => e.evaluationId === currentEvalId,
    );

    const isHeuristicAware =
      spec.variants !== undefined ||
      spec.stateDistributions.some(
        (d) =>
          d.censoringHeuristic !== undefined ||
          d.competingHeuristic !== undefined,
      );

    let isPanelBVisible = false;
    let hasIncompleteExclusionData = false;

    if (popExclusion) {
      // Validate complete horizon coverage: every supplied non-zero prediction horizon in availableSteps must have an explicit record
      const requiredExclusionHorizons = availableSteps.filter((step) => step > 0);
      const exclusionHorizons = new Set(
        popExclusion.excludedCounts.map((e) => e.horizon),
      );
      const hasFullHorizonCoverage = requiredExclusionHorizons.every((step) =>
        exclusionHorizons.has(step),
      );

      if (!hasFullHorizonCoverage) {
        isPanelBVisible = true;
        hasIncompleteExclusionData = true;
      } else {
        const totalExclusionsAcrossAllHorizons =
          popExclusion.excludedCounts.reduce(
            (sum, item) =>
              sum + item.censoredExcludedCount + item.competingExcludedCount,
            0,
          );

        if (totalExclusionsAcrossAllHorizons > 0) {
          isPanelBVisible = true;
        }
      }
    } else if (isHeuristicAware) {
      // Incomplete exclusion metadata for a heuristic-aware component
      isPanelBVisible = true;
      hasIncompleteExclusionData = true;
    }

    if (isPanelBVisible) {
      panelsGrid.className = "rtichoke-outcome-distribution__panels";
      panelB.style.display = "flex";
    } else {
      panelsGrid.className = "rtichoke-outcome-distribution__panels";
      panelB.style.display = "none";
    }

    const panelAWidth = theme.width;
    const panelBWidth = theme.width;

    // --- PANEL A RENDERING ---
    readoutADiv.replaceChildren();
    const activeDataRow = isObservedStepMode
      ? observedStepRows.find((r) => r.horizon === currentActiveHorizon)
      : (fixedHorizonRows.find((r) => r.horizon === currentActiveHorizon) ??
        eventTableRows.find((r) => r.horizon === currentActiveHorizon));

    if (activeDataRow) {
      const readoutCard = document.createElement("div");
      readoutCard.className = "rtichoke-outcome-distribution__readout-card";

      const readoutHeader = document.createElement("div");
      readoutHeader.className =
        "rtichoke-outcome-distribution__readout-header";
      readoutHeader.textContent = isObservedStepMode
        ? `Active Step: Step = ${activeDataRow.horizon}`
        : `Active Horizon: Time = ${activeDataRow.horizon.toFixed(digits)}`;
      readoutCard.append(readoutHeader);

      const readoutTable = document.createElement("table");
      readoutTable.className = "rtichoke-outcome-distribution__readout-table";

      const rHead = document.createElement("thead");
      const rHeadRow = document.createElement("tr");

      const thOutcome = document.createElement("th");
      thOutcome.textContent = isObservedStepMode ? "State" : "Outcome";

      const thShare = document.createElement("th");
      if (isObservedStepMode && activeDataRow.estimator === "aalen_johansen") {
        thShare.textContent = "Occupancy (%)";
      } else {
        thShare.textContent = "Count / Total (%)";
      }

      rHeadRow.append(thOutcome, thShare);
      rHead.append(rHeadRow);
      readoutTable.append(rHead);

      const rBody = document.createElement("tbody");
      const totalDenominator =
        activeDataRow.totalCount ?? activeDataRow.totalMass;

      for (const st of activeDataRow.states) {
        const tr = document.createElement("tr");

        const tdLabel = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "rtichoke-performance-table__badge";
        const stateColor = getStateColor(st.stateId);
        badge.style.backgroundColor = stateColor;
        tdLabel.append(badge, document.createTextNode(st.label));

        const tdShare = document.createElement("td");
        tdShare.className = "rtichoke-outcome-distribution__readout-cell";

        const barContainer = document.createElement("div");
        barContainer.className = "rtichoke-performance-table__bar";

        const barFill = document.createElement("div");
        barFill.className = "rtichoke-performance-table__bar-fill";
        barFill.style.backgroundColor = stateColor;
        barFill.style.opacity = "0.45";
        const widthPct = Math.min(Math.max(st.percentage, 0), 100);
        barFill.style.width = `${widthPct}%`;
        barContainer.append(barFill);

        const contentSpan = document.createElement("span");
        contentSpan.className = "rtichoke-performance-table__cell-text";

        if (
          isObservedStepMode &&
          activeDataRow.estimator === "aalen_johansen"
        ) {
          contentSpan.textContent = `${st.percentage.toFixed(1)}%`;
        } else {
          const countVal = st.count ?? st.mass;
          if (
            countVal !== null &&
            countVal !== undefined &&
            totalDenominator !== null &&
            totalDenominator !== undefined
          ) {
            contentSpan.textContent = `${countVal.toLocaleString()} / ${totalDenominator.toLocaleString()} (${st.percentage.toFixed(1)}%)`;
          } else {
            contentSpan.textContent = `${st.percentage.toFixed(1)}%`;
          }
        }

        tdShare.append(barContainer, contentSpan);
        tr.append(tdLabel, tdShare);
        rBody.append(tr);
      }

      // Unified Summary Table: Append Excluded Observations section iff active heuristic excludes subjects
      if (popExclusion && !isObservedStepMode) {
        const sampleSize = popExclusion.originalSampleSize;
        const activeExclusionItem =
          currentActiveHorizon !== null
            ? popExclusion.excludedCounts.find(
                (e) => e.horizon === currentActiveHorizon,
              )
            : undefined;

        const censCount =
          currentActiveHorizon === 0
            ? 0
            : (activeExclusionItem?.censoredExcludedCount ?? 0);
        const compCount =
          currentActiveHorizon === 0
            ? 0
            : (activeExclusionItem?.competingExcludedCount ?? 0);

        const activeDist = evalDists.find(
          (d) => d.horizon === currentActiveHorizon,
        ) ?? evalDists[0];

        const censHeuristic = activeDist?.censoringHeuristic;
        const compHeuristic = activeDist?.competingHeuristic;

        const showCensoredRow = censHeuristic === "excluded";
        const showCompetingRow = compHeuristic === "excluded";

        if (showCensoredRow || showCompetingRow) {
          const exHeaderRow = document.createElement("tr");
          const exHeaderCell = document.createElement("td");
          exHeaderCell.colSpan = 2;
          exHeaderCell.style.fontWeight = "600";
          exHeaderCell.style.paddingTop = "0.75rem";
          exHeaderCell.style.paddingBottom = "0.25rem";
          exHeaderCell.style.borderTop = "1px solid #e5e7eb";
          exHeaderCell.textContent = "Excluded Observations";
          exHeaderRow.append(exHeaderCell);
          rBody.append(exHeaderRow);

          if (showCensoredRow) {
            const trCens = document.createElement("tr");
            const tdLabelCens = document.createElement("td");
            const badgeCens = document.createElement("span");
            badgeCens.className = "rtichoke-performance-table__badge";
            badgeCens.style.backgroundColor = EXCLUSION_COLORS.censored;
            tdLabelCens.append(
              badgeCens,
              document.createTextNode("Censored excluded"),
            );

            const tdShareCens = document.createElement("td");
            tdShareCens.className =
              "rtichoke-outcome-distribution__readout-cell";

            const barContainerCens = document.createElement("div");
            barContainerCens.className = "rtichoke-performance-table__bar";

            const barFillCens = document.createElement("div");
            barFillCens.className = "rtichoke-performance-table__bar-fill";
            barFillCens.style.backgroundColor = EXCLUSION_COLORS.censored;
            barFillCens.style.opacity = "0.45";
            const censPct =
              sampleSize > 0 ? (censCount / sampleSize) * 100 : 0;
            barFillCens.style.width = `${Math.min(Math.max(censPct, 0), 100)}%`;
            barContainerCens.append(barFillCens);

            const contentCens = document.createElement("span");
            contentCens.className = "rtichoke-performance-table__cell-text";
            contentCens.textContent = `${censCount.toLocaleString()} / ${sampleSize.toLocaleString()} (${censPct.toFixed(1)}%)`;

            tdShareCens.append(barContainerCens, contentCens);
            trCens.append(tdLabelCens, tdShareCens);
            rBody.append(trCens);
          }

          if (showCompetingRow) {
            const trComp = document.createElement("tr");
            const tdLabelComp = document.createElement("td");
            const badgeComp = document.createElement("span");
            badgeComp.className = "rtichoke-performance-table__badge";
            badgeComp.style.backgroundColor = EXCLUSION_COLORS.competing;
            tdLabelComp.append(
              badgeComp,
              document.createTextNode("Competing excluded"),
            );

            const tdShareComp = document.createElement("td");
            tdShareComp.className =
              "rtichoke-outcome-distribution__readout-cell";

            const barContainerComp = document.createElement("div");
            barContainerComp.className = "rtichoke-performance-table__bar";

            const barFillComp = document.createElement("div");
            barFillComp.className = "rtichoke-performance-table__bar-fill";
            barFillComp.style.backgroundColor = EXCLUSION_COLORS.competing;
            barFillComp.style.opacity = "0.45";
            const compPct =
              sampleSize > 0 ? (compCount / sampleSize) * 100 : 0;
            barFillComp.style.width = `${Math.min(Math.max(compPct, 0), 100)}%`;
            barContainerComp.append(barFillComp);

            const contentComp = document.createElement("span");
            contentComp.className = "rtichoke-performance-table__cell-text";
            contentComp.textContent = `${compCount.toLocaleString()} / ${sampleSize.toLocaleString()} (${compPct.toFixed(1)}%)`;

            tdShareComp.append(barContainerComp, contentComp);
            trComp.append(tdLabelComp, tdShareComp);
            rBody.append(trComp);
          }
        }
      }

      readoutTable.append(rBody);
      readoutCard.append(readoutTable);
      readoutADiv.append(readoutCard);
    } else if (currentActiveHorizon === 0 && !isObservedStepMode) {
      // Unestimated baseline at Time = 0
      const readoutCard = document.createElement("div");
      readoutCard.className = "rtichoke-outcome-distribution__readout-card";

      const readoutHeader = document.createElement("div");
      readoutHeader.className =
        "rtichoke-outcome-distribution__readout-header";
      readoutHeader.textContent = "Active Horizon: Time = 0.000";

      const unestMsg = document.createElement("div");
      unestMsg.className = "rtichoke-outcome-distribution__incomplete";
      unestMsg.style.marginTop = "0.25rem";
      unestMsg.textContent =
        "Baseline origin (Time = 0). No outcome probability estimates are calculated at baseline.";

      readoutCard.append(readoutHeader, unestMsg);
      readoutADiv.append(readoutCard);
    }

    // Panel A Legend
    legendADiv.replaceChildren();
    legendADiv.style.display = "flex";

    const legendTitle = document.createElement("span");
    legendTitle.style.fontWeight = "600";
    legendTitle.style.marginRight = "0.5rem";
    legendTitle.textContent = "Outcome:";
    legendADiv.append(legendTitle);

    const allStatesMap = new Map<string, { stateId: string; label: string }>();
    const rowsToScan = isObservedStepMode
      ? observedStepRows
      : isTrajectoryMode
        ? eventTableRows
        : fixedHorizonRows;
    for (const r of rowsToScan) {
      for (const st of r.states) {
        if (!allStatesMap.has(st.label)) {
          allStatesMap.set(st.label, { stateId: st.stateId, label: st.label });
        }
      }
    }

    for (const st of allStatesMap.values()) {
      const item = document.createElement("div");
      item.className = "rtichoke-legend-item";

      const swatch = document.createElement("span");
      swatch.className = "rtichoke-legend-swatch";

      const lineSpan = document.createElement("span");
      lineSpan.className = "rtichoke-legend-line";
      lineSpan.style.backgroundColor = getStateColor(st.stateId);
      lineSpan.style.height = "10px";
      lineSpan.style.borderRadius = "2px";
      swatch.append(lineSpan);

      const labelSpan = document.createElement("span");
      labelSpan.className = "rtichoke-legend-label";
      labelSpan.textContent = st.label;

      item.append(swatch, labelSpan);
      legendADiv.append(item);
    }

    // Panel A Marks
    const marksA: Plot.Markish[] = [];

    if (isObservedStepMode) {
      const plotData: Array<{
        step: number;
        stepLabel: string;
        stateId: string;
        label: string;
        percentage: number;
        color: string;
        title: string;
      }> = [];

      for (const row of observedStepRows) {
        for (const st of row.states) {
          const color = getStateColor(st.stateId);
          const tipText = buildOutcomeTooltip(
            row.horizon,
            st,
            row.totalCount,
            row.totalMass,
            digits,
            false,
            row.estimator,
            row.estimateOrigin,
          );

          plotData.push({
            step: row.horizon,
            stepLabel: `Step ${row.horizon}`,
            stateId: st.stateId,
            label: st.label,
            percentage: st.percentage,
            color,
            title: tipText,
          });
        }
      }

      marksA.push(
        Plot.barY(
          plotData,
          Plot.stackY({
            x: "step",
            y: "percentage",
            z: "stateId",
            fill: (d) => d.color,
            fillOpacity: (d) =>
              currentActiveHorizon === null || d.step <= currentActiveHorizon
                ? 0.88
                : 0.28,
            stroke: theme.axis.color,
            strokeWidth: 0.75,
            title: (d) => d.title,
          }),
        ),
      );

      if (currentActiveHorizon !== null) {
        marksA.push(
          Plot.barY([{ step: currentActiveHorizon, percentage: 100 }], {
            x: "step",
            y: "percentage",
            fill: "none",
            stroke: theme.axis.color,
            strokeWidth: 2.5,
          }),
        );
      }
    } else if (eventTableRows.length > 0) {
      const plotData: Array<{
        horizon: number;
        stateId: string;
        label: string;
        percentage: number;
        color: string;
        title: string;
      }> = [];

      for (const row of eventTableRows) {
        for (const st of row.states) {
          const color = getStateColor(st.stateId);
          const tipText = buildOutcomeTooltip(
            row.horizon,
            st,
            row.totalCount,
            row.totalMass,
            digits,
            true,
            row.estimator,
            row.estimateOrigin,
          );

          plotData.push({
            horizon: row.horizon,
            stateId: st.stateId,
            label: st.label,
            percentage: st.percentage,
            color,
            title: tipText,
          });
        }
      }

      marksA.push(
        Plot.areaY(
          plotData,
          Plot.stackY({
            x: "horizon",
            y: "percentage",
            z: "stateId",
            fill: (d) => d.color,
            fillOpacity: 0.85,
            curve: "step-after",
          }),
        ),
      );

      const firstRowStates = eventTableRows[0]?.states ?? [];
      const numInternalBoundaries = firstRowStates.length - 1;

      if (numInternalBoundaries > 0) {
        const boundaryData: Array<{
          boundaryIndex: number;
          horizon: number;
          cumulativePercentage: number;
        }> = [];

        for (const row of eventTableRows) {
          let cumulative = 0;
          for (let b = 0; b < numInternalBoundaries; b++) {
            const st = row.states[b];
            if (st) {
              cumulative += st.percentage;
              boundaryData.push({
                boundaryIndex: b,
                horizon: row.horizon,
                cumulativePercentage: cumulative,
              });
            }
          }
        }

        marksA.push(
          Plot.lineY(boundaryData, {
            x: "horizon",
            y: "cumulativePercentage",
            z: "boundaryIndex",
            stroke: theme.axis.color,
            strokeWidth: 1,
            strokeOpacity: 0.8,
            curve: "step-after",
          }),
        );
      }

      for (const fh of availableSteps) {
        const isSelected = fh === currentActiveHorizon;
        marksA.push(
          Plot.ruleX([fh], {
            stroke: theme.axis.color,
            strokeWidth: isSelected ? 2.5 : 1,
            strokeDasharray: isSelected ? undefined : "3,3",
          }),
        );

        if (isSelected) {
          marksA.push(
            Plot.text(
              [
                {
                  x: fh,
                  label: `Time = ${fh.toFixed(digits)}`,
                },
              ],
              {
                x: "x",
                y: 102,
                text: "label",
                dy: -10,
                fill: theme.axis.color,
                fontSize: 11,
                fontWeight: 700,
              },
            ),
          );
        }
      }
    } else {
      const plotData: Array<{
        horizonLabel: string;
        horizon: number;
        stateId: string;
        label: string;
        percentage: number;
        color: string;
        title: string;
      }> = [];

      for (const row of fixedHorizonRows) {
        for (const st of row.states) {
          const color = getStateColor(st.stateId);
          const tipText = buildOutcomeTooltip(
            row.horizon,
            st,
            row.totalCount,
            row.totalMass,
            digits,
            false,
            row.estimator,
            row.estimateOrigin,
          );

          plotData.push({
            horizonLabel: `Time: ${row.horizon}`,
            horizon: row.horizon,
            stateId: st.stateId,
            label: st.label,
            percentage: st.percentage,
            color,
            title: tipText,
          });
        }
      }

      marksA.push(
        Plot.barY(
          plotData,
          Plot.stackY({
            x: "horizonLabel",
            y: "percentage",
            z: "stateId",
            fill: (d) => d.color,
            fillOpacity: 0.88,
            stroke: theme.axis.color,
            strokeWidth: 0.75,
            title: (d) => d.title,
          }),
        ),
      );
    }

    const plotSpecA = {
      width: panelAWidth,
      height: Math.round(theme.height * 0.65),
      marginTop: theme.margins.top + 10,
      marginRight: theme.margins.right,
      marginBottom: theme.margins.bottom,
      marginLeft: theme.margins.left,
      style: {
        background: theme.background,
        color: theme.axis.color,
        fontFamily: theme.typography.fontFamily,
        fontSize: `${theme.typography.fontSize}px`,
      },
      x: isObservedStepMode
        ? isTrajectoryMode
          ? {
              label: "Step",
              grid: false,
              line: true,
              ticks: availableSteps,
              tickFormat: (d: number) => String(d),
              tickSize: theme.axis.tickSize,
              tickPadding: theme.axis.tickPadding,
            }
          : {
              label: "Step",
              grid: false,
              line: true,
            }
        : isTrajectoryMode
          ? {
              label: "Time",
              grid: false,
              line: true,
              ticks: theme.axis.ticks,
              tickSize: theme.axis.tickSize,
              tickPadding: theme.axis.tickPadding,
            }
          : {
              label: "Time",
              grid: false,
              line: true,
            },
      y: {
        label: isObservedStepMode ? "State occupancy (%)" : "Outcomes",
        domain: [0, 100],
        grid: false,
        line: true,
        ticks: 5,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
        tickFormat: (d: number) => `${d}%`,
      },
      marks: marksA,
    };

    const chartSvgA = themedPlot(plotSpecA, theme);
    chartADiv.replaceChildren(chartSvgA);

    // --- PANEL B RENDERING ---
    if (isPanelBVisible) {
      chartBDiv.replaceChildren();

      if (hasIncompleteExclusionData) {
        const incMsg = document.createElement("div");
        incMsg.className = "rtichoke-outcome-distribution__incomplete";
        incMsg.textContent =
          "Exclusion metadata is incomplete or unavailable for the active evaluation selection.";
        chartBDiv.append(incMsg);
      } else if (popExclusion) {
        const sampleSize = popExclusion.originalSampleSize;

        const activeExclusionItem =
          currentActiveHorizon !== null
            ? popExclusion.excludedCounts.find(
                (e) => e.horizon === currentActiveHorizon,
              )
            : undefined;

        if (currentActiveHorizon !== 0 && !activeExclusionItem) {
          const incMsg = document.createElement("div");
          incMsg.className = "rtichoke-outcome-distribution__incomplete";
          incMsg.textContent = `Exclusion metadata is missing for horizon ${currentActiveHorizon}.`;
          chartBDiv.append(incMsg);
          return;
        }

        // Panel B Plot Chart Data
        const sortedExclusions = [...popExclusion.excludedCounts].sort(
          (a, b) => a.horizon - b.horizon,
        );

        const panelBPlotData: Array<{
          horizon: number;
          horizonLabel: string;
          category: string;
          count: number;
          percentage: number;
          color: string;
          title: string;
        }> = [];

        for (const ex of sortedExclusions) {
          const cPct = (ex.censoredExcludedCount / sampleSize) * 100;
          const compPctVal = (ex.competingExcludedCount / sampleSize) * 100;

          panelBPlotData.push({
            horizon: ex.horizon,
            horizonLabel: `Time: ${ex.horizon}`,
            category: "censored",
            count: ex.censoredExcludedCount,
            percentage: cPct,
            color: EXCLUSION_COLORS.censored,
            title: buildExclusionTooltip(
              ex.horizon,
              "Censored excluded",
              ex.censoredExcludedCount,
              sampleSize,
              digits,
            ),
          });

          panelBPlotData.push({
            horizon: ex.horizon,
            horizonLabel: `Time: ${ex.horizon}`,
            category: "competing",
            count: ex.competingExcludedCount,
            percentage: compPctVal,
            color: EXCLUSION_COLORS.competing,
            title: buildExclusionTooltip(
              ex.horizon,
              "Competing events excluded",
              ex.competingExcludedCount,
              sampleSize,
              digits,
            ),
          });
        }

        const marksB: Plot.Markish[] = [
          Plot.barY(
            panelBPlotData,
            Plot.stackY({
              x: "horizon",
              y: "percentage",
              z: "category",
              fill: (d) => d.color,
              fillOpacity: (d) =>
                currentActiveHorizon === null || d.horizon <= currentActiveHorizon
                  ? 0.88
                  : 0.28,
              stroke: theme.axis.color,
              strokeWidth: 0.75,
              title: (d) => d.title,
            }),
          ),
        ];

        for (const ex of sortedExclusions) {
          const isSelected = ex.horizon === currentActiveHorizon;
          if (isSelected) {
            const totPct =
              ((ex.censoredExcludedCount + ex.competingExcludedCount) /
                sampleSize) *
              100;
            marksB.push(
              Plot.barY([{ horizon: ex.horizon, percentage: totPct }], {
                x: "horizon",
                y: "percentage",
                fill: "none",
                stroke: theme.axis.color,
                strokeWidth: 2.5,
              }),
            );
          }
        }

        const plotSpecB = {
          width: panelBWidth,
          height: 120,
          marginTop: 10,
          marginRight: theme.margins.right,
          marginBottom: theme.margins.bottom,
          marginLeft: theme.margins.left,
          style: {
            background: theme.background,
            color: theme.axis.color,
            fontFamily: theme.typography.fontFamily,
            fontSize: `${theme.typography.fontSize}px`,
          },
          x: {
            label: "Time",
            grid: false,
            line: true,
            ticks: availableSteps,
            tickFormat: (d: number) => String(d),
            tickSize: theme.axis.tickSize,
            tickPadding: theme.axis.tickPadding,
          },
          y: {
            label: "Excluded observations (%)",
            domain: [0, 100],
            grid: false,
            line: true,
            ticks: 5,
            tickSize: theme.axis.tickSize,
            tickPadding: theme.axis.tickPadding,
            tickFormat: (d: number) => `${d}%`,
          },
          marks: marksB,
        };

        const chartSvgB = themedPlot(plotSpecB, theme);
        chartBDiv.replaceChildren(chartSvgB);
      }
    }
  };

  slider.addEventListener("input", () => {
    const evalDists = spec.stateDistributions.filter(
      (d) => d.evaluationId === currentEvalId,
    );

    const isObservedStep = evalDists.some(
      (d) => d.estimateOrigin === "observed_step",
    );

      let steps: number[];
      if (isObservedStep) {
        steps = Array.from(
          new Set(
            evalDists
              .filter((d) => d.estimateOrigin === "observed_step")
              .map((d) => d.horizon ?? 0),
          ),
        ).sort((a, b) => a - b);
      } else {
        const supplied = Array.from(
          new Set(
            evalDists
              .filter((d) => d.estimateOrigin === "fixed_time_horizon" || d.estimateOrigin === "event_table")
              .map((d) => d.horizon ?? 0),
          ),
        ).sort((a, b) => a - b);
        steps = supplied.includes(0) ? supplied : [0, ...supplied];
      }

    const idx = Number(slider.value);
    if (idx >= 0 && idx < steps.length) {
      currentActiveHorizon = steps[idx];
      updateChart();
    }
  });

  updateChart();
  return container;
}
