import * as Plot from "@observablehq/plot";
import type { ContinuousOutcomeDistributionSpec } from "../spec/v2/continuous-outcome-distribution.js";
import { assertContinuousOutcomeDistributionReferentialIntegrity } from "../spec/v2/validate-continuous-outcome-distribution.js";
import {
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type V2RenderOptions,
} from "./v2.js";

let continuousOutcomeDistributionInstanceCounter = 0;
let continuousOutcomeDistributionSliderCounter = 0;

export interface ContinuousOutcomeDistributionOptions extends V2RenderOptions {}

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

function formatBinRange(lower: number, upper: number, digits: number): string {
  return `[${lower.toFixed(digits)}, ${upper.toFixed(digits)}]`;
}

function findStepFromNode(
  node: HTMLElement | null,
  rootSvg: SVGSVGElement,
): number | null {
  let curr: HTMLElement | null = node;
  while (curr && curr !== (rootSvg as unknown as HTMLElement)) {
    const stepAttr = curr.getAttribute("data-step") ?? curr.getAttribute("aria-label");
    if (stepAttr && /^\d+$/.test(stepAttr)) {
      return parseInt(stepAttr, 10);
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Compute the joint maximum bin proportion across all evaluations and steps where observedCount > 0.
 */
function computeJointMaxProportion(
  spec: ContinuousOutcomeDistributionSpec,
): number {
  let maxProp = 0;
  for (const dist of spec.distributions) {
    if (dist.observedCount > 0) {
      for (const count of dist.binCounts) {
        const prop = count / dist.observedCount;
        if (prop > maxProp) {
          maxProp = prop;
        }
      }
    }
  }
  if (maxProp === 0) return 0.1; // Default fallback if all observedCounts are 0
  const pct = maxProp * 100;
  const roundedPct = Math.ceil(pct / 5) * 5;
  return Math.max(5, Math.min(100, roundedPct)) / 100;
}

export function renderContinuousOutcomeDistribution(
  spec: ContinuousOutcomeDistributionSpec,
  options: ContinuousOutcomeDistributionOptions = {},
): HTMLElement {
  assertContinuousOutcomeDistributionReferentialIntegrity(spec);

  const instanceId = ++continuousOutcomeDistributionInstanceCounter;
  const resolved = resolveV2RenderOptions(2, options);
  const { theme } = resolved;
  const digits = theme.tip.digits;

  // Root container
  const container = document.createElement("div");
  container.className = "rtichoke-outcome-distribution rtichoke-continuous-outcome-distribution";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Title
  if (spec.title) {
    const titleEl = document.createElement("h3");
    titleEl.className = "rtichoke-outcome-distribution__title";
    titleEl.textContent = spec.title;
    container.append(titleEl);
  }

  // Controls bar (Evaluation radio selector)
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-outcome-distribution__controls";
  controlsDiv.style.display = "flex";
  controlsDiv.style.flexWrap = "wrap";
  controlsDiv.style.alignItems = "center";
  controlsDiv.style.gap = "1.5rem";
  controlsDiv.style.marginBottom = "0.75rem";
  container.append(controlsDiv);

  // Main vertical layout structure
  const mainLayoutDiv = document.createElement("div");
  mainLayoutDiv.className = "rtichoke-continuous-main-layout";
  mainLayoutDiv.style.display = "flex";
  mainLayoutDiv.style.flexDirection = "column";
  mainLayoutDiv.style.gap = "0.75rem";
  container.append(mainLayoutDiv);

  const heatmapWrapper = document.createElement("div");
  heatmapWrapper.className = "rtichoke-continuous-heatmap-wrapper";

  // Legend Area for continuous color scale
  const legendDiv = document.createElement("div");
  legendDiv.className = "rtichoke-continuous-legend";
  legendDiv.style.display = "flex";
  legendDiv.style.alignItems = "center";
  legendDiv.style.gap = "0.75rem";
  legendDiv.style.marginLeft = `${theme.margins.left + 5}px`;
  legendDiv.style.marginTop = "0.25rem";
  legendDiv.style.marginBottom = "0.5rem";

  // Histogram container positioned directly beneath heatmap
  const histogramWrapper = document.createElement("div");
  histogramWrapper.className = "rtichoke-continuous-histogram-wrapper";
  histogramWrapper.style.marginTop = "0.5rem";
  histogramWrapper.style.marginBottom = "0.5rem";

  // Slider control container aligned precisely with heatmap x-axis inner margins
  const sliderControl = document.createElement("div");
  sliderControl.className = "rtichoke-operating-point-control";
  sliderControl.style.marginLeft = `${theme.margins.left + 5}px`;
  sliderControl.style.marginRight = `${theme.margins.right}px`;
  sliderControl.style.marginTop = "0.5rem";
  sliderControl.style.marginBottom = "0.75rem";

  const sliderId = `rtichoke-cod-slider-${++continuousOutcomeDistributionSliderCounter}`;
  const sliderLabel = document.createElement("label");
  sliderLabel.className = "rtichoke-operating-point-label";
  sliderLabel.htmlFor = sliderId;

  const sliderLabelText = document.createElement("span");
  sliderLabelText.textContent = "Step: ";
  const sliderValueText = document.createElement("span");
  sliderValueText.className = "rtichoke-operating-point-value";
  sliderLabel.append(sliderLabelText, sliderValueText);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = sliderId;
  slider.className = "rtichoke-operating-point-slider";

  sliderControl.append(sliderLabel, slider);

  // Unobserved observations section
  const unobservedSection = document.createElement("div");
  unobservedSection.className = "rtichoke-continuous-unobserved-section";
  unobservedSection.style.marginTop = "0.25rem";
  unobservedSection.style.padding = "0.5rem 0";

  mainLayoutDiv.append(heatmapWrapper, legendDiv, histogramWrapper, sliderControl, unobservedSection);

  // Compute joint upper limit across all evaluations
  const jointUpperProp = computeJointMaxProportion(spec);

  // Determine if Unobserved panel should be rendered:
  // Visible if any distribution across any evaluation has unobservedCount > 0
  const isUnobservedPanelRelevant = spec.distributions.some(
    (d) => d.unobservedCount > 0,
  );

  // State
  let activeEvalId = spec.evaluations[0].id;
  let selectedStep: number | null = null;
  let isHistogramOpen = false;

  const updateAll = () => {
    // Get distributions for active evaluation sorted by step
    const evalDists = spec.distributions
      .filter((d) => d.evaluationId === activeEvalId)
      .sort((a, b) => a.step - b.step);

    const availableSteps = evalDists.map((d) => d.step);

    if (availableSteps.length === 0) {
      heatmapWrapper.replaceChildren();
      legendDiv.replaceChildren();
      histogramWrapper.replaceChildren();
      sliderControl.style.display = "none";
      unobservedSection.replaceChildren();
      return;
    }

    // Initialize or adapt selectedStep to nearest available step
    if (selectedStep === null) {
      selectedStep = availableSteps[0];
    } else {
      selectedStep = selectNearestStep(selectedStep, availableSteps);
    }
    const activeStep = selectedStep;

    const currentDist =
      evalDists.find((d) => d.step === activeStep) ?? evalDists[0];

    // 1. Controls Bar (Evaluation selection if > 1 evaluation)
    controlsDiv.replaceChildren();
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
        const optLabel = document.createElement("label");
        optLabel.className = "rtichoke-pd-radio-option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `cod-eval-${instanceId}`;
        radio.value = ev.id;
        radio.checked = ev.id === activeEvalId;
        radio.addEventListener("change", () => {
          if (radio.checked) {
            activeEvalId = ev.id;
            updateAll();
          }
        });

        const span = document.createElement("span");
        span.textContent = evLabelText;
        optLabel.append(radio, span);
        evalOptions.append(optLabel);
      }
      evalGroup.append(evalOptions);
      controlsDiv.append(evalGroup);
    }

    // 2. Heatmap Rendering
    heatmapWrapper.replaceChildren();

    const flatCells: Array<{
      step: number;
      binIndex: number;
      binLower: number;
      binUpper: number;
      binLabel: string;
      count: number;
      observedCount: number;
      proportion: number;
      opacity: number;
      tooltipTitle: string;
    }> = [];

    const binEdges = spec.binEdges;
    const numBins = binEdges.length - 1;

    for (const dist of evalDists) {
      const isPastSelected = dist.step > activeStep;
      const opacity = isPastSelected ? 0.28 : 0.88;

      for (let i = 0; i < numBins; i++) {
        const binLower = binEdges[i];
        const binUpper = binEdges[i + 1];
        const binLabel = formatBinRange(binLower, binUpper, digits);
        const count = dist.binCounts[i];

        let proportion = 0;
        let tipText = "";

        if (dist.observedCount > 0) {
          proportion = count / dist.observedCount;
          const percentageStr = `${(proportion * 100).toFixed(1)}%`;
          tipText = tooltip(digits, [
            ["Step", dist.step],
            ["Outcome Range", binLabel],
            ["Observed count", count],
            ["Observed denominator", dist.observedCount],
            ["Bin proportion", percentageStr],
          ]);
        } else {
          proportion = 0;
          tipText = tooltip(digits, [
            ["Step", dist.step],
            ["Outcome Range", binLabel],
            ["Observed count", 0],
            ["Status", "No observed outcomes at this step (undefined distribution)"],
          ]);
        }

        flatCells.push({
          step: dist.step,
          binIndex: i,
          binLower,
          binUpper,
          binLabel,
          count,
          observedCount: dist.observedCount,
          proportion,
          opacity,
          tooltipTitle: tipText,
        });
      }
    }

    const heatmapWidth = theme.width - theme.margins.left - theme.margins.right;
    const yMin = binEdges[0];
    const yMax = binEdges[binEdges.length - 1];

    const minStep = Math.min(...availableSteps);
    const maxStep = Math.max(...availableSteps);
    const xDomainMin = minStep - 0.5;
    const xDomainMax = maxStep + 0.5;

    const heatmapMarks: Plot.Markish[] = [
      Plot.rect(flatCells, {
        x1: (d) => d.step - 0.5,
        x2: (d) => d.step + 0.5,
        y1: (d) => d.binLower,
        y2: (d) => d.binUpper,
        fill: (d) => (d.observedCount > 0 ? d.proportion : "#f3f4f6"),
        fillOpacity: (d) => (d.observedCount > 0 ? d.opacity : 0.4),
        stroke: "#ffffff",
        strokeWidth: 0.4,
        title: (d) => d.tooltipTitle,
        ariaLabel: (d) => String(d.step),
      }),
    ];

    // Selected step rectangular outline around column
    heatmapMarks.push(
      Plot.rect(
        [
          {
            x1: activeStep - 0.5,
            x2: activeStep + 0.5,
            y1: yMin,
            y2: yMax,
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
          domain: [xDomainMin, xDomainMax],
          ticks: availableSteps,
          tickFormat: (d: number) => String(Math.round(d)),
          grid: false,
          line: true,
        },
        y: {
          label: "Outcome Value",
          domain: [yMin, yMax],
          ticks: 5,
          tickFormat: (d: number) => d.toFixed(digits),
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

    const svgEl = heatmapPlot as unknown as SVGSVGElement;
    svgEl.style.cursor = "pointer";
    svgEl.tabIndex = 0;
    svgEl.setAttribute(
      "aria-label",
      "Continuous outcome heatmap. Press Enter or click a step column to view detail histogram.",
    );

    // Explicitly attach data-step attributes to cell rects for robust data-driven hit testing
    const rects = (svgEl as unknown as HTMLElement).querySelectorAll<SVGRectElement>("g[aria-label='rect'] rect");
    rects.forEach((rect, idx) => {
      if (idx < flatCells.length) {
        rect.setAttribute("data-step", String(flatCells[idx].step));
      }
    });

    const handleHeatmapSelection = (evt: Event) => {
      const clickedStep = findStepFromNode(evt.target as HTMLElement, svgEl);
      if (clickedStep !== null) {
        selectedStep = clickedStep;
      }
      isHistogramOpen = true;
      updateAll();
    };

    svgEl.addEventListener("click", handleHeatmapSelection);
    svgEl.addEventListener("keydown", (evt: KeyboardEvent) => {
      if (evt.key === "Enter" || evt.key === " ") {
        if (evt.key === " ") {
          evt.preventDefault();
        }
        handleHeatmapSelection(evt);
      }
    });

    heatmapWrapper.append(heatmapPlot);

    // 3. Legend Rendering
    legendDiv.replaceChildren();

    const legendLabel = document.createElement("span");
    legendLabel.style.fontSize = "12px";
    legendLabel.style.fontWeight = "600";
    legendLabel.style.color = "#374151";
    legendLabel.textContent = "Bin Proportion:";

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

    // 4. Histogram Rendering (If Open)
    histogramWrapper.replaceChildren();

    if (isHistogramOpen) {
      const histCard = document.createElement("div");
      histCard.className = "rtichoke-continuous-hist-card";
      histCard.style.padding = "0.75rem";
      histCard.style.backgroundColor = "#f9fafb";
      histCard.style.border = "1px solid #e5e7eb";
      histCard.style.borderRadius = "6px";
      histCard.style.marginLeft = `${theme.margins.left + 5}px`;
      histCard.style.marginRight = `${theme.margins.right}px`;

      const histHeader = document.createElement("div");
      histHeader.style.display = "flex";
      histHeader.style.justifyContent = "space-between";
      histHeader.style.alignItems = "center";
      histHeader.style.marginBottom = "0.25rem";
      histHeader.style.paddingBottom = "0.25rem";
      histHeader.style.borderBottom = "1px solid #e5e7eb";

      const histTitle = document.createElement("div");
      histTitle.style.fontWeight = "600";
      histTitle.style.fontSize = "13px";
      histTitle.style.color = "#1f2937";

      if (currentDist.observedCount > 0) {
        histTitle.textContent = `Step ${activeStep} Detail Histogram (n = ${currentDist.observedCount} observed subjects)`;
      } else {
        histTitle.textContent = `Step ${activeStep} Detail Histogram (No observed outcomes)`;
      }

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "rtichoke-continuous-close-hist";
      closeBtn.style.background = "none";
      closeBtn.style.border = "none";
      closeBtn.style.fontSize = "14px";
      closeBtn.style.fontWeight = "bold";
      closeBtn.style.color = "#6b7280";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.padding = "2px 6px";
      closeBtn.setAttribute("aria-label", "Close histogram detail view");
      closeBtn.textContent = "✕ Close";

      closeBtn.addEventListener("click", () => {
        isHistogramOpen = false;
        updateAll();
      });

      histHeader.append(histTitle, closeBtn);

      if (currentDist.observedCount > 0) {
        const histData = currentDist.binCounts.map((count, i) => {
          const binLower = binEdges[i];
          const binUpper = binEdges[i + 1];
          const binLabel = formatBinRange(binLower, binUpper, digits);
          const prop = count / currentDist.observedCount;
          const pct = prop * 100;
          return {
            binLower,
            binUpper,
            count,
            proportion: prop,
            percentage: pct,
            title: tooltip(digits, [
              ["Step", activeStep],
              ["Outcome Range", binLabel],
              ["Observed count", `${count} / ${currentDist.observedCount}`],
              ["Bin proportion", `${pct.toFixed(1)}%`],
            ]),
          };
        });

        const histWidth = heatmapWidth - 10;

        const histPlot = themedPlot(
          {
            width: histWidth,
            height: 180,
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
              label: "Outcome Value",
              domain: [yMin, yMax],
              ticks: 5,
              tickFormat: (d: number) => d.toFixed(digits),
              grid: false,
              line: true,
            },
            y: {
              label: "Bin Proportion (%)",
              domain: [0, jointUpperProp * 100],
              ticks: 4,
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

        histCard.append(histHeader, histPlot);
      } else {
        const noDataMsg = document.createElement("p");
        noDataMsg.style.margin = "0.75rem 0";
        noDataMsg.style.fontSize = "13px";
        noDataMsg.style.color = "#6b7280";
        noDataMsg.style.fontStyle = "italic";
        noDataMsg.textContent =
          "No observed outcomes at this step. Empirical distribution is undefined.";
        histCard.append(histHeader, noDataMsg);
      }

      histogramWrapper.append(histCard);
    }

    // 5. Slider Control Setup
    if (availableSteps.length > 1) {
      sliderControl.style.display = "flex";
      const sIdx = availableSteps.indexOf(selectedStep);
      slider.min = "0";
      slider.max = String(availableSteps.length - 1);
      slider.step = "1";
      slider.value = String(Math.max(0, sIdx));
      sliderValueText.textContent = String(activeStep);
      slider.setAttribute("aria-label", "Step");
      slider.setAttribute("aria-valuetext", String(activeStep));
    } else {
      sliderControl.style.display = "none";
    }

    // 6. Unobserved Observations Section
    unobservedSection.replaceChildren();

    if (isUnobservedPanelRelevant) {
      const unobservedHeader = document.createElement("div");
      unobservedHeader.style.display = "flex";
      unobservedHeader.style.justifyContent = "space-between";
      unobservedHeader.style.alignItems = "center";

      const unobservedReadout = document.createElement("div");
      unobservedReadout.style.fontSize = "13px";
      unobservedReadout.style.fontWeight = "600";
      unobservedReadout.style.color = "#1f2937";

      const refSize = currentDist.referenceSampleSize;
      const unobsCount = currentDist.unobservedCount;
      const unobsPct = refSize > 0 ? (unobsCount / refSize) * 100 : 0;

      unobservedReadout.textContent = `Unobserved at step ${activeStep}: ${unobsCount} / ${refSize} (${unobsPct.toFixed(1)}%)`;

      unobservedHeader.append(unobservedReadout);
      unobservedSection.append(unobservedHeader);

      const unobservedPanel = document.createElement("div");
      unobservedPanel.style.marginTop = "0.5rem";
      unobservedPanel.style.paddingTop = "0.5rem";
      unobservedPanel.style.borderTop = "1px dashed #d1d5db";

      // Neutral theme color for unobserved panel (slate/neutral gray, not censoring color)
      const UNOBSERVED_COLOR = "#94a3b8";

      const unobsPlotData = evalDists.map((d) => {
        const pct = d.referenceSampleSize > 0 ? (d.unobservedCount / d.referenceSampleSize) * 100 : 0;
        return {
          step: d.step,
          unobservedCount: d.unobservedCount,
          referenceSampleSize: d.referenceSampleSize,
          unobservedPercentage: pct,
          opacity: d.step > activeStep ? 0.28 : 0.88,
          title: tooltip(digits, [
            ["Step", d.step],
            ["Unobserved count", `${d.unobservedCount} / ${d.referenceSampleSize}`],
            ["Unobserved fraction", `${pct.toFixed(1)}%`],
          ]),
        };
      });

      const maxUnobsPct = Math.max(...unobsPlotData.map((d) => d.unobservedPercentage), 5);
      const selectedUnobsPct = unobsPct;

      const unobsMarks: Plot.Markish[] = [
        Plot.rectY(unobsPlotData, {
          x1: (d) => d.step - 0.5,
          x2: (d) => d.step + 0.5,
          y: "unobservedPercentage",
          fill: UNOBSERVED_COLOR,
          fillOpacity: (d) => d.opacity,
          stroke: "#475569",
          strokeWidth: 0.4,
          title: (d) => d.title,
          ariaLabel: (d) => String(d.step),
        }),
      ];

      if (selectedUnobsPct > 0) {
        unobsMarks.push(
          Plot.rect(
            [
              {
                x1: activeStep - 0.5,
                x2: activeStep + 0.5,
                y1: 0,
                y2: selectedUnobsPct,
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
      }

      const unobsPlot = themedPlot(
        {
          width: heatmapWidth,
          height: 140,
          marginTop: 10,
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
            domain: [xDomainMin, xDomainMax],
            ticks: availableSteps,
            tickFormat: (d: number) => String(Math.round(d)),
            grid: false,
            line: true,
          },
          y: {
            label: "Unobserved (%)",
            domain: [0, maxUnobsPct * 1.05],
            ticks: 4,
            tickFormat: (d: number) => `${d.toFixed(0)}%`,
            grid: true,
            line: true,
          },
          marks: unobsMarks,
        },
        theme,
      );

      const unobsSvgEl = unobsPlot as unknown as SVGSVGElement;
      unobsSvgEl.style.cursor = "pointer";

      const unobsRects = (unobsSvgEl as unknown as HTMLElement).querySelectorAll<SVGRectElement>("g[aria-label='rect'] rect");
      unobsRects.forEach((rect, idx) => {
        if (idx < unobsPlotData.length) {
          rect.setAttribute("data-step", String(unobsPlotData[idx].step));
        }
      });

      unobsSvgEl.addEventListener("click", (evt) => {
        const clickedStep = findStepFromNode(evt.target as HTMLElement, unobsSvgEl);
        if (clickedStep !== null) {
          selectedStep = clickedStep;
          updateAll();
        }
      });

      unobservedPanel.append(unobsPlot);
      unobservedSection.append(unobservedPanel);
    }
  };

  slider.addEventListener("input", () => {
    const evalDists = spec.distributions
      .filter((d) => d.evaluationId === activeEvalId)
      .sort((a, b) => a.step - b.step);
    const availableSteps = evalDists.map((d) => d.step);
    const idx = Number(slider.value);
    if (idx >= 0 && idx < availableSteps.length) {
      selectedStep = availableSteps[idx];
      updateAll();
    }
  });

  updateAll();
  return container;
}
