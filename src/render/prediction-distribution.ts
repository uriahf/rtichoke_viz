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

  // State
  let currentEvalId = spec.evaluations[0].id;
  let currentColorMode: "outcome" | "classification" = "outcome";

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

  // Color Mode Selector
  const colorGroup = document.createElement("label");
  colorGroup.className = "rtichoke-prediction-distribution__control-group";
  colorGroup.textContent = "Color bars by: ";

  const colorSelect = document.createElement("select");
  colorSelect.className = "rtichoke-prediction-distribution__select";
  colorSelect.setAttribute("aria-label", "Color mode");

  const optOutcome = document.createElement("option");
  optOutcome.value = "outcome";
  optOutcome.textContent = "Observed outcome";

  const optClass = document.createElement("option");
  optClass.value = "classification";
  optClass.textContent = "Confusion classification";

  colorSelect.append(optOutcome, optClass);
  colorSelect.value = currentColorMode;
  colorGroup.append(colorSelect);
  controlsDiv.append(colorGroup);

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

  const tpColor = "#166534";
  const fpColor = "#dc2626";
  const tnColor = "#22c55e";
  const fnColor = "#991b1b";

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

  const updateLegend = () => {
    legendDiv.replaceChildren();
    if (currentColorMode === "outcome") {
      legendDiv.append(
        createLegendItem("Observed Positives", posColor),
        createLegendItem("Observed Negatives", negColor),
      );
    } else {
      legendDiv.append(
        createLegendItem("True Positives (TP)", tpColor),
        createLegendItem("False Positives (FP)", fpColor),
        createLegendItem("True Negatives (TN)", tnColor),
        createLegendItem("False Negatives (FN)", fnColor),
      );
    }
  };

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
    updateLegend();

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

    // Calculate total count N
    let totalN = 0;
    for (const bin of evalBins) {
      totalN += bin.nPositive + bin.nNegative;
    }

    // Calculate confusion matrix cells
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    const evalSpec = spec.evaluations.find((e) => e.id === currentEvalId);
    const evalLabel =
      evalSpec?.label ??
      evalSpec?.model ??
      evalSpec?.population ??
      currentEvalId;

    const ordinaryPlotData: Array<{
      x1: number;
      x2: number;
      category: string;
      density: number;
      count: number;
      title: string;
    }> = [];

    const zeroAtomPlotData: Array<{
      category: string;
      count: number;
      title: string;
    }> = [];

    // Tracks cumulative population count for PPCR population rank coordinates
    let cumCount = 0;

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

      const binTotal = bin.nPositive + bin.nNegative;
      const popLower = cumCount / totalN;
      const popUpper = (cumCount + binTotal) / totalN;
      cumCount += binTotal;

      const predLabel = isPredictedPositive
        ? "Predicted Positive"
        : "Predicted Negative";

      if (currentDim === "probability_threshold") {
        // --- Score Space Coordinates ---
        if (bin.lower === 0 && bin.upper === 0) {
          // Score zero atom [0, 0]
          if (bin.nPositive > 0) {
            const cat =
              currentColorMode === "outcome"
                ? "Observed Positives"
                : isPredictedPositive
                ? "True Positives (TP)"
                : "False Negatives (FN)";
            zeroAtomPlotData.push({
              category: cat,
              count: bin.nPositive,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", "[0, 0] (score zero atom)"],
                ["Outcome", "Observed Positive"],
                ["Count", bin.nPositive],
                ["Classification", predLabel],
              ]),
            });
          }
          if (bin.nNegative > 0) {
            const cat =
              currentColorMode === "outcome"
                ? "Observed Negatives"
                : isPredictedPositive
                ? "False Positives (FP)"
                : "True Negatives (TN)";
            zeroAtomPlotData.push({
              category: cat,
              count: bin.nNegative,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", "[0, 0] (score zero atom)"],
                ["Outcome", "Observed Negative"],
                ["Count", bin.nNegative],
                ["Classification", predLabel],
              ]),
            });
          }
        } else {
          // Nondegenerate interval (lower, upper]
          const intervalWidth = bin.upper - bin.lower;
          const intervalLabel = `(${bin.lower.toFixed(digits)}, ${bin.upper.toFixed(digits)}]`;

          if (bin.nPositive > 0) {
            const posDensity = bin.nPositive / intervalWidth;
            const cat =
              currentColorMode === "outcome"
                ? "Observed Positives"
                : isPredictedPositive
                ? "True Positives (TP)"
                : "False Negatives (FN)";
            ordinaryPlotData.push({
              x1: bin.lower,
              x2: bin.upper,
              category: cat,
              density: posDensity,
              count: bin.nPositive,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Positive"],
                ["Count", bin.nPositive],
                ["Count Density", posDensity.toFixed(digits)],
                ["Classification", predLabel],
              ]),
            });
          }

          if (bin.nNegative > 0) {
            const negDensity = bin.nNegative / intervalWidth;
            const cat =
              currentColorMode === "outcome"
                ? "Observed Negatives"
                : isPredictedPositive
                ? "False Positives (FP)"
                : "True Negatives (TN)";
            ordinaryPlotData.push({
              x1: bin.lower,
              x2: bin.upper,
              category: cat,
              density: negDensity,
              count: bin.nNegative,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Negative"],
                ["Count", bin.nNegative],
                ["Count Density", negDensity.toFixed(digits)],
                ["Classification", predLabel],
              ]),
            });
          }
        }
      } else {
        // --- PPCR Population Rank Coordinates ---
        if (binTotal > 0) {
          const scoreIntervalStr =
            bin.lower === 0 && bin.upper === 0
              ? "[0, 0]"
              : `(${bin.lower.toFixed(digits)}, ${bin.upper.toFixed(digits)}]`;

          const rankIntervalStr = `[${popLower.toFixed(digits)}, ${popUpper.toFixed(digits)}]`;

          if (bin.nPositive > 0) {
            const frac = bin.nPositive / binTotal;
            const cat =
              currentColorMode === "outcome"
                ? "Observed Positives"
                : isPredictedPositive
                ? "True Positives (TP)"
                : "False Negatives (FN)";
            ordinaryPlotData.push({
              x1: popLower,
              x2: popUpper,
              category: cat,
              density: frac,
              count: bin.nPositive,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Population Rank Percentile", rankIntervalStr],
                ["Score Interval", scoreIntervalStr],
                ["Outcome", "Observed Positive"],
                ["Count", bin.nPositive],
                ["Outcome Fraction", `${(frac * 100).toFixed(1)}%`],
                ["Classification", predLabel],
              ]),
            });
          }

          if (bin.nNegative > 0) {
            const frac = bin.nNegative / binTotal;
            const cat =
              currentColorMode === "outcome"
                ? "Observed Negatives"
                : isPredictedPositive
                ? "False Positives (FP)"
                : "True Negatives (TN)";
            ordinaryPlotData.push({
              x1: popLower,
              x2: popUpper,
              category: cat,
              density: frac,
              count: bin.nNegative,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Population Rank Percentile", rankIntervalStr],
                ["Score Interval", scoreIntervalStr],
                ["Outcome", "Observed Negative"],
                ["Count", bin.nNegative],
                ["Outcome Fraction", `${(frac * 100).toFixed(1)}%`],
                ["Classification", predLabel],
              ]),
            });
          }
        }
      }
    }

    // Cutoff line x-coordinate and Maximum Y height calculation
    let cutoffX = cutoff;
    let xAxisLabel = "Prediction Score";
    let yAxisLabel = "Count density";
    let yMax = 1;

    if (currentDim === "probability_threshold") {
      cutoffX = cutoff;
      xAxisLabel = "Prediction Score";
      yAxisLabel = "Count density";

      let maxBinDensity = 0;
      const binsByLower = new Map<number, number>();
      for (const d of ordinaryPlotData) {
        binsByLower.set(d.x1, (binsByLower.get(d.x1) ?? 0) + d.density);
      }
      for (const totalDensity of binsByLower.values()) {
        maxBinDensity = Math.max(maxBinDensity, totalDensity);
      }
      yMax = Math.max(1, Math.ceil(maxBinDensity * 1.18));
    } else {
      // In PPCR view, cutoff boundary in population rank coordinates is 1 - realizedPpcr
      cutoffX = 1 - realizedPpcr;
      xAxisLabel = "Prediction rank percentile (low to high)";
      yAxisLabel = "Outcome fraction";
      yMax = 1.18;
    }

    // Background region shapes with theme-aware styling
    const bgRegions: Array<{
      x1: number;
      x2: number;
      fill: string;
      fillOpacity: number;
      label: string;
      labelX: number;
    }> = [];

    if (cutoffX > 0 && cutoffX < 1) {
      bgRegions.push(
        {
          x1: 0,
          x2: cutoffX,
          fill: theme.axis.color,
          fillOpacity: 0.06,
          label: "Predicted Negative (TN, FN)",
          labelX: cutoffX / 2,
        },
        {
          x1: cutoffX,
          x2: 1,
          fill: posColor,
          fillOpacity: 0.12,
          label: "Predicted Positive (TP, FP)",
          labelX: cutoffX + (1 - cutoffX) / 2,
        },
      );
    } else if (cutoffX === 0) {
      bgRegions.push({
        x1: 0,
        x2: 1,
        fill: posColor,
        fillOpacity: 0.12,
        label: "Predicted Positive (TP, FP)",
        labelX: 0.5,
      });
    } else {
      bgRegions.push({
        x1: 0,
        x2: 1,
        fill: theme.axis.color,
        fillOpacity: 0.06,
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
          fillOpacity: bg.fillOpacity,
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
          fill: theme.axis.color,
          fontSize: 11,
          fontWeight: 600,
        }),
      );
    }

    // Cutoff Line
    marks.push(
      Plot.ruleX([cutoffX], {
        stroke: theme.axis.color,
        strokeWidth: 2,
        strokeDasharray: "4,3",
      }),
    );

    // Cutoff text
    const cutoffTextLabel =
      currentDim === "probability_threshold"
        ? `Cutoff = ${cutoff.toFixed(digits)}`
        : `Realized PPCR = ${realizedPpcr.toFixed(digits)}`;

    marks.push(
      Plot.text(
        [
          {
            x: cutoffX,
            label: cutoffTextLabel,
          },
        ],
        {
          x: "x",
          y: yMax,
          text: "label",
          dy: -10,
          fill: theme.axis.color,
          fontSize: 11,
          fontWeight: 700,
        },
      ),
    );

    // Color domain and range
    let colorDomain: string[] = [];
    let colorRange: string[] = [];

    if (currentColorMode === "outcome") {
      colorDomain = ["Observed Positives", "Observed Negatives"];
      colorRange = [posColor, negColor];
    } else {
      colorDomain = [
        "True Positives (TP)",
        "False Positives (FP)",
        "True Negatives (TN)",
        "False Negatives (FN)",
      ];
      colorRange = [tpColor, fpColor, tnColor, fnColor];
    }

    // Ordinary Stacked Bars
    if (ordinaryPlotData.length > 0) {
      marks.push(
        Plot.rectY(
          ordinaryPlotData,
          Plot.stackY({
            x1: "x1",
            x2: "x2",
            y: "density",
            fill: "category",
            title: (d) => d.title,
            tip: true,
          }),
        ),
      );
    }

    // Discrete Zero-Score Atom [0, 0] Spike/Rule (Threshold view only)
    if (currentDim === "probability_threshold" && zeroAtomPlotData.length > 0) {
      marks.push(
        Plot.ruleX(
          zeroAtomPlotData,
          Plot.stackY({
            x: 0,
            y: "count",
            stroke: "category",
            strokeWidth: 5,
            title: (d) => d.title,
            tip: true,
          }),
        ),
      );
    }

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
        domain: colorDomain,
        range: colorRange,
      },
      x: {
        label: xAxisLabel,
        domain: [0, 1],
        grid: false,
        line: true,
        ticks: theme.axis.ticks,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
        tickFormat: theme.axis.numberFormat,
      },
      y: {
        label: yAxisLabel,
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

  colorSelect.addEventListener("change", () => {
    currentColorMode = colorSelect.value as "outcome" | "classification";
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
