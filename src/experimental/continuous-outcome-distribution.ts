import * as Plot from "@observablehq/plot";
import { resolveV2RenderOptions, themedPlot, tooltip, type V2RenderOptions } from "../render/v2.js";
import { generateSyntheticContinuousDataset, type SyntheticDataset } from "./synthetic-data.js";

export type ContinuousScenario = "A" | "B";
export type BinCount = 20 | 40;

export interface ContinuousOutcomeDistributionOptions extends V2RenderOptions {
  initialScenario?: ContinuousScenario;
  initialNumBins?: BinCount;
  dataset?: SyntheticDataset;
}

let continuousInstanceCounter = 0;
let continuousSliderCounter = 0;

export interface BinDefinition {
  index: number;
  lower: number;
  upper: number;
  label: string;
}

export function createBinDefinitions(numBins: BinCount): BinDefinition[] {
  const binWidth = 1.0 / numBins;
  const bins: BinDefinition[] = [];
  for (let i = 0; i < numBins; i++) {
    const lower = i * binWidth;
    const upper = (i + 1) * binWidth;
    bins.push({
      index: i,
      lower,
      upper,
      label: i === 0 ? `0.00–${upper.toFixed(2)}` : `${lower.toFixed(2)}–${upper.toFixed(2)}`,
    });
  }
  return bins;
}

export interface CellDatum {
  step: number;
  binIndex: number;
  binLower: number;
  binUpper: number;
  binLabel: string;
  count: number;
  includedCount: number;
  proportion: number;
  percentage: number;
}

export interface ContinuousStepSummary {
  step: number;
  includedCount: number;
  excludedCount: number;
  excludedProportion: number;
  excludedPercentage: number;
  cells: CellDatum[];
}

/**
 * Calculate binned statistics for a given scenario ("A" or "B") and dataset.
 */
export function computeScenarioStats(
  dataset: SyntheticDataset,
  scenario: ContinuousScenario,
  numBins: BinCount,
): ContinuousStepSummary[] {
  const bins = createBinDefinitions(numBins);
  const binWidth = 1.0 / numBins;
  const totalN = dataset.nSubjects;
  const summaries: ContinuousStepSummary[] = [];

  for (let s = 0; s < dataset.numSteps; s++) {
    // Determine included subjects at step s
    const included = dataset.subjects.filter((sub) => {
      if (scenario === "A") return true;
      return sub.censoringStep >= s;
    });

    const includedCount = included.length;
    const excludedCount = totalN - includedCount;
    const excludedProportion = excludedCount / totalN;
    const excludedPercentage = excludedProportion * 100;

    const binCounts = new Array<number>(numBins).fill(0);

    for (const sub of included) {
      const val = sub.outcomes[s];
      // Values exactly equal to 0 belong to bin 0, 1 belongs to last bin
      let bIdx = Math.floor(val / binWidth);
      if (bIdx >= numBins) bIdx = numBins - 1;
      if (bIdx < 0) bIdx = 0;
      binCounts[bIdx]++;
    }

    const cells: CellDatum[] = bins.map((b, idx) => {
      const count = binCounts[idx];
      const proportion = includedCount > 0 ? count / includedCount : 0;
      return {
        step: s,
        binIndex: idx,
        binLower: b.lower,
        binUpper: b.upper,
        binLabel: b.label,
        count,
        includedCount,
        proportion,
        percentage: proportion * 100,
      };
    });

    summaries.push({
      step: s,
      includedCount,
      excludedCount,
      excludedProportion,
      excludedPercentage,
      cells,
    });
  }

  return summaries;
}

/**
 * Compute the joint maximum bin proportion across Scenario A and Scenario B
 * for a specific bin count (20 or 40), and round up to a readable upper limit percentage.
 */
export function computeJointMaxProportion(
  dataset: SyntheticDataset,
  numBins: BinCount,
): number {
  const statsA = computeScenarioStats(dataset, "A", numBins);
  const statsB = computeScenarioStats(dataset, "B", numBins);

  let maxProp = 0;
  for (const step of statsA) {
    for (const cell of step.cells) {
      if (cell.proportion > maxProp) maxProp = cell.proportion;
    }
  }
  for (const step of statsB) {
    for (const cell of step.cells) {
      if (cell.proportion > maxProp) maxProp = cell.proportion;
    }
  }

  // Round up to nice percentage bound (e.g., 0.18 -> 0.20, 0.23 -> 0.25)
  const pct = maxProp * 100;
  const roundedPct = Math.ceil(pct / 5) * 5;
  return Math.max(5, Math.min(100, roundedPct)) / 100;
}

export function renderContinuousOutcomeDistributionPOC(
  options: ContinuousOutcomeDistributionOptions = {},
): HTMLElement {
  const instanceId = ++continuousInstanceCounter;
  const resolved = resolveV2RenderOptions(2, options);
  const { theme } = resolved;
  const digits = theme.tip.digits;

  const dataset = options.dataset ?? generateSyntheticContinuousDataset();

  // State
  let activeScenario: ContinuousScenario = options.initialScenario ?? "A";
  let activeNumBins: BinCount = options.initialNumBins ?? 20;
  let selectedStep = 35; // default to step 35
  let isHistogramOpen = true; // Always open / visible
  let isExcludedExpanded = true; // Expanded by default to clearly show censored subjects in Scenario B

  // Root container
  const container = document.createElement("div");
  container.className = "rtichoke-outcome-distribution rtichoke-continuous-poc";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Title
  const titleEl = document.createElement("h3");
  titleEl.className = "rtichoke-outcome-distribution__title";
  titleEl.textContent = "Continuous Outcome Distribution (Experimental POC)";
  container.append(titleEl);

  // Subtitle / Description
  const descEl = document.createElement("p");
  descEl.style.margin = "0 0 1rem 0";
  descEl.style.fontSize = "13px";
  descEl.style.color = "#4b5563";
  descEl.textContent =
    "Longitudinal empirical distribution heatmap of observed numerical outcomes across 36 steps (0–35), with side-by-side step histogram detail.";
  container.append(descEl);

  // Controls bar (Scenario A/B radio, 20/40 Bins radio)
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-outcome-distribution__controls";
  controlsDiv.style.display = "flex";
  controlsDiv.style.flexWrap = "wrap";
  controlsDiv.style.gap = "1.5rem";
  controlsDiv.style.marginBottom = "1rem";
  container.append(controlsDiv);

  // Layout wrapper for Heatmap + Histogram side-by-side
  const mainLayoutDiv = document.createElement("div");
  mainLayoutDiv.className = "rtichoke-continuous-main-layout";
  mainLayoutDiv.style.display = "flex";
  mainLayoutDiv.style.flexDirection = "row";
  mainLayoutDiv.style.flexWrap = "nowrap";
  mainLayoutDiv.style.gap = "1rem";
  mainLayoutDiv.style.alignItems = "flex-start";
  container.append(mainLayoutDiv);

  const heatmapWrapper = document.createElement("div");
  heatmapWrapper.className = "rtichoke-continuous-heatmap-wrapper";
  heatmapWrapper.style.flex = "0 0 58%";

  const histogramWrapper = document.createElement("div");
  histogramWrapper.className = "rtichoke-continuous-histogram-wrapper";
  histogramWrapper.style.flex = "0 0 38%";

  mainLayoutDiv.append(heatmapWrapper, histogramWrapper);

  // Slider control container below main charts
  const sliderControl = document.createElement("div");
  sliderControl.className = "rtichoke-operating-point-control";
  sliderControl.style.marginLeft = `${theme.margins.left}px`;
  sliderControl.style.marginRight = `${theme.margins.right}px`;
  sliderControl.style.marginTop = "0.75rem";

  const sliderId = `rtichoke-cod-slider-${++continuousSliderCounter}`;
  const sliderLabel = document.createElement("label");
  sliderLabel.className = "rtichoke-operating-point-label";
  sliderLabel.htmlFor = sliderId;

  const sliderLabelText = document.createElement("span");
  sliderLabelText.textContent = "Step: ";
  const sliderValueText = document.createElement("span");
  sliderValueText.className = "rtichoke-operating-point-value";
  sliderValueText.textContent = String(selectedStep);
  sliderLabel.append(sliderLabelText, sliderValueText);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = sliderId;
  slider.className = "rtichoke-operating-point-slider";
  slider.min = "0";
  slider.max = "35";
  slider.step = "1";
  slider.value = String(selectedStep);
  slider.setAttribute("aria-label", "Step");

  sliderControl.append(sliderLabel, slider);
  container.append(sliderControl);

  // Legend Area for continuous color scale
  const legendDiv = document.createElement("div");
  legendDiv.className = "rtichoke-continuous-legend";
  legendDiv.style.display = "flex";
  legendDiv.style.alignItems = "center";
  legendDiv.style.gap = "0.75rem";
  legendDiv.style.marginLeft = `${theme.margins.left}px`;
  legendDiv.style.marginTop = "0.5rem";
  legendDiv.style.marginBottom = "0.75rem";
  container.append(legendDiv);

  // Excluded summary readout and expandable panel container
  const excludedSection = document.createElement("div");
  excludedSection.className = "rtichoke-continuous-excluded-section";
  excludedSection.style.marginTop = "1rem";
  excludedSection.style.padding = "0.75rem 1rem";
  excludedSection.style.backgroundColor = "#f9fafb";
  excludedSection.style.border = "1px solid #e5e7eb";
  excludedSection.style.borderRadius = "6px";
  container.append(excludedSection);

  // Master Render / Update function
  const renderAll = () => {
    // 1. Compute Stats for active scenario and joint upper limit
    const scenarioStats = computeScenarioStats(dataset, activeScenario, activeNumBins);
    const jointUpperProp = computeJointMaxProportion(dataset, activeNumBins);
    const currentStepSummary = scenarioStats.find((s) => s.step === selectedStep) ?? scenarioStats[35];

    // 2. Render Controls (Scenario A/B, 20/40 Bins)
    controlsDiv.replaceChildren();

    // Scenario Control
    const scenarioGroup = document.createElement("div");
    scenarioGroup.className = "rtichoke-pd-radio-group";
    scenarioGroup.setAttribute("role", "radiogroup");
    scenarioGroup.setAttribute("aria-label", "Scenario");

    const scenarioGroupLabel = document.createElement("span");
    scenarioGroupLabel.className = "rtichoke-pd-radio-group-label";
    scenarioGroupLabel.textContent = "Demonstration Scenario:";
    scenarioGroup.append(scenarioGroupLabel);

    const scenarioOptions = document.createElement("div");
    scenarioOptions.className = "rtichoke-pd-radio-options";

    const scenarioItems: { id: ContinuousScenario; label: string }[] = [
      { id: "A", label: "Scenario A (Complete follow-up, N=600)" },
      { id: "B", label: "Scenario B (Right-censored follow-up, N=600 → 390)" },
    ];

    for (const item of scenarioItems) {
      const optLabel = document.createElement("label");
      optLabel.className = "rtichoke-pd-radio-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `cod-scenario-${instanceId}`;
      radio.value = item.id;
      radio.checked = activeScenario === item.id;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          activeScenario = item.id;
          renderAll();
        }
      });

      const span = document.createElement("span");
      span.textContent = item.label;
      optLabel.append(radio, span);
      scenarioOptions.append(optLabel);
    }
    scenarioGroup.append(scenarioOptions);
    controlsDiv.append(scenarioGroup);

    // Bin Width Control
    const binGroup = document.createElement("div");
    binGroup.className = "rtichoke-pd-radio-group";
    binGroup.setAttribute("role", "radiogroup");
    binGroup.setAttribute("aria-label", "Bin Resolution");

    const binGroupLabel = document.createElement("span");
    binGroupLabel.className = "rtichoke-pd-radio-group-label";
    binGroupLabel.textContent = "Bin Resolution:";
    binGroup.append(binGroupLabel);

    const binOptions = document.createElement("div");
    binOptions.className = "rtichoke-pd-radio-options";

    const binItems: { num: BinCount; label: string }[] = [
      { num: 20, label: "20 Bins (width 0.05)" },
      { num: 40, label: "40 Bins (width 0.025)" },
    ];

    for (const item of binItems) {
      const optLabel = document.createElement("label");
      optLabel.className = "rtichoke-pd-radio-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `cod-bins-${instanceId}`;
      radio.value = String(item.num);
      radio.checked = activeNumBins === item.num;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          activeNumBins = item.num;
          renderAll();
        }
      });

      const span = document.createElement("span");
      span.textContent = item.label;
      optLabel.append(radio, span);
      binOptions.append(optLabel);
    }
    binGroup.append(binOptions);
    controlsDiv.append(binGroup);

    // 3. Render Main Heatmap
    heatmapWrapper.replaceChildren();

    // Flatten cells for Plot.rect
    const flatCells: Array<CellDatum & { opacity: number; tooltipTitle: string }> = [];
    for (const stepSum of scenarioStats) {
      const isPastSelected = stepSum.step > selectedStep;
      const opacity = isPastSelected ? 0.28 : 0.88;

      for (const cell of stepSum.cells) {
        const tipText = tooltip(digits, [
          ["Step", cell.step],
          ["Reals", cell.binLabel],
          ["Included count", cell.includedCount],
          ["Bin count", cell.count],
          ["Bin proportion", `${cell.percentage.toFixed(1)}%`],
        ]);

        flatCells.push({
          ...cell,
          opacity,
          tooltipTitle: tipText,
        });
      }
    }

    // Fixed, stable width for heatmap based on available layout space
    const heatmapWidth = Math.round((theme.width - 20) * 0.58);

    // Heatmap marks
    const heatmapMarks: Plot.Markish[] = [
      Plot.rect(flatCells, {
        x1: (d) => d.step - 0.5,
        x2: (d) => d.step + 0.5,
        y1: (d) => d.binLower,
        y2: (d) => d.binUpper,
        fill: (d) => d.proportion,
        fillOpacity: (d) => d.opacity,
        stroke: "#ffffff",
        strokeWidth: activeNumBins === 40 ? 0.2 : 0.4,
        title: (d) => d.tooltipTitle,
      }),
    ];

    // Selected step rectangular outline around the entire column
    heatmapMarks.push(
      Plot.rect(
        [
          {
            x1: selectedStep - 0.5,
            x2: selectedStep + 0.5,
            y1: 0,
            y2: 1.0,
          },
        ],
        {
          x1: "x1",
          x2: "x2",
          y1: "y1",
          y2: "y2",
          fill: "none",
          stroke: theme.axis.color,
          strokeWidth: 2.5,
        },
      ),
    );

    const heatmapPlot = themedPlot(
      {
        width: heatmapWidth,
        height: Math.round(theme.height * 0.65),
        marginTop: theme.margins.top + 10,
        marginRight: theme.margins.right,
        marginBottom: theme.margins.bottom,
        marginLeft: theme.margins.left + 5,
        style: {
          background: theme.background,
          color: theme.axis.color,
          fontFamily: theme.typography.fontFamily,
          fontSize: `${theme.typography.fontSize}px`,
        },
        x: {
          label: "Step",
          domain: [-0.5, 35.5],
          ticks: [0, 5, 10, 15, 20, 25, 30, 35],
          tickFormat: (d: number) => String(Math.round(d)),
          grid: false,
          line: true,
        },
        y: {
          label: "Reals (Outcome Value)",
          domain: [0, 1.0],
          ticks: 5,
          tickFormat: (d: number) => d.toFixed(2),
          grid: false,
          line: true,
        },
        color: {
          type: "linear",
          scheme: "Blues",
          domain: [0, jointUpperProp],
          clamp: true,
        },
        marks: heatmapMarks,
      },
      theme,
    );

    // Make heatmap step columns interactive (click to select step)
    const svgEl = heatmapPlot as unknown as SVGSVGElement;
    svgEl.style.cursor = "pointer";
    svgEl.addEventListener("click", (evt) => {
      let node: HTMLElement | null = evt.target as HTMLElement;
      while (node && node !== (svgEl as unknown as HTMLElement)) {
        const titleEl = node.querySelector("title");
        const titleText = titleEl ? titleEl.textContent : node.getAttribute("title");
        if (titleText) {
          const match = titleText.match(/Step:\s*(\d+)/);
          if (match) {
            const clickedStep = parseInt(match[1], 10);
            selectedStep = clickedStep;
            slider.value = String(selectedStep);
            sliderValueText.textContent = String(selectedStep);
            renderAll();
            return;
          }
        }
        node = node.parentElement;
      }
    });

    heatmapWrapper.append(heatmapPlot);

    // 4. Render Side-by-Side Histogram (Permanently Visible)
    histogramWrapper.replaceChildren();
    histogramWrapper.style.display = "block";

    const histHeader = document.createElement("div");
    histHeader.style.display = "flex";
    histHeader.style.justifyContent = "space-between";
    histHeader.style.alignItems = "center";
    histHeader.style.marginBottom = "0.5rem";
    histHeader.style.paddingBottom = "0.25rem";
    histHeader.style.borderBottom = "1px solid #e5e7eb";

    const histTitle = document.createElement("div");
    histTitle.style.fontWeight = "600";
    histTitle.style.fontSize = "13px";
    histTitle.style.color = "#1f2937";
    histTitle.textContent = `Step ${selectedStep} Detail (n = ${currentStepSummary.includedCount})`;

    histHeader.append(histTitle);

    const histData = currentStepSummary.cells.map((c) => ({
      ...c,
      title: tooltip(digits, [
        ["Step", c.step],
        ["Reals", c.binLabel],
        ["Count", `${c.count} / ${c.includedCount}`],
        ["Proportion", `${c.percentage.toFixed(1)}%`],
      ]),
    }));

    const histWidth = Math.round((theme.width - 20) * 0.38);

    const histPlot = themedPlot(
      {
        width: histWidth,
        height: Math.round(theme.height * 0.65) - 25,
        marginTop: theme.margins.top + 10,
        marginRight: 15,
        marginBottom: theme.margins.bottom,
        marginLeft: 45,
        style: {
          background: theme.background,
          color: theme.axis.color,
          fontFamily: theme.typography.fontFamily,
          fontSize: `${theme.typography.fontSize}px`,
        },
        x: {
          label: "Reals (Outcome Value)",
          domain: [0, 1.0],
          ticks: 5,
          tickFormat: (d: number) => d.toFixed(2),
          grid: false,
          line: true,
        },
        y: {
          label: "Proportion (%)",
          domain: [0, jointUpperProp * 100],
          ticks: 5,
          tickFormat: (d: number) => `${d}%`,
          grid: true,
          line: true,
        },
        marks: [
          Plot.rectY(histData, {
            x1: "binLower",
            x2: "binUpper",
            y: "percentage",
            fill: "#2477BB",
            fillOpacity: 0.85,
            stroke: "#ffffff",
            strokeWidth: 0.5,
            title: (d) => d.title,
          }),
        ],
      },
      theme,
    );

    histogramWrapper.append(histHeader, histPlot);

    // 5. Render Color Scale Legend
    legendDiv.replaceChildren();

    const legendLabel = document.createElement("span");
    legendLabel.style.fontSize = "12px";
    legendLabel.style.fontWeight = "600";
    legendLabel.style.color = "#374151";
    legendLabel.textContent = "Bin Proportion:";

    // Swatch gradient bar
    const gradientBar = document.createElement("div");
    gradientBar.style.width = "120px";
    gradientBar.style.height = "12px";
    gradientBar.style.borderRadius = "2px";
    gradientBar.style.border = "1px solid #d1d5db";
    gradientBar.style.background =
      "linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #084594)";

    const legendMinLabel = document.createElement("span");
    legendMinLabel.style.fontSize = "11px";
    legendMinLabel.style.color = "#6b7280";
    legendMinLabel.textContent = "0%";

    const legendMaxLabel = document.createElement("span");
    legendMaxLabel.style.fontSize = "11px";
    legendMaxLabel.style.color = "#6b7280";
    legendMaxLabel.textContent = `${(jointUpperProp * 100).toFixed(0)}%`;

    legendDiv.append(legendLabel, legendMinLabel, gradientBar, legendMaxLabel);

    // 6. Update Slider Text & Listener
    sliderValueText.textContent = String(selectedStep);

    // 7. Render Excluded Observations Summary & Panel
    excludedSection.replaceChildren();

    const excludedHeader = document.createElement("div");
    excludedHeader.style.display = "flex";
    excludedHeader.style.justifyContent = "space-between";
    excludedHeader.style.alignItems = "center";

    const excludedReadout = document.createElement("div");
    excludedReadout.style.fontSize = "13px";
    excludedReadout.style.fontWeight = "600";
    excludedReadout.style.color = "#1f2937";

    if (activeScenario === "A" || currentStepSummary.excludedCount === 0) {
      excludedReadout.textContent = `Excluded at step ${selectedStep}: 0 / ${dataset.nSubjects} (0.0%)`;
    } else {
      excludedReadout.textContent = `Excluded at step ${selectedStep}: ${currentStepSummary.excludedCount} / ${dataset.nSubjects} (${currentStepSummary.excludedPercentage.toFixed(1)}%)`;
    }

    const toggleExcludedBtn = document.createElement("button");
    toggleExcludedBtn.type = "button";
    toggleExcludedBtn.className = "rtichoke-continuous-toggle-excluded";
    toggleExcludedBtn.style.background = "none";
    toggleExcludedBtn.style.border = "1px solid #d1d5db";
    toggleExcludedBtn.style.borderRadius = "4px";
    toggleExcludedBtn.style.padding = "3px 10px";
    toggleExcludedBtn.style.fontSize = "12px";
    toggleExcludedBtn.style.cursor = "pointer";
    toggleExcludedBtn.style.color = "#374151";
    toggleExcludedBtn.textContent = isExcludedExpanded ? "▲ Hide Excluded Chart" : "▼ Show Excluded Chart";

    toggleExcludedBtn.addEventListener("click", () => {
      isExcludedExpanded = !isExcludedExpanded;
      renderAll();
    });

    excludedHeader.append(excludedReadout, toggleExcludedBtn);
    excludedSection.append(excludedHeader);

    if (isExcludedExpanded) {
      const excludedPanel = document.createElement("div");
      excludedPanel.style.marginTop = "1rem";
      excludedPanel.style.paddingTop = "0.75rem";
      excludedPanel.style.borderTop = "1px dashed #d1d5db";

      if (activeScenario === "A") {
        const noExclMsg = document.createElement("p");
        noExclMsg.style.margin = "0.5rem 0 0 0";
        noExclMsg.style.fontSize = "13px";
        noExclMsg.style.color = "#6b7280";
        noExclMsg.style.fontStyle = "italic";
        noExclMsg.textContent = "Scenario A has complete follow-up: zero excluded observations across all 36 steps.";
        excludedPanel.append(noExclMsg);
      } else {
        const exclPlotData = scenarioStats.map((s) => ({
          step: s.step,
          excludedCount: s.excludedCount,
          excludedPercentage: s.excludedPercentage,
          opacity: s.step > selectedStep ? 0.28 : 0.88,
          title: tooltip(digits, [
            ["Step", s.step],
            ["Excluded count", `${s.excludedCount} / ${dataset.nSubjects}`],
            ["Excluded proportion", `${s.excludedPercentage.toFixed(1)}%`],
          ]),
        }));

        const maxExclPct = Math.max(...scenarioStats.map((s) => s.excludedPercentage), 5);

        const exclMarks: Plot.Markish[] = [
          Plot.rectY(exclPlotData, {
            x1: (d) => d.step - 0.5,
            x2: (d) => d.step + 0.5,
            y: "excludedPercentage",
            fill: "#e7298a",
            fillOpacity: (d) => d.opacity,
            stroke: "#ffffff",
            strokeWidth: 0.5,
            title: (d) => d.title,
          }),
          // Selected step column rectangular outline
          Plot.rect(
            [
              {
                x1: selectedStep - 0.5,
                x2: selectedStep + 0.5,
                y1: 0,
                y2: maxExclPct * 1.05,
              },
            ],
            {
              x1: "x1",
              x2: "x2",
              y1: "y1",
              y2: "y2",
              fill: "none",
              stroke: theme.axis.color,
              strokeWidth: 2.5,
            },
          ),
        ];

        const exclPlot = themedPlot(
          {
            width: theme.width - 40,
            height: 160,
            marginTop: 15,
            marginRight: theme.margins.right,
            marginBottom: theme.margins.bottom,
            marginLeft: theme.margins.left + 5,
            style: {
              background: theme.background,
              color: theme.axis.color,
              fontFamily: theme.typography.fontFamily,
              fontSize: `${theme.typography.fontSize}px`,
            },
            x: {
              label: "Step",
              domain: [-0.5, 35.5],
              ticks: [0, 5, 10, 15, 20, 25, 30, 35],
              tickFormat: (d: number) => String(d),
              grid: false,
              line: true,
            },
            y: {
              label: "Excluded (%)",
              domain: [0, maxExclPct * 1.05],
              ticks: 4,
              tickFormat: (d: number) => `${d.toFixed(0)}%`,
              grid: true,
              line: true,
            },
            marks: exclMarks,
          },
          theme,
        );

        excludedPanel.append(exclPlot);
      }

      excludedSection.append(excludedPanel);
    }
  };

  // Slider change listener: updates step and updates histogram IF already open
  slider.addEventListener("input", () => {
    selectedStep = Number(slider.value);
    renderAll();
  });

  renderAll();
  return container;
}
