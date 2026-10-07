import * as Plot from "@observablehq/plot";
import type { OutcomeDistributionSpec } from "../spec/v2/outcome-distribution.js";
import type { OutcomeState, StateDistribution } from "../spec/v2/state-distribution.js";
import { assertOutcomeDistributionReferentialIntegrity } from "../spec/v2/validate-outcome-distribution.js";
import {
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type V2RenderOptions,
} from "./v2.js";

let outcomeDistributionInstanceCounter = 0;
let outcomeDistributionSliderCounter = 0;

/** Default friendly labels for common internal state IDs */
const DEFAULT_STATE_LABELS: Record<string, string> = {
  real_positive: "Target event",
  target_event: "Target event",
  real_competing: "Competing outcome",
  competing_outcome: "Competing outcome",
  real_negative: "No target event",
  no_target_event: "No target event",
  real_censored: "Unknown / excluded",
  unknown: "Unknown / excluded",
};

/** Palette for outcome states */
const STATE_COLOR_PALETTE = [
  "#1b9e77", // Target event / green-teal
  "#d95f02", // Competing outcome / orange
  "#7570b3", // No target event / purple
  "#e7298a", // Secondary accent / pink
  "#66a61e", // Olive
  "#e6ab02", // Gold / yellow
  "#a6761d", // Brown
  "#666666", // Grey
];

/** Preferred colors for common state IDs */
const PREFERRED_STATE_COLORS: Record<string, string> = {
  real_positive: "#1b9e77",
  target_event: "#1b9e77",
  real_competing: "#d95f02",
  competing_outcome: "#d95f02",
  real_negative: "#7570b3",
  no_target_event: "#7570b3",
  real_censored: "#94a3b8",
  unknown: "#cbd5e1",
};

function friendlyCensoringLabel(val?: string | null): string {
  if (!val) return "";
  const map: Record<string, string> = {
    adjusted: "Adjusted",
    excluded: "Excluded",
  };
  return map[val] ?? val.replace(/_/g, " ");
}

function friendlyCompetingLabel(val?: string | null): string {
  if (!val) return "";
  const map: Record<string, string> = {
    as_negative: "As negative",
    as_censored: "As censored",
    as_composite: "As composite",
    excluded: "Excluded",
  };
  return map[val] ?? val.replace(/_/g, " ");
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
    const label = s.label ?? DEFAULT_STATE_LABELS[s.stateId] ?? s.stateId;
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

  // State Variables
  let currentCensoringHeuristic: string | undefined = undefined;
  let currentCompetingHeuristic: string | undefined = undefined;
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
            currentCensoringHeuristic = undefined;
            currentCompetingHeuristic = undefined;
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
      // Empty state
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

    // 2. Heuristics handling
    const heuristicPairs = new Map<
      string,
      { censoring?: string; competing?: string }
    >();

    for (const d of evalDists) {
      const key = `${d.censoringHeuristic ?? ""}|${d.competingHeuristic ?? ""}`;
      if (!heuristicPairs.has(key)) {
        heuristicPairs.set(key, {
          censoring: d.censoringHeuristic,
          competing: d.competingHeuristic,
        });
      }
    }

    const uniqueHeuristicCombinations = Array.from(heuristicPairs.values());

    if (uniqueHeuristicCombinations.length > 1) {
      // Multiple combinations exist -> render controls
      const censSet = new Set<string>();
      const compSet = new Set<string>();

      for (const comb of uniqueHeuristicCombinations) {
        if (comb.censoring) censSet.add(comb.censoring);
        if (comb.competing) compSet.add(comb.competing);
      }

      // Initialize default selections if needed
      if (
        !currentCensoringHeuristic ||
        !censSet.has(currentCensoringHeuristic)
      ) {
        currentCensoringHeuristic = Array.from(censSet)[0];
      }
      if (
        !currentCompetingHeuristic ||
        !compSet.has(currentCompetingHeuristic)
      ) {
        currentCompetingHeuristic = Array.from(compSet)[0];
      }

      // Censoring Heuristic Control
      if (censSet.size > 1) {
        const censGroup = document.createElement("div");
        censGroup.className = "rtichoke-pd-radio-group";
        censGroup.setAttribute("role", "radiogroup");
        censGroup.setAttribute("aria-label", "Censoring Heuristic");

        const censLabel = document.createElement("span");
        censLabel.className = "rtichoke-pd-radio-group-label";
        censLabel.textContent = "Censoring:";
        censGroup.append(censLabel);

        const censOptions = document.createElement("div");
        censOptions.className = "rtichoke-pd-radio-options";

        for (const censVal of censSet) {
          const optionLabel = document.createElement("label");
          optionLabel.className = "rtichoke-pd-radio-option";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = `od-cens-${instanceId}`;
          radio.value = censVal;
          radio.checked = censVal === currentCensoringHeuristic;

          radio.addEventListener("change", () => {
            if (radio.checked) {
              currentCensoringHeuristic = censVal;
              updateChart();
            }
          });

          const span = document.createElement("span");
          span.textContent = friendlyCensoringLabel(censVal);

          optionLabel.append(radio, span);
          censOptions.append(optionLabel);
        }

        censGroup.append(censOptions);
        controlsDiv.append(censGroup);
      }

      // Competing Heuristic Control
      if (compSet.size > 1) {
        const compGroup = document.createElement("div");
        compGroup.className = "rtichoke-pd-radio-group";
        compGroup.setAttribute("role", "radiogroup");
        compGroup.setAttribute("aria-label", "Competing Heuristic");

        const compLabel = document.createElement("span");
        compLabel.className = "rtichoke-pd-radio-group-label";
        compLabel.textContent = "Competing:";
        compGroup.append(compLabel);

        const compOptions = document.createElement("div");
        compOptions.className = "rtichoke-pd-radio-options";

        for (const compVal of compSet) {
          const optionLabel = document.createElement("label");
          optionLabel.className = "rtichoke-pd-radio-option";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = `od-comp-${instanceId}`;
          radio.value = compVal;
          radio.checked = compVal === currentCompetingHeuristic;

          radio.addEventListener("change", () => {
            if (radio.checked) {
              currentCompetingHeuristic = compVal;
              updateChart();
            }
          });

          const span = document.createElement("span");
          span.textContent = friendlyCompetingLabel(compVal);

          optionLabel.append(radio, span);
          compOptions.append(optionLabel);
        }

        compGroup.append(compOptions);
        controlsDiv.append(compGroup);
      }
    } else if (uniqueHeuristicCombinations.length === 1) {
      currentCensoringHeuristic = uniqueHeuristicCombinations[0].censoring;
      currentCompetingHeuristic = uniqueHeuristicCombinations[0].competing;
    }

    // Filter distributions matching active heuristics
    const activeDists = evalDists.filter((d) => {
      if (
        currentCensoringHeuristic &&
        d.censoringHeuristic &&
        d.censoringHeuristic !== currentCensoringHeuristic
      ) {
        return false;
      }
      if (
        currentCompetingHeuristic &&
        d.competingHeuristic &&
        d.competingHeuristic !== currentCompetingHeuristic
      ) {
        return false;
      }
      return true;
    });

    const eventTableRows = activeDists
      .filter((d) => d.estimateOrigin === "event_table")
      .map(processStateDistribution)
      .sort((a, b) => a.horizon - b.horizon);

    const fixedHorizonRows = activeDists
      .filter((d) => d.estimateOrigin === "fixed_time_horizon")
      .map(processStateDistribution)
      .sort((a, b) => a.horizon - b.horizon);

    // Extract available fixed horizon time points
    const fixedHorizons = Array.from(
      new Set(fixedHorizonRows.map((r) => r.horizon)),
    ).sort((a, b) => a - b);

    if (eventTableRows.length === 0 && fixedHorizonRows.length === 0) {
      // Empty state
      sliderControl.style.display = "none";
      legendDiv.style.display = "none";
      readoutDiv.replaceChildren();
      chartDiv.replaceChildren();
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "rtichoke-outcome-distribution__empty";
      emptyMsg.textContent = "No outcome distribution data found for current selection.";
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
        currentActiveHorizon = fixedHorizons[fixedHorizons.length - 1]; // default to last or first
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
      const thPct = document.createElement("th");
      thPct.textContent = "Percentage";
      rHeadRow.append(thOutcome, thPct);

      let countHeaderLabel: string | null = null;
      if (activeDataRow.totalMass !== null) {
        countHeaderLabel = "Estimated count";
      } else if (activeDataRow.totalCount !== null) {
        countHeaderLabel = "Count";
      }

      if (countHeaderLabel) {
        const thCount = document.createElement("th");
        thCount.textContent = countHeaderLabel;
        rHeadRow.append(thCount);
      }

      rHead.append(rHeadRow);
      readoutTable.append(rHead);

      const rBody = document.createElement("tbody");
      for (const st of activeDataRow.states) {
        const tr = document.createElement("tr");

        const tdLabel = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "rtichoke-performance-table__badge";
        badge.style.backgroundColor = getStateColor(st.stateId, st.label);
        tdLabel.append(badge, document.createTextNode(st.label));

        const tdPct = document.createElement("td");
        tdPct.style.textAlign = "right";
        tdPct.textContent = `${st.percentage.toFixed(1)}%`;

        tr.append(tdLabel, tdPct);

        if (countHeaderLabel) {
          const tdCount = document.createElement("td");
          tdCount.style.textAlign = "right";
          let cntVal = "—";
          if (st.mass !== null) {
            cntVal = st.mass.toLocaleString();
          } else if (st.count !== null) {
            cntVal = st.count.toLocaleString();
          }
          tdCount.textContent = cntVal;
          tr.append(tdCount);
        }

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
          const countInfo =
            st.mass !== null
              ? `Estimated count: ${st.mass}`
              : st.count !== null
                ? `Count: ${st.count}`
                : "";
          const tipText = tooltip(digits, [
            ["Time", row.horizon],
            ["Outcome", st.label],
            ["Percentage", `${st.percentage.toFixed(1)}%`],
            ...(countInfo ? [countInfo.split(": ") as [string, any]] : []),
          ]);

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
            tip: true,
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
          const countInfo =
            st.mass !== null
              ? `Estimated count: ${st.mass}`
              : st.count !== null
                ? `Count: ${st.count}`
                : "";
          const tipText = tooltip(digits, [
            ["Time", row.horizon],
            ["Outcome", st.label],
            ["Percentage", `${st.percentage.toFixed(1)}%`],
            ...(countInfo ? [countInfo.split(": ") as [string, any]] : []),
          ]);

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
            tip: true,
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
        label: "Percentage",
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
    const activeDists = evalDists.filter((d) => {
      if (
        currentCensoringHeuristic &&
        d.censoringHeuristic &&
        d.censoringHeuristic !== currentCensoringHeuristic
      ) {
        return false;
      }
      if (
        currentCompetingHeuristic &&
        d.competingHeuristic &&
        d.competingHeuristic !== currentCompetingHeuristic
      ) {
        return false;
      }
      return true;
    });

    const fixedHorizons = Array.from(
      new Set(
        activeDists
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
