import * as Plot from "@observablehq/plot";
import type {
  PredictionDistributionBin,
  PredictionDistributionOperatingPoint,
  PredictionDistributionSpec,
} from "../spec/v2/prediction-distribution.js";
import { assertPredictionDistributionReferentialIntegrity } from "../spec/v2/validate-prediction-distribution.js";
import {
  type PredictionDistributionTheme,
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type V2RenderOptions,
} from "./v2.js";

export type PredictionDistributionColorMode =
  | "confusion_matrix_cell"
  | "observed_outcome";

export type PredictionDistributionConditioning =
  | "predicted_positives"
  | "predicted_negatives"
  | "real_positives"
  | "real_negatives";

export interface PredictionDistributionPreparedData {
  evalId: string;
  evalLabel: string;
  dim: "probability_threshold" | "ppcr";
  currentValue: number;
  cutoff: number;
  realizedPpcr: number;
  cutoffX: number;
  xAxisLabel: string;
  yAxisLabel: string;
  yMax: number;
  totalN: number;
  confusion: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    totalPositives: number;
    totalNegatives: number;
    totalPredictedPos: number;
    totalPredictedNeg: number;
  };
  ordinaryPlotData: Array<{
    x1: number;
    x2: number;
    category: "Observed Positives" | "Observed Negatives";
    density: number;
    count: number;
    title: string;
    classificationCell: "TP" | "FP" | "TN" | "FN";
    cellLabel: string;
  }>;
  zeroAtomPlotData: Array<{
    category: "Observed Positives" | "Observed Negatives";
    count: number;
    title: string;
    classificationCell: "TP" | "FP" | "TN" | "FN";
    cellLabel: string;
  }>;
}

export function resolveConfusionCellColors(
  theme: PredictionDistributionTheme,
  conditioning: PredictionDistributionConditioning,
): { tp: string; fp: string; tn: string; fn: string } {
  const {
    emphasizedTrue,
    nonEmphasizedTrue,
    emphasizedFalse,
    nonEmphasizedFalse,
  } = theme;

  switch (conditioning) {
    case "predicted_positives":
      return {
        tp: emphasizedTrue,
        fp: emphasizedFalse,
        tn: nonEmphasizedTrue,
        fn: nonEmphasizedFalse,
      };
    case "predicted_negatives":
      return {
        tn: emphasizedTrue,
        fn: emphasizedFalse,
        tp: nonEmphasizedTrue,
        fp: nonEmphasizedFalse,
      };
    case "real_positives":
      return {
        tp: emphasizedTrue,
        fn: emphasizedFalse,
        tn: nonEmphasizedTrue,
        fp: nonEmphasizedFalse,
      };
    case "real_negatives":
      return {
        tn: emphasizedTrue,
        fp: emphasizedFalse,
        tp: nonEmphasizedTrue,
        fn: nonEmphasizedFalse,
      };
  }
}

export function preparePredictionDistributionPlotData(
  spec: PredictionDistributionSpec,
  evalId: string,
  dim: "probability_threshold" | "ppcr",
  currentValue: number,
  digits: number,
): PredictionDistributionPreparedData {
  const ops = spec.operatingPoints
    .filter((op) => op.evaluationId === evalId && op.type === dim)
    .sort((a, b) => a.value - b.value);

  const activeOp = ops.find((op) => op.value === currentValue) ?? ops[0];
  const cutoff = activeOp ? activeOp.cutoff : 0;
  const realizedPpcr = activeOp ? activeOp.realizedPpcr : 0;

  const evalBins = spec.bins
    .filter((bin) => bin.evaluationId === evalId)
    .sort((a, b) => a.lower - b.lower);

  let totalN = 0;
  for (const bin of evalBins) {
    totalN += bin.nPositive + bin.nNegative;
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  const evalSpec = spec.evaluations.find((e) => e.id === evalId);
  const evalLabel =
    evalSpec?.label ?? evalSpec?.model ?? evalSpec?.population ?? evalId;

  const ordinaryPlotData: PredictionDistributionPreparedData["ordinaryPlotData"] =
    [];

  const zeroAtomPlotData: PredictionDistributionPreparedData["zeroAtomPlotData"] =
    [];

  let cumCount = 0;

  for (const bin of evalBins) {
    let isPredictedPositive = false;
    if (cutoff === 0) {
      isPredictedPositive = true;
    } else {
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
    const popLower = totalN > 0 ? cumCount / totalN : 0;
    const popUpper = totalN > 0 ? (cumCount + binTotal) / totalN : 0;
    cumCount += binTotal;

    const posCell: "TP" | "FN" = isPredictedPositive ? "TP" : "FN";
    const posCellLabel = isPredictedPositive
      ? "True Positive (TP)"
      : "False Negative (FN)";

    const negCell: "FP" | "TN" = isPredictedPositive ? "FP" : "TN";
    const negCellLabel = isPredictedPositive
      ? "False Positive (FP)"
      : "True Negative (TN)";

    if (dim === "probability_threshold") {
      if (bin.lower === 0 && bin.upper === 0) {
        if (bin.nPositive > 0) {
          zeroAtomPlotData.push({
            category: "Observed Positives",
            count: bin.nPositive,
            classificationCell: posCell,
            cellLabel: posCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", "[0, 0] (score zero atom)"],
              ["Outcome", "Observed Positive"],
              ["Count", bin.nPositive],
              ["Classification", posCellLabel],
            ]),
          });
        }
        if (bin.nNegative > 0) {
          zeroAtomPlotData.push({
            category: "Observed Negatives",
            count: bin.nNegative,
            classificationCell: negCell,
            cellLabel: negCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", "[0, 0] (score zero atom)"],
              ["Outcome", "Observed Negative"],
              ["Count", bin.nNegative],
              ["Classification", negCellLabel],
            ]),
          });
        }
      } else {
        const intervalWidth = bin.upper - bin.lower;
        const intervalLabel = `(${bin.lower.toFixed(digits)}, ${bin.upper.toFixed(digits)}]`;

        if (bin.nPositive > 0) {
          const posDensity = bin.nPositive / intervalWidth;
          ordinaryPlotData.push({
            x1: bin.lower,
            x2: bin.upper,
            category: "Observed Positives",
            density: posDensity,
            count: bin.nPositive,
            classificationCell: posCell,
            cellLabel: posCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", intervalLabel],
              ["Outcome", "Observed Positive"],
              ["Count", bin.nPositive],
              ["Count Density", posDensity.toFixed(digits)],
              ["Classification", posCellLabel],
            ]),
          });
        }

        if (bin.nNegative > 0) {
          const negDensity = bin.nNegative / intervalWidth;
          ordinaryPlotData.push({
            x1: bin.lower,
            x2: bin.upper,
            category: "Observed Negatives",
            density: negDensity,
            count: bin.nNegative,
            classificationCell: negCell,
            cellLabel: negCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", intervalLabel],
              ["Outcome", "Observed Negative"],
              ["Count", bin.nNegative],
              ["Count Density", negDensity.toFixed(digits)],
              ["Classification", negCellLabel],
            ]),
          });
        }
      }
    } else {
      // PPCR view: empty bins (binTotal === 0) have popLower === popUpper and are skipped
      if (binTotal > 0) {
        const scoreIntervalStr =
          bin.lower === 0 && bin.upper === 0
            ? "[0, 0]"
            : `(${bin.lower.toFixed(digits)}, ${bin.upper.toFixed(digits)}]`;

        const rankIntervalStr = `[${popLower.toFixed(digits)}, ${popUpper.toFixed(digits)}]`;

        if (bin.nPositive > 0) {
          const frac = bin.nPositive / binTotal;
          ordinaryPlotData.push({
            x1: popLower,
            x2: popUpper,
            category: "Observed Positives",
            density: frac,
            count: bin.nPositive,
            classificationCell: posCell,
            cellLabel: posCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Population Rank Percentile", rankIntervalStr],
              ["Score Interval", scoreIntervalStr],
              ["Outcome", "Observed Positive"],
              ["Count", bin.nPositive],
              ["Outcome Fraction", `${(frac * 100).toFixed(1)}%`],
              ["Classification", posCellLabel],
            ]),
          });
        }

        if (bin.nNegative > 0) {
          const frac = bin.nNegative / binTotal;
          ordinaryPlotData.push({
            x1: popLower,
            x2: popUpper,
            category: "Observed Negatives",
            density: frac,
            count: bin.nNegative,
            classificationCell: negCell,
            cellLabel: negCellLabel,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Population Rank Percentile", rankIntervalStr],
              ["Score Interval", scoreIntervalStr],
              ["Outcome", "Observed Negative"],
              ["Count", bin.nNegative],
              ["Outcome Fraction", `${(frac * 100).toFixed(1)}%`],
              ["Classification", negCellLabel],
            ]),
          });
        }
      }
    }
  }

  let cutoffX = cutoff;
  let xAxisLabel = "Prediction Score";
  let yAxisLabel = "Count density";
  let yMax = 1;

  if (dim === "probability_threshold") {
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
    cutoffX = 1 - realizedPpcr;
    xAxisLabel = "Prediction rank percentile (low to high)";
    yAxisLabel = "Outcome fraction";
    yMax = 1.18;
  }

  const totalPositives = tp + fn;
  const totalNegatives = tn + fp;
  const totalPredictedPos = tp + fp;
  const totalPredictedNeg = tn + fn;

  return {
    evalId,
    evalLabel,
    dim,
    currentValue,
    cutoff,
    realizedPpcr,
    cutoffX,
    xAxisLabel,
    yAxisLabel,
    yMax,
    totalN,
    confusion: {
      tp,
      fp,
      tn,
      fn,
      totalPositives,
      totalNegatives,
      totalPredictedPos,
      totalPredictedNeg,
    },
    ordinaryPlotData,
    zeroAtomPlotData,
  };
}

export function renderPredictionDistribution(
  spec: PredictionDistributionSpec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  assertPredictionDistributionReferentialIntegrity(spec);

  const resolved = resolveV2RenderOptions(2, options);
  const { theme } = resolved;
  const digits = theme.tip.digits;

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
  let currentColorMode: PredictionDistributionColorMode = "confusion_matrix_cell";
  let currentConditioning: PredictionDistributionConditioning = "predicted_positives";

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

  // Color Mode Selector ("Color bars by:")
  const colorModeGroup = document.createElement("label");
  colorModeGroup.className = "rtichoke-prediction-distribution__control-group";
  colorModeGroup.textContent = "Color bars by: ";

  const colorModeSelect = document.createElement("select");
  colorModeSelect.className = "rtichoke-prediction-distribution__select";
  colorModeSelect.setAttribute("aria-label", "Color bars by");

  const colorModeOpt1 = document.createElement("option");
  colorModeOpt1.value = "confusion_matrix_cell";
  colorModeOpt1.textContent = "Confusion matrix cell";

  const colorModeOpt2 = document.createElement("option");
  colorModeOpt2.value = "observed_outcome";
  colorModeOpt2.textContent = "Observed outcome";

  colorModeSelect.append(colorModeOpt1, colorModeOpt2);
  colorModeSelect.value = currentColorMode;
  colorModeGroup.append(colorModeSelect);
  controlsDiv.append(colorModeGroup);

  // Conditioning Selector ("Condition on:")
  const conditioningGroup = document.createElement("label");
  conditioningGroup.className =
    "rtichoke-prediction-distribution__control-group";
  conditioningGroup.textContent = "Condition on: ";

  const conditioningSelect = document.createElement("select");
  conditioningSelect.className = "rtichoke-prediction-distribution__select";
  conditioningSelect.setAttribute("aria-label", "Condition on");

  const condOpt1 = document.createElement("option");
  condOpt1.value = "predicted_positives";
  condOpt1.textContent = "Predicted positives";

  const condOpt2 = document.createElement("option");
  condOpt2.value = "predicted_negatives";
  condOpt2.textContent = "Predicted negatives";

  const condOpt3 = document.createElement("option");
  condOpt3.value = "real_positives";
  condOpt3.textContent = "Real positives";

  const condOpt4 = document.createElement("option");
  condOpt4.value = "real_negatives";
  condOpt4.textContent = "Real negatives";

  conditioningSelect.append(condOpt1, condOpt2, condOpt3, condOpt4);
  conditioningSelect.value = currentConditioning;
  conditioningGroup.append(conditioningSelect);
  controlsDiv.append(conditioningGroup);

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

  const createLegendItem = (label: string, color: string) => {
    const item = document.createElement("div");
    item.className = "rtichoke-legend-item";

    const swatch = document.createElement("span");
    swatch.className = "rtichoke-legend-swatch";

    const lineSpan = document.createElement("span");
    lineSpan.className = "rtichoke-legend-line";
    lineSpan.style.backgroundColor = color;
    lineSpan.style.border = `1px solid ${theme.axis.color}40`;
    lineSpan.style.boxSizing = "border-box";
    lineSpan.style.height = "10px";
    lineSpan.style.borderRadius = "2px";
    swatch.append(lineSpan);

    const labelSpan = document.createElement("span");
    labelSpan.className = "rtichoke-legend-label";
    labelSpan.textContent = label;

    item.append(swatch, labelSpan);
    return item;
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

    // Call pure helper
    const prep = preparePredictionDistributionPlotData(
      spec,
      currentEvalId,
      currentDim,
      currentValue,
      digits,
    );

    const {
      cutoff,
      realizedPpcr,
      cutoffX,
      xAxisLabel,
      yAxisLabel,
      yMax,
      totalN,
      confusion,
      ordinaryPlotData,
      zeroAtomPlotData,
    } = prep;

    const cellColors = resolveConfusionCellColors(
      theme.predictionDistribution,
      currentConditioning,
    );

    // Update legend & control visibility
    legendDiv.replaceChildren();
    if (currentColorMode === "observed_outcome") {
      conditioningGroup.style.display = "none";
      legendDiv.append(
        createLegendItem(
          "Observed Positives",
          theme.predictionDistribution.observedPositive,
        ),
        createLegendItem(
          "Observed Negatives",
          theme.predictionDistribution.observedNegative,
        ),
      );
    } else {
      conditioningGroup.style.display = "inline-flex";
      legendDiv.append(
        createLegendItem("True Positives (TP)", cellColors.tp),
        createLegendItem("False Positives (FP)", cellColors.fp),
        createLegendItem("True Negatives (TN)", cellColors.tn),
        createLegendItem("False Negatives (FN)", cellColors.fn),
      );
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

    const highlightColor =
      currentColorMode === "confusion_matrix_cell"
        ? cellColors.tp
        : theme.predictionDistribution.observedPositive;

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
          fill: highlightColor,
          fillOpacity: 0.12,
          label: "Predicted Positive (TP, FP)",
          labelX: cutoffX + (1 - cutoffX) / 2,
        },
      );
    } else if (cutoffX === 0) {
      bgRegions.push({
        x1: 0,
        x2: 1,
        fill: highlightColor,
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

    const fillKey =
      currentColorMode === "confusion_matrix_cell"
        ? "classificationCell"
        : "category";

    const colorDomain =
      currentColorMode === "confusion_matrix_cell"
        ? ["TP", "FP", "TN", "FN"]
        : ["Observed Positives", "Observed Negatives"];

    const colorRange =
      currentColorMode === "confusion_matrix_cell"
        ? [cellColors.tp, cellColors.fp, cellColors.tn, cellColors.fn]
        : [
            theme.predictionDistribution.observedPositive,
            theme.predictionDistribution.observedNegative,
          ];

    // Ordinary Stacked Bars
    if (ordinaryPlotData.length > 0) {
      marks.push(
        Plot.rectY(
          ordinaryPlotData,
          Plot.stackY({
            x1: "x1",
            x2: "x2",
            y: "density",
            fill: fillKey,
            stroke: theme.axis.color,
            strokeOpacity: 0.3,
            strokeWidth: 0.75,
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
            stroke: fillKey,
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

    const {
      tp,
      fp,
      tn,
      fn,
      totalPositives,
      totalNegatives,
      totalPredictedPos,
      totalPredictedNeg,
    } = confusion;

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

    const cellFnColor =
      currentColorMode === "confusion_matrix_cell"
        ? cellColors.fn
        : theme.predictionDistribution.observedPositive;
    const cellTpColor =
      currentColorMode === "confusion_matrix_cell"
        ? cellColors.tp
        : theme.predictionDistribution.observedPositive;
    const cellTnColor =
      currentColorMode === "confusion_matrix_cell"
        ? cellColors.tn
        : theme.predictionDistribution.observedNegative;
    const cellFpColor =
      currentColorMode === "confusion_matrix_cell"
        ? cellColors.fp
        : theme.predictionDistribution.observedNegative;

    const cellBorder = `border: 1px solid ${theme.axis.color}40;`;
    const darkText = "color: #111827; font-weight: 600;";

    const tbody = document.createElement("tbody");
    tbody.innerHTML = `
      <tr>
        <th>Observed Positive</th>
        <td class="rtichoke-prediction-distribution__cell--fn" style="background-color: ${cellFnColor}; ${darkText} ${cellBorder}" title="False Negatives">FN = ${fn}</td>
        <td class="rtichoke-prediction-distribution__cell--tp" style="background-color: ${cellTpColor}; ${darkText} ${cellBorder}" title="True Positives">TP = ${tp}</td>
        <td class="rtichoke-prediction-distribution__cell--total" style="${cellBorder}">${totalPositives}</td>
      </tr>
      <tr>
        <th>Observed Negative</th>
        <td class="rtichoke-prediction-distribution__cell--tn" style="background-color: ${cellTnColor}; ${darkText} ${cellBorder}" title="True Negatives">TN = ${tn}</td>
        <td class="rtichoke-prediction-distribution__cell--fp" style="background-color: ${cellFpColor}; ${darkText} ${cellBorder}" title="False Positives">FP = ${fp}</td>
        <td class="rtichoke-prediction-distribution__cell--total" style="${cellBorder}">${totalNegatives}</td>
      </tr>
      <tr>
        <th>Total</th>
        <td class="rtichoke-prediction-distribution__cell--total" style="${cellBorder}">${totalPredictedNeg}</td>
        <td class="rtichoke-prediction-distribution__cell--total" style="${cellBorder}">${totalPredictedPos}</td>
        <td class="rtichoke-prediction-distribution__cell--total" style="${cellBorder}">${totalN}</td>
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

  colorModeSelect.addEventListener("change", () => {
    currentColorMode = colorModeSelect.value as PredictionDistributionColorMode;
    updateChart();
  });

  conditioningSelect.addEventListener("change", () => {
    currentConditioning = conditioningSelect.value as PredictionDistributionConditioning;
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
