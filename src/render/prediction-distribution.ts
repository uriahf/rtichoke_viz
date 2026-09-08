import * as Plot from "@observablehq/plot";
import type {
  PredictionDistributionBin,
  PredictionDistributionOperatingPoint,
  PredictionDistributionSpec,
} from "../spec/v2/prediction-distribution.js";
import { assertPredictionDistributionReferentialIntegrity } from "../spec/v2/validate-prediction-distribution.js";
import {
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type V2RenderOptions,
} from "./v2.js";

export function renderPredictionDistribution(
  spec: PredictionDistributionSpec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  assertPredictionDistributionReferentialIntegrity(spec);

  const resolved = resolveV2RenderOptions(2, options);
  const { theme } = resolved;
  const digits = theme.tip.digits;

  // Evaluation state
  let currentEvalId = spec.evaluations[0].id;

  const getAvailableDimensions = (
    evalId: string,
  ): Array<"probability_threshold" | "ppcr"> => {
    const dims = new Set<"probability_threshold" | "ppcr">();
    for (const op of spec.operatingPoints) {
      if (op.evaluationId === evalId) {
        dims.add(op.type);
      }
    }
    const result: Array<"probability_threshold" | "ppcr"> = [];
    if (dims.has("probability_threshold")) result.push("probability_threshold");
    if (dims.has("ppcr")) result.push("ppcr");
    return result;
  };

  const getOperatingPoints = (
    evalId: string,
    dim: "probability_threshold" | "ppcr",
  ): PredictionDistributionOperatingPoint[] => {
    return spec.operatingPoints
      .filter((op) => op.evaluationId === evalId && op.type === dim)
      .sort((a, b) => a.value - b.value);
  };

  const initialDims = getAvailableDimensions(currentEvalId);
  let currentDim: "probability_threshold" | "ppcr" =
    spec.operatingPoint?.dimension &&
    initialDims.includes(spec.operatingPoint.dimension)
      ? spec.operatingPoint.dimension
      : initialDims[0] ?? "probability_threshold";

  const getValuesFor = (
    evalId: string,
    dim: "probability_threshold" | "ppcr",
  ): number[] => {
    const ops = getOperatingPoints(evalId, dim);
    return [...new Set(ops.map((op) => op.value))].sort((a, b) => a - b);
  };

  const pickBestValue = (
    evalId: string,
    dim: "probability_threshold" | "ppcr",
    preferredVal?: number,
  ): number => {
    const vals = getValuesFor(evalId, dim);
    if (vals.length === 0) return 0;
    if (preferredVal !== undefined && vals.includes(preferredVal)) {
      return preferredVal;
    }
    if (vals.includes(0.5)) {
      return 0.5;
    }
    return vals[0];
  };

  let currentValue = pickBestValue(currentEvalId, currentDim);

  // Main Container
  const container = document.createElement("div");
  container.className = "rtichoke-prediction-distribution";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Controls Header
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-prediction-distribution__controls";

  // Evaluation Selector
  let evalSelect: HTMLSelectElement | null = null;
  if (spec.evaluations.length > 1) {
    const evalGroup = document.createElement("label");
    evalGroup.className = "rtichoke-prediction-distribution__control-group";
    evalGroup.textContent = "Evaluation: ";

    evalSelect = document.createElement("select");
    evalSelect.className = "rtichoke-prediction-distribution__select";
    evalSelect.setAttribute("aria-label", "Evaluation");

    for (const evalSpec of spec.evaluations) {
      const opt = document.createElement("option");
      opt.value = evalSpec.id;
      opt.textContent =
        evalSpec.label ?? evalSpec.model ?? evalSpec.population ?? evalSpec.id;
      evalSelect.append(opt);
    }
    evalSelect.value = currentEvalId;
    evalGroup.append(evalSelect);
    controlsDiv.append(evalGroup);
  }

  // Dimension Selector
  const dimGroup = document.createElement("label");
  dimGroup.className = "rtichoke-prediction-distribution__control-group";
  dimGroup.textContent = "Dimension: ";

  const dimSelect = document.createElement("select");
  dimSelect.className = "rtichoke-prediction-distribution__select";
  dimSelect.setAttribute("aria-label", "Operating point dimension");

  const updateDimSelectOptions = () => {
    dimSelect.replaceChildren();
    const available = getAvailableDimensions(currentEvalId);
    for (const dim of available) {
      const opt = document.createElement("option");
      opt.value = dim;
      opt.textContent =
        dim === "probability_threshold" ? "Probability threshold" : "PPCR";
      dimSelect.append(opt);
    }
    dimSelect.value = currentDim;
    dimGroup.style.display = available.length > 1 ? "inline-flex" : "none";
  };
  dimGroup.append(dimSelect);
  controlsDiv.append(dimGroup);

  // Slider Control
  const sliderControl = document.createElement("div");
  sliderControl.className = "rtichoke-operating-point-control";
  sliderControl.style.marginLeft = `${theme.margins.left}px`;
  sliderControl.style.marginRight = `${theme.margins.right}px`;

  const sliderLabel = document.createElement("label");
  sliderLabel.className = "rtichoke-operating-point-label";

  const sliderLabelText = document.createElement("span");
  const sliderValueText = document.createElement("span");
  sliderValueText.className = "rtichoke-operating-point-value";

  sliderLabel.append(sliderLabelText, sliderValueText);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "rtichoke-operating-point-slider";

  sliderControl.append(sliderLabel, slider);

  // Legend Area
  const legendDiv = document.createElement("div");
  legendDiv.className = "rtichoke-legend";
  legendDiv.style.paddingLeft = `${theme.margins.left}px`;

  const posColor = resolved.colors[0];
  const negColor = resolved.colors[1];

  const createLegendItem = (label: string, color: string) => {
    const item = document.createElement("div");
    item.className = "rtichoke-legend-item";

    const swatch = document.createElement("span");
    swatch.className = "rtichoke-legend-swatch";

    const lineSpan = document.createElement("span");
    lineSpan.className = "rtichoke-legend-line";
    lineSpan.style.backgroundColor = color;
    swatch.append(lineSpan);

    const labelSpan = document.createElement("span");
    labelSpan.className = "rtichoke-legend-label";
    labelSpan.textContent = label;

    item.append(swatch, labelSpan);
    return item;
  };

  legendDiv.append(
    createLegendItem("Observed Positives", posColor),
    createLegendItem("Observed Negatives", negColor),
  );

  // Chart & Summary Content
  const chartDiv = document.createElement("div");
  chartDiv.className = "rtichoke-prediction-distribution__chart";

  const summaryDiv = document.createElement("div");
  summaryDiv.className = "rtichoke-prediction-distribution__summary";

  container.append(
    controlsDiv,
    sliderControl,
    legendDiv,
    chartDiv,
    summaryDiv,
  );

  const updateChart = () => {
    updateDimSelectOptions();

    const ops = getOperatingPoints(currentEvalId, currentDim);
    const availableValues = getValuesFor(currentEvalId, currentDim);

    if (!availableValues.includes(currentValue)) {
      currentValue = pickBestValue(currentEvalId, currentDim, currentValue);
    }

    const valueIndex = availableValues.indexOf(currentValue);
    slider.min = "0";
    slider.max = String(Math.max(0, availableValues.length - 1));
    slider.step = "1";
    slider.value = String(Math.max(0, valueIndex));

    const dimLabelText =
      currentDim === "probability_threshold"
        ? "Probability threshold"
        : "PPCR";
    sliderLabelText.textContent = `${dimLabelText}: `;
    sliderValueText.textContent = currentValue.toFixed(digits);
    slider.setAttribute("aria-label", dimLabelText);
    slider.setAttribute("aria-valuetext", currentValue.toFixed(digits));

    // Find active operating point
    const activeOp =
      ops.find((op) => op.value === currentValue) ?? ops[0];
    const cutoff = activeOp.cutoff;
    const realizedPpcr = activeOp.realizedPpcr;

    // Filter bins for current evaluation
    const evalBins = spec.bins
      .filter((bin) => bin.evaluationId === currentEvalId)
      .sort((a, b) => a.lower - b.lower);

    // Calculate confusion matrix cells
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    const plotData: Array<{
      x1: number;
      x2: number;
      category: "Observed Positives" | "Observed Negatives";
      count: number;
      predicted: "positive" | "negative";
      title: string;
    }> = [];

    const evalSpec = spec.evaluations.find((e) => e.id === currentEvalId);
    const evalLabel =
      evalSpec?.label ??
      evalSpec?.model ??
      evalSpec?.population ??
      currentEvalId;

    for (const bin of evalBins) {
      let isPredictedPositive = false;
      if (cutoff === 0) {
        // At cutoff zero: everyone is predicted positive
        isPredictedPositive = true;
      } else {
        // Nonzero cutoff: predicted positive if score > cutoff (upper > cutoff)
        isPredictedPositive = bin.upper > cutoff;
      }

      if (isPredictedPositive) {
        tp += bin.nPositive;
        fp += bin.nNegative;
      } else {
        fn += bin.nPositive;
        tn += bin.nNegative;
      }

      // X bounds for plot rendering
      let x1 = bin.lower;
      let x2 = bin.upper;
      if (bin.lower === 0 && bin.upper === 0) {
        x1 = 0;
        x2 = 0.005;
      } else if (bin.lower === 0) {
        x1 = 0.005;
      }

      const intervalLabel =
        bin.lower === 0 && bin.upper === 0
          ? "[0, 0]"
          : `(${bin.lower.toFixed(digits)}, ${bin.upper.toFixed(digits)}]`;

      const predLabel = isPredictedPositive
        ? "Predicted Positive"
        : "Predicted Negative";

      if (bin.nPositive > 0) {
        plotData.push({
          x1,
          x2,
          category: "Observed Positives",
          count: bin.nPositive,
          predicted: isPredictedPositive ? "positive" : "negative",
          title: tooltip(digits, [
            ["Evaluation", evalLabel],
            ["Score Interval", intervalLabel],
            ["Outcome", "Observed Positive"],
            ["Count", bin.nPositive],
            ["Classification", predLabel],
          ]),
        });
      }

      if (bin.nNegative > 0) {
        plotData.push({
          x1,
          x2,
          category: "Observed Negatives",
          count: bin.nNegative,
          predicted: isPredictedPositive ? "positive" : "negative",
          title: tooltip(digits, [
            ["Evaluation", evalLabel],
            ["Score Interval", intervalLabel],
            ["Outcome", "Observed Negative"],
            ["Count", bin.nNegative],
            ["Classification", predLabel],
          ]),
        });
      }
    }

    // Maximum height calculation
    let maxBinTotal = 0;
    for (const bin of evalBins) {
      maxBinTotal = Math.max(maxBinTotal, bin.nPositive + bin.nNegative);
    }
    const yMax = Math.max(1, Math.ceil(maxBinTotal * 1.15));

    // Background region shapes
    const bgRegions: Array<{
      x1: number;
      x2: number;
      fill: string;
      label: string;
      labelX: number;
    }> = [];

    if (cutoff > 0 && cutoff < 1) {
      bgRegions.push(
        {
          x1: 0,
          x2: cutoff,
          fill: "#f1f5f9",
          label: "Predicted Negative (TN, FN)",
          labelX: cutoff / 2,
        },
        {
          x1: cutoff,
          x2: 1,
          fill: "#fef3c7",
          label: "Predicted Positive (TP, FP)",
          labelX: cutoff + (1 - cutoff) / 2,
        },
      );
    } else if (cutoff === 0) {
      bgRegions.push({
        x1: 0,
        x2: 1,
        fill: "#fef3c7",
        label: "Predicted Positive (TP, FP)",
        labelX: 0.5,
      });
    } else {
      bgRegions.push({
        x1: 0,
        x2: 1,
        fill: "#f1f5f9",
        label: "Predicted Negative (TN, FN)",
        labelX: 0.5,
      });
    }

    const marks: Plot.Markish[] = [];

    // Background Shading
    for (const bg of bgRegions) {
      marks.push(
        Plot.rectY([bg], {
          x1: "x1",
          x2: "x2",
          y1: 0,
          y2: yMax,
          fill: bg.fill,
          fillOpacity: 0.35,
        }),
      );
    }

    // Region Labels
    for (const bg of bgRegions) {
      marks.push(
        Plot.text([bg], {
          x: "labelX",
          y: yMax,
          text: "label",
          dy: 12,
          fill: "#475569",
          fontSize: 11,
          fontWeight: 600,
        }),
      );
    }

    // Cutoff Line
    marks.push(
      Plot.ruleX([cutoff], {
        stroke: "#0f172a",
        strokeWidth: 2,
        strokeDasharray: "4,3",
      }),
    );

    // Cutoff text
    marks.push(
      Plot.text(
        [
          {
            x: cutoff,
            label: `Cutoff = ${cutoff.toFixed(digits)}`,
          },
        ],
        {
          x: "x",
          y: yMax,
          text: "label",
          dy: -10,
          fill: "#0f172a",
          fontSize: 11,
          fontWeight: 700,
        },
      ),
    );

    // Stacked Bars
    marks.push(
      Plot.rectY(
        plotData,
        Plot.stackY({
          x1: "x1",
          x2: "x2",
          y: "count",
          fill: "category",
          title: (d) => d.title,
          tip: true,
        }),
      ),
    );

    const plotSpec = {
      width: theme.width,
      height: Math.round(theme.height * 0.72),
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
      color: {
        legend: false,
        domain: ["Observed Positives", "Observed Negatives"],
        range: [posColor, negColor],
      },
      x: {
        label: "Prediction Score",
        domain: [0, 1],
        grid: false,
        line: true,
        ticks: theme.axis.ticks,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
        tickFormat: theme.axis.numberFormat,
      },
      y: {
        label: "Count",
        domain: [0, yMax],
        grid: false,
        line: true,
        ticks: 5,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
      },
      marks,
    };

    const chartSvg = themedPlot(plotSpec, theme);
    chartDiv.replaceChildren(chartSvg);

    // Update Summary Section
    summaryDiv.replaceChildren();

    const metricsRow = document.createElement("div");
    metricsRow.className = "rtichoke-prediction-distribution__metrics-row";

    const createMetricBadge = (lbl: string, val: string) => {
      const badge = document.createElement("div");
      badge.className = "rtichoke-prediction-distribution__metric-badge";

      const l = document.createElement("span");
      l.className = "rtichoke-prediction-distribution__metric-label";
      l.textContent = `${lbl}:`;

      const v = document.createElement("span");
      v.className = "rtichoke-prediction-distribution__metric-value";
      v.textContent = val;

      badge.append(l, v);
      return badge;
    };

    if (currentDim === "probability_threshold") {
      metricsRow.append(
        createMetricBadge(
          "Probability Threshold",
          currentValue.toFixed(digits),
        ),
        createMetricBadge("Effective Cutoff", cutoff.toFixed(digits)),
        createMetricBadge("Realized PPCR", realizedPpcr.toFixed(digits)),
      );
    } else {
      metricsRow.append(
        createMetricBadge("Requested PPCR", currentValue.toFixed(digits)),
        createMetricBadge("Effective Cutoff", cutoff.toFixed(digits)),
        createMetricBadge("Realized PPCR", realizedPpcr.toFixed(digits)),
      );
    }

    const totalPositives = tp + fn;
    const totalNegatives = tn + fp;
    const totalPredictedPos = tp + fp;
    const totalPredictedNeg = tn + fn;
    const totalN = totalPositives + totalNegatives;

    const table = document.createElement("table");
    table.className = "rtichoke-prediction-distribution__table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Observed \\ Predicted</th>
        <th>Negative (&le; ${cutoff.toFixed(digits)})</th>
        <th>Positive (&gt; ${cutoff.toFixed(digits)})</th>
        <th>Total</th>
      </tr>
    `;

    const tbody = document.createElement("tbody");
    tbody.innerHTML = `
      <tr>
        <th>Observed Positive</th>
        <td class="rtichoke-prediction-distribution__cell--fn" title="False Negatives">FN = ${fn}</td>
        <td class="rtichoke-prediction-distribution__cell--tp" title="True Positives">TP = ${tp}</td>
        <td class="rtichoke-prediction-distribution__cell--total">${totalPositives}</td>
      </tr>
      <tr>
        <th>Observed Negative</th>
        <td class="rtichoke-prediction-distribution__cell--tn" title="True Negatives">TN = ${tn}</td>
        <td class="rtichoke-prediction-distribution__cell--fp" title="False Positives">FP = ${fp}</td>
        <td class="rtichoke-prediction-distribution__cell--total">${totalNegatives}</td>
      </tr>
      <tr>
        <th>Total</th>
        <td class="rtichoke-prediction-distribution__cell--total">${totalPredictedNeg}</td>
        <td class="rtichoke-prediction-distribution__cell--total">${totalPredictedPos}</td>
        <td class="rtichoke-prediction-distribution__cell--total">${totalN}</td>
      </tr>
    `;

    table.append(thead, tbody);
    summaryDiv.append(metricsRow, table);
  };

  // Event Listeners
  if (evalSelect) {
    evalSelect.addEventListener("change", () => {
      currentEvalId = evalSelect!.value;
      const available = getAvailableDimensions(currentEvalId);
      if (!available.includes(currentDim)) {
        currentDim = available[0];
      }
      currentValue = pickBestValue(currentEvalId, currentDim, currentValue);
      updateChart();
    });
  }

  dimSelect.addEventListener("change", () => {
    currentDim = dimSelect.value as "probability_threshold" | "ppcr";
    currentValue = pickBestValue(currentEvalId, currentDim, currentValue);
    updateChart();
  });

  slider.addEventListener("input", () => {
    const availableValues = getValuesFor(currentEvalId, currentDim);
    const idx = Number(slider.value);
    if (idx >= 0 && idx < availableValues.length) {
      currentValue = availableValues[idx];
      updateChart();
    }
  });

  updateChart();
  return container;
}
