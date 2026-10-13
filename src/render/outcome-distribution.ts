import * as Plot from "@observablehq/plot";
import type { OutcomeDistributionSpec } from "../spec/v2/outcome-distribution.js";
import type { StateDistribution } from "../spec/v2/state-distribution.js";
import { assertOutcomeDistributionReferentialIntegrity } from "../spec/v2/validate-outcome-distribution.js";
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
  real_positive: "#4C5454",
  real_positives_est: "#4C5454",
  target_event: "#4C5454",
  real_competing: "#C880B7",
  real_competing_est: "#C880B7",
  competing_outcome: "#C880B7",
  real_negative: "#E0E0E0",
  real_negatives_est: "#E0E0E0",
  no_target_event: "#E0E0E0",
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

function resolveStateLabel(stateId: string, customLabel?: string | null): string {
  if (customLabel && customLabel.trim() !== "") {
    return customLabel;
  }
  if (CANONICAL_STATE_LABELS[stateId]) {
    return CANONICAL_STATE_LABELS[stateId];
  }
  return stateId;
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
): ProcessedHorizonData {
  const horizon = dist.horizon ?? 0;
  const states = dist.states;

  let hasEstimate = false;
  let hasMass = false;
  let hasCount = false;

  for (const s of states) {
    if (s.estimate !== undefined && s.estimate !== null) hasEstimate = true;
    if (s.mass !== undefined && s.mass !== null) hasMass = true;
    if (s.count !== undefined && s.count !== null) hasCount = true;
  }

  let totalMass: number | null = null;
  let totalCount: number | null = null;

  if (hasMass) {
    totalMass = states.reduce(
      (acc, s) => acc + (s.mass !== undefined && s.mass !== null ? s.mass : 0),
      0,
    );
  }

  if (hasCount) {
    totalCount = states.reduce(
      (acc, s) => acc + (s.count !== undefined && s.count !== null ? s.count : 0),
      0,
    );
  }

  const processedStates: ProcessedStateRow[] = states.map((s) => {
    const label = resolveStateLabel(s.stateId, s.label);
    let proportion = 0;

    if (hasEstimate && s.estimate !== undefined && s.estimate !== null) {
      proportion = s.estimate;
    } else if (hasMass && s.mass !== undefined && s.mass !== null && totalMass && totalMass > 0) {
      proportion = s.mass / totalMass;
    } else if (hasCount && s.count !== undefined && s.count !== null && totalCount && totalCount > 0) {
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
  });

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
): string {
  const fields: Array<[string, unknown]> = [];
  fields.push([isTrajectory ? "Time" : "Horizon", horizon]);
  fields.push(["Outcome status", st.label]);

  const countVal = st.count ?? st.mass;
  const totalVal = totalCount ?? totalMass;

  if (countVal !== null && countVal !== undefined) {
    fields.push(["Count", countVal]);
  }
  fields.push(["Share", `${st.percentage.toFixed(1)}%`]);
  if (totalVal !== null && totalVal !== undefined) {
    fields.push(["Denominator", totalVal]);
  }
  fields.push(["Accounting", "Raw observed status"]);

  if (st.stateId === "real_censored" || st.label.toLowerCase().includes("censored")) {
    fields.push([
      "Note",
      "Censored before or at horizon; no censoring adjustment is applied.",
    ]);
  }

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

  let currentEvalId = spec.evaluations[0].id;

  // Outer Root Container
  const container = document.createElement("div");
  container.className = "rtichoke-outcome-distribution";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Title
  const titleText = spec.title ?? "Outcome Distribution";
  const titleEl = document.createElement("h3");
  titleEl.className = "rtichoke-outcome-distribution__title";
  titleEl.textContent = titleText;
  container.append(titleEl);

  // Controls Container
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-outcome-distribution__controls";
  container.append(controlsDiv);

  // Summary / Active Horizon Readout Container
  const readoutDiv = document.createElement("div");
  readoutDiv.className = "rtichoke-outcome-distribution__readout";
  container.append(readoutDiv);

  // Slider Control Container
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

  // Legend Area
  const legendDiv = document.createElement("div");
  legendDiv.className = "rtichoke-legend";
  legendDiv.style.paddingLeft = `${theme.margins.left}px`;

  // Chart Container
  const chartDiv = document.createElement("div");
  chartDiv.className = "rtichoke-outcome-distribution__chart";

  container.append(sliderControl, legendDiv, chartDiv);

  // State Color Mapping cache
  const stateColorMap = new Map<string, string>();
  let nextColorIdx = 0;

  const getStateColor = (stateId: string, label: string): string => {
    const key = `${stateId}:${label}`;
    if (stateColorMap.has(key)) return stateColorMap.get(key)!;

    if (PREFERRED_STATE_COLORS[stateId]) {
      const col = PREFERRED_STATE_COLORS[stateId];
      stateColorMap.set(key, col);
      return col;
    }

    const col = STATE_COLOR_PALETTE[nextColorIdx % STATE_COLOR_PALETTE.length];
    nextColorIdx++;
    stateColorMap.set(key, col);
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
            currentActiveHorizon = null;
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
      legendDiv.style.display = "none";
      readoutDiv.replaceChildren();
      chartDiv.replaceChildren();
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "rtichoke-outcome-distribution__empty";
      emptyMsg.textContent = "No state distribution data available.";
      chartDiv.append(emptyMsg);
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
      legendDiv.style.display = "none";
      readoutDiv.replaceChildren();
      chartDiv.replaceChildren();
      const msg = document.createElement("p");
      msg.className = "rtichoke-outcome-distribution__empty";
      msg.textContent =
        "Multiple heuristic/method variants detected for evaluation; unsupported data state.";
      chartDiv.append(msg);
      return;
    }

    const eventTableRows = evalDists
      .filter((d) => d.estimateOrigin === "event_table")
      .map(processStateDistribution)
      .sort((a, b) => a.horizon - b.horizon);

    const fixedHorizonRows = evalDists
      .filter((d) => d.estimateOrigin === "fixed_time_horizon")
      .map(processStateDistribution)
      .sort((a, b) => a.horizon - b.horizon);

    // Extract available fixed horizon time points
    const fixedHorizons = Array.from(
      new Set(fixedHorizonRows.map((r) => r.horizon)),
    ).sort((a, b) => a - b);

    if (eventTableRows.length === 0 && fixedHorizonRows.length === 0) {
      sliderControl.style.display = "none";
      legendDiv.style.display = "none";
      readoutDiv.replaceChildren();
      chartDiv.replaceChildren();
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "rtichoke-outcome-distribution__empty";
      emptyMsg.textContent =
        "No outcome distribution data found for current selection.";
      chartDiv.append(emptyMsg);
      return;
    }

    const isTrajectoryMode = eventTableRows.length > 0;

    // Fixed Horizon Slider setup
    if (fixedHorizons.length > 0) {
      sliderControl.style.display = "flex";
      if (
        currentActiveHorizon === null ||
        !fixedHorizons.includes(currentActiveHorizon)
      ) {
        currentActiveHorizon = fixedHorizons[fixedHorizons.length - 1];
      }

      const hIdx = fixedHorizons.indexOf(currentActiveHorizon);
      slider.min = "0";
      slider.max = String(Math.max(0, fixedHorizons.length - 1));
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

    // Active horizon breakdown readout
    readoutDiv.replaceChildren();
    const activeDataRow =
      fixedHorizonRows.find((r) => r.horizon === currentActiveHorizon) ??
      eventTableRows.find((r) => r.horizon === currentActiveHorizon);

    if (activeDataRow) {
      const readoutCard = document.createElement("div");
      readoutCard.className = "rtichoke-outcome-distribution__readout-card";

      const readoutHeader = document.createElement("div");
      readoutHeader.className = "rtichoke-outcome-distribution__readout-header";
      readoutHeader.textContent = `Active Horizon: Time = ${activeDataRow.horizon.toFixed(digits)}`;
      readoutCard.append(readoutHeader);

      const readoutTable = document.createElement("table");
      readoutTable.className = "rtichoke-outcome-distribution__readout-table";

      const rHead = document.createElement("thead");
      const rHeadRow = document.createElement("tr");

      const thOutcome = document.createElement("th");
      thOutcome.textContent = "Outcome";

      const thShare = document.createElement("th");
      thShare.textContent = "Share & Count";

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
        const stateColor = getStateColor(st.stateId, st.label);
        badge.style.backgroundColor = stateColor;
        tdLabel.append(badge, document.createTextNode(st.label));

        const tdShare = document.createElement("td");
        tdShare.className = "rtichoke-outcome-distribution__readout-cell";

        // Dynamic in-cell bar representing percentage/share (0% to 100%) using row state color
        const barContainer = document.createElement("div");
        barContainer.className = "rtichoke-performance-table__bar";

        const barFill = document.createElement("div");
        barFill.className = "rtichoke-performance-table__bar-fill";
        barFill.style.backgroundColor = stateColor;
        barFill.style.opacity = "0.25";
        const widthPct = Math.min(Math.max(st.percentage, 0), 100);
        barFill.style.width = `${widthPct}%`;
        barContainer.append(barFill);

        const contentSpan = document.createElement("span");
        contentSpan.className = "rtichoke-performance-table__cell-text";

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

        tdShare.append(barContainer, contentSpan);
        tr.append(tdLabel, tdShare);
        rBody.append(tr);
      }

      readoutTable.append(rBody);
      readoutCard.append(readoutTable);
      readoutDiv.append(readoutCard);
    }

    // Build Legend
    legendDiv.replaceChildren();
    legendDiv.style.display = "flex";

    const legendTitle = document.createElement("span");
    legendTitle.style.fontWeight = "600";
    legendTitle.style.marginRight = "0.5rem";
    legendTitle.textContent = "Outcome:";
    legendDiv.append(legendTitle);

    // Get all unique state labels present across active rows
    const allStatesMap = new Map<string, { stateId: string; label: string }>();
    const rowsToScan = isTrajectoryMode ? eventTableRows : fixedHorizonRows;
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
      lineSpan.style.backgroundColor = getStateColor(st.stateId, st.label);
      lineSpan.style.height = "10px";
      lineSpan.style.borderRadius = "2px";
      swatch.append(lineSpan);

      const labelSpan = document.createElement("span");
      labelSpan.className = "rtichoke-legend-label";
      labelSpan.textContent = st.label;

      item.append(swatch, labelSpan);
      legendDiv.append(item);
    }

    // Chart Marks
    const marks: Plot.Markish[] = [];

    if (isTrajectoryMode) {
      // 1. Stacked Step-Area Trajectory Plot
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
          const color = getStateColor(st.stateId, st.label);
          const tipText = buildOutcomeTooltip(
            row.horizon,
            st,
            row.totalCount,
            row.totalMass,
            digits,
            true,
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

      marks.push(
        Plot.areaY(
          plotData,
          Plot.stackY({
            x: "horizon",
            y: "percentage",
            fill: (d) => d.color,
            fillOpacity: 0.85,
            stroke: theme.axis.color,
            strokeWidth: 0.5,
            curve: "step-after",
            title: (d) => d.title,
          }),
        ),
      );

      // Draw vertical marker lines at fixed horizons
      for (const fh of fixedHorizons) {
        const isSelected = fh === currentActiveHorizon;
        marks.push(
          Plot.ruleX([fh], {
            stroke: isSelected ? "#2563eb" : theme.axis.color,
            strokeWidth: isSelected ? 2.5 : 1,
            strokeDasharray: isSelected ? undefined : "3,3",
          }),
        );

        if (isSelected) {
          marks.push(
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
                fill: "#2563eb",
                fontSize: 11,
                fontWeight: 700,
              },
            ),
          );
        }
      }
    } else {
      // 2. Fixed Horizon Fallback Stacked Bar Chart
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
          const color = getStateColor(st.stateId, st.label);
          const tipText = buildOutcomeTooltip(
            row.horizon,
            st,
            row.totalCount,
            row.totalMass,
            digits,
            false,
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

      marks.push(
        Plot.barY(
          plotData,
          Plot.stackY({
            x: "horizonLabel",
            y: "percentage",
            fill: (d) => d.color,
            fillOpacity: 0.88,
            stroke: theme.axis.color,
            strokeWidth: 0.75,
            title: (d) => d.title,
          }),
        ),
      );
    }

    const plotSpec = {
      width: theme.width,
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
      x: isTrajectoryMode
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
        label: "Share (%)",
        domain: [0, 100],
        grid: false,
        line: true,
        ticks: 5,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
        tickFormat: (d: number) => `${d}%`,
      },
      marks,
    };

    const chartSvg = themedPlot(plotSpec, theme);
    chartDiv.replaceChildren(chartSvg);
  };

  slider.addEventListener("input", () => {
    const evalDists = spec.stateDistributions.filter(
      (d) => d.evaluationId === currentEvalId,
    );

    const fixedHorizons = Array.from(
      new Set(
        evalDists
          .filter((d) => d.estimateOrigin === "fixed_time_horizon")
          .map((d) => d.horizon ?? 0),
      ),
    ).sort((a, b) => a - b);

    const idx = Number(slider.value);
    if (idx >= 0 && idx < fixedHorizons.length) {
      currentActiveHorizon = fixedHorizons[idx];
      updateChart();
    }
  });

  updateChart();
  return container;
}
