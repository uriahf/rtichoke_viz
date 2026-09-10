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

export type PredictionDistributionDisplayMode = "stacked" | "mirrored";

export type PredictionDistributionColorMode =
  | "confusion_matrix_cell"
  | "observed_outcome";

export type PredictionDistributionConditioning =
  | "all_observations"
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
  performanceMetrics: {
    sensitivity: number | null;
    specificity: number | null;
    ppv: number | null;
    npv: number | null;
    lift: number | null;
  } | null;
  confusion: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    totalPositives: number;
    totalNegatives: number;
    totalPredictedPos: number;
    totalPredictedNeg: number;
  } | null;
  ordinaryPlotData: Array<{
    x1: number;
    x2: number;
    category: "Observed Positives" | "Observed Negatives";
    count: number;
    title: string;
    classificationCell: "TP" | "FP" | "TN" | "FN";
    cellLabel: string;
    isPredictedPositive: boolean;
  }>;
  zeroAtomPlotData: Array<{
    category: "Observed Positives" | "Observed Negatives";
    count: number;
    title: string;
    classificationCell: "TP" | "FP" | "TN" | "FN";
    cellLabel: string;
  }>;
}

let pdInstanceCounter = 0;

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
    case "all_observations":
    default:
      return {
        tp: emphasizedTrue,
        fp: emphasizedFalse,
        tn: emphasizedTrue,
        fn: emphasizedFalse,
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

  const activeOp = ops.find((op) => Math.abs(op.value - currentValue) < 1e-6) ?? ops[0];
  const cutoff = activeOp ? activeOp.cutoff : 0;
  const realizedPpcr = activeOp ? activeOp.realizedPpcr : 0;

  const evalBins = spec.bins
    .filter((bin) => bin.evaluationId === evalId)
    .sort((a, b) => a.lower - b.lower);

  let totalN = 0;
  for (const bin of evalBins) {
    totalN += bin.nPositive + bin.nNegative;
  }

  let performanceMetrics: PredictionDistributionPreparedData["performanceMetrics"] = null;
  let confusion: PredictionDistributionPreparedData["confusion"] = null;

  // STRICT PRODUCER-OWNED STATISTICS
  if (activeOp?.performance && activeOp.performance.length > 0) {
    const getMetric = (id: string): number | null => {
      const p = activeOp.performance?.find((item) => item.metricId === id);
      return p && p.estimate !== undefined && p.estimate !== null
        ? p.estimate
        : null;
    };

    const tp = getMetric("true_positives");
    const fp = getMetric("false_positives");
    const tn = getMetric("true_negatives");
    const fn = getMetric("false_negatives");

    const sens = getMetric("sensitivity");
    const specMetric = getMetric("specificity");
    const ppv = getMetric("ppv");
    const npv = getMetric("npv");
    const lift = getMetric("lift");

    if (
      sens !== null ||
      specMetric !== null ||
      ppv !== null ||
      npv !== null ||
      lift !== null
    ) {
      performanceMetrics = {
        sensitivity: sens,
        specificity: specMetric,
        ppv: ppv,
        npv: npv,
        lift: lift,
      };
    }

    if (tp !== null && fp !== null && tn !== null && fn !== null) {
      const totalPositives = tp + fn;
      const totalNegatives = tn + fp;
      const totalPredictedPos = tp + fp;
      const totalPredictedNeg = tn + fn;

      confusion = {
        tp,
        fp,
        tn,
        fn,
        totalPositives,
        totalNegatives,
        totalPredictedPos,
        totalPredictedNeg,
      };
    }
  }

  const evalSpec = spec.evaluations.find((e) => e.id === evalId);
  const evalLabel =
    evalSpec?.label ?? evalSpec?.model ?? evalSpec?.population ?? evalId;

  const ordinaryPlotData: PredictionDistributionPreparedData["ordinaryPlotData"] =
    [];
  const zeroAtomPlotData: PredictionDistributionPreparedData["zeroAtomPlotData"] =
    [];

  if (dim === "probability_threshold") {
    const bin0 = evalBins.find((b) => b.lower === 0 && b.upper === 0);
    const nonZeroBins = evalBins.filter((b) => !(b.lower === 0 && b.upper === 0));

    if (bin0) {
      const isPredictedPositiveBin0 = cutoff === 0 ? true : bin0.upper > cutoff;
      const posCell0: "TP" | "FN" = isPredictedPositiveBin0 ? "TP" : "FN";
      const posCellLabel0 = isPredictedPositiveBin0
        ? "True Positive (TP)"
        : "False Negative (FN)";
      const negCell0: "FP" | "TN" = isPredictedPositiveBin0 ? "FP" : "TN";
      const negCellLabel0 = isPredictedPositiveBin0
        ? "False Positive (FP)"
        : "True Negative (TN)";

      if (bin0.nPositive > 0) {
        zeroAtomPlotData.push({
          category: "Observed Positives",
          count: bin0.nPositive,
          classificationCell: posCell0,
          cellLabel: posCellLabel0,
          title: tooltip(digits, [
            ["Evaluation", evalLabel],
            ["Score Interval", "[0, 0]"],
            ["Outcome", "Observed Positive"],
            ["Count", bin0.nPositive],
            ["Classification", posCellLabel0],
          ]),
        });
      }
      if (bin0.nNegative > 0) {
        zeroAtomPlotData.push({
          category: "Observed Negatives",
          count: bin0.nNegative,
          classificationCell: negCell0,
          cellLabel: negCellLabel0,
          title: tooltip(digits, [
            ["Evaluation", evalLabel],
            ["Score Interval", "[0, 0]"],
            ["Outcome", "Observed Negative"],
            ["Count", bin0.nNegative],
            ["Classification", negCellLabel0],
          ]),
        });
      }
    }

    for (let i = 0; i < nonZeroBins.length; i++) {
      const bin = nonZeroBins[i];
      const x1 = i === 0 ? 0 : bin.lower;
      const x2 = bin.upper;
      const intervalLabel = `[${x1.toFixed(digits)}, ${x2.toFixed(digits)}]`;

      if (i === 0 && bin0) {
        const isBin0PredictedPos = cutoff === 0 ? true : bin0.upper > cutoff;
        const bin0PosCell: "TP" | "FN" = isBin0PredictedPos ? "TP" : "FN";
        const bin0PosLabel = isBin0PredictedPos ? "True Positive (TP)" : "False Negative (FN)";
        const bin0NegCell: "FP" | "TN" = isBin0PredictedPos ? "FP" : "TN";
        const bin0NegLabel = isBin0PredictedPos ? "False Positive (FP)" : "True Negative (TN)";

        const isBin1PredictedPos = cutoff === 0 ? true : bin.upper > cutoff;
        const bin1PosCell: "TP" | "FN" = isBin1PredictedPos ? "TP" : "FN";
        const bin1PosLabel = isBin1PredictedPos ? "True Positive (TP)" : "False Negative (FN)";
        const bin1NegCell: "FP" | "TN" = isBin1PredictedPos ? "FP" : "TN";
        const bin1NegLabel = isBin1PredictedPos ? "False Positive (FP)" : "True Negative (TN)";

        const combinedPos = bin0.nPositive + bin.nPositive;
        const combinedNeg = bin0.nNegative + bin.nNegative;

        if (bin0PosCell === bin1PosCell) {
          if (combinedPos > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Positives",
              count: combinedPos,
              classificationCell: bin1PosCell,
              cellLabel: bin1PosLabel,
              isPredictedPositive: isBin1PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Positive"],
                ["Count", combinedPos],
                ["Classification", bin1PosLabel],
              ]),
            });
          }
        } else {
          if (bin0.nPositive > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Positives",
              count: bin0.nPositive,
              classificationCell: bin0PosCell,
              cellLabel: bin0PosLabel,
              isPredictedPositive: isBin0PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Positive"],
                ["Count", bin0.nPositive],
                ["Classification", bin0PosLabel],
              ]),
            });
          }
          if (bin.nPositive > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Positives",
              count: bin.nPositive,
              classificationCell: bin1PosCell,
              cellLabel: bin1PosLabel,
              isPredictedPositive: isBin1PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Positive"],
                ["Count", bin.nPositive],
                ["Classification", bin1PosLabel],
              ]),
            });
          }
        }

        if (bin0NegCell === bin1NegCell) {
          if (combinedNeg > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Negatives",
              count: combinedNeg,
              classificationCell: bin1NegCell,
              cellLabel: bin1NegLabel,
              isPredictedPositive: isBin1PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Negative"],
                ["Count", combinedNeg],
                ["Classification", bin1NegLabel],
              ]),
            });
          }
        } else {
          if (bin0.nNegative > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Negatives",
              count: bin0.nNegative,
              classificationCell: bin0NegCell,
              cellLabel: bin0NegLabel,
              isPredictedPositive: isBin0PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Negative"],
                ["Count", bin0.nNegative],
                ["Classification", bin0NegLabel],
              ]),
            });
          }
          if (bin.nNegative > 0) {
            ordinaryPlotData.push({
              x1,
              x2,
              category: "Observed Negatives",
              count: bin.nNegative,
              classificationCell: bin1NegCell,
              cellLabel: bin1NegLabel,
              isPredictedPositive: isBin1PredictedPos,
              title: tooltip(digits, [
                ["Evaluation", evalLabel],
                ["Score Interval", intervalLabel],
                ["Outcome", "Observed Negative"],
                ["Count", bin.nNegative],
                ["Classification", bin1NegLabel],
              ]),
            });
          }
        }
      } else {
        const isPredictedPositive = cutoff === 0 ? true : bin.upper > cutoff;
        const posCell: "TP" | "FN" = isPredictedPositive ? "TP" : "FN";
        const posCellLabel = isPredictedPositive
          ? "True Positive (TP)"
          : "False Negative (FN)";
        const negCell: "FP" | "TN" = isPredictedPositive ? "FP" : "TN";
        const negCellLabel = isPredictedPositive
          ? "False Positive (FP)"
          : "True Negative (TN)";

        if (bin.nPositive > 0) {
          ordinaryPlotData.push({
            x1,
            x2,
            category: "Observed Positives",
            count: bin.nPositive,
            classificationCell: posCell,
            cellLabel: posCellLabel,
            isPredictedPositive,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", intervalLabel],
              ["Outcome", "Observed Positive"],
              ["Count", bin.nPositive],
              ["Classification", posCellLabel],
            ]),
          });
        }

        if (bin.nNegative > 0) {
          ordinaryPlotData.push({
            x1,
            x2,
            category: "Observed Negatives",
            count: bin.nNegative,
            classificationCell: negCell,
            cellLabel: negCellLabel,
            isPredictedPositive,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Score Interval", intervalLabel],
              ["Outcome", "Observed Negative"],
              ["Count", bin.nNegative],
              ["Classification", negCellLabel],
            ]),
          });
        }
      }
    }
  } else {
    // PPCR / Risk Percentile mode
    const evalRankBins = (spec.rankBins ?? [])
      .filter((b) => b.evaluationId === evalId)
      .sort((a, b) => a.rankLower - b.rankLower);

    for (const rBin of evalRankBins) {
      const popLower = rBin.rankLower;
      const popUpper = rBin.rankUpper;
      const totalMass = rBin.positiveMass + rBin.negativeMass;

      // Partition boundary at (1 - currentValue) on the common `by` grid
      const isPredictedPositive = popLower >= (1 - currentValue) - 1e-9;

      const posCell: "TP" | "FN" = isPredictedPositive ? "TP" : "FN";
      const posCellLabel = isPredictedPositive
        ? "True Positive (TP)"
        : "False Negative (FN)";
      const negCell: "FP" | "TN" = isPredictedPositive ? "FP" : "TN";
      const negCellLabel = isPredictedPositive
        ? "False Positive (FP)"
        : "True Negative (TN)";

      if (totalMass > 0) {
        const rankIntervalStr = `[${popLower.toFixed(digits)}, ${popUpper.toFixed(digits)}]`;

        if (rBin.positiveMass > 0) {
          ordinaryPlotData.push({
            x1: popLower,
            x2: popUpper,
            category: "Observed Positives",
            count: rBin.positiveMass,
            classificationCell: posCell,
            cellLabel: posCellLabel,
            isPredictedPositive,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Population Rank Percentile", rankIntervalStr],
              ["Outcome", "Observed Positive"],
              ["Count", rBin.positiveMass],
              ["Classification", posCellLabel],
            ]),
          });
        }

        if (rBin.negativeMass > 0) {
          ordinaryPlotData.push({
            x1: popLower,
            x2: popUpper,
            category: "Observed Negatives",
            count: rBin.negativeMass,
            classificationCell: negCell,
            cellLabel: negCellLabel,
            isPredictedPositive,
            title: tooltip(digits, [
              ["Evaluation", evalLabel],
              ["Population Rank Percentile", rankIntervalStr],
              ["Outcome", "Observed Negative"],
              ["Count", rBin.negativeMass],
              ["Classification", negCellLabel],
            ]),
          });
        }
      }
    }
  }

  let cutoffX = cutoff;
  let xAxisLabel = "Prediction Score";
  const yAxisLabel = "Count";
  let yMax = 1;

  if (dim === "probability_threshold") {
    cutoffX = cutoff;
    xAxisLabel = "Prediction Score";

    let maxBinCount = 0;
    const binsByLower = new Map<number, number>();
    for (const d of ordinaryPlotData) {
      binsByLower.set(d.x1, (binsByLower.get(d.x1) ?? 0) + d.count);
    }
    for (const totalCount of binsByLower.values()) {
      maxBinCount = Math.max(maxBinCount, totalCount);
    }
    yMax = Math.max(1, Math.ceil(maxBinCount * 1.15));
  } else {
    // Display boundary on rank axis = 1 - requested PPCR
    cutoffX = 1 - currentValue;
    xAxisLabel = "Risk Percentile";

    let maxRankBinCount = 0;
    const rankBinsByLower = new Map<number, number>();
    for (const d of ordinaryPlotData) {
      rankBinsByLower.set(d.x1, (rankBinsByLower.get(d.x1) ?? 0) + d.count);
    }
    for (const totalCount of rankBinsByLower.values()) {
      maxRankBinCount = Math.max(maxRankBinCount, totalCount);
    }
    yMax = Math.max(1, Math.ceil(maxRankBinCount * 1.15));
  }

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
    performanceMetrics,
    confusion,
    ordinaryPlotData,
    zeroAtomPlotData,
  };
}

export function renderPredictionDistribution(
  spec: PredictionDistributionSpec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  assertPredictionDistributionReferentialIntegrity(spec);

  const instanceId = ++pdInstanceCounter;
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
    if (preferredVal !== undefined && vals.some((v) => Math.abs(v - preferredVal) < 1e-6)) {
      return preferredVal;
    }
    if (vals.some((v) => Math.abs(v - 0.5) < 1e-6)) {
      return 0.5;
    }
    return vals[0];
  };

  let currentValue = pickBestValue(currentEvalId, currentDim);
  let currentDisplayMode: PredictionDistributionDisplayMode = "stacked";
  let currentColorMode: PredictionDistributionColorMode = "confusion_matrix_cell";
  let currentConditioning: PredictionDistributionConditioning = "all_observations";

  // Main Container
  const container = document.createElement("div");
  container.className = "rtichoke-prediction-distribution";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";

  // Controls Bar
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "rtichoke-prediction-distribution__controls";

  // Persistent select controls for DOM query compatibility
  const evalSelect = document.createElement("select");
  evalSelect.className = "rtichoke-prediction-distribution__select";
  evalSelect.setAttribute("aria-label", "Evaluation");
  evalSelect.style.display = "none";

  const colorModeSelect = document.createElement("select");
  colorModeSelect.className = "rtichoke-prediction-distribution__select";
  colorModeSelect.setAttribute("aria-label", "Color bars by");
  colorModeSelect.style.display = "none";

  const cmOpt1 = document.createElement("option");
  cmOpt1.value = "confusion_matrix_cell";
  cmOpt1.textContent = "Confusion matrix cell";
  const cmOpt2 = document.createElement("option");
  cmOpt2.value = "observed_outcome";
  cmOpt2.textContent = "Observed outcome";
  colorModeSelect.append(cmOpt1, cmOpt2);

  const conditioningGroup = document.createElement("label");
  conditioningGroup.className = "rtichoke-prediction-distribution__control-group";

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
  conditioningGroup.append(conditioningSelect);

  const dimSelect = document.createElement("select");
  dimSelect.className = "rtichoke-prediction-distribution__select";
  dimSelect.setAttribute("aria-label", "Operating point dimension");
  dimSelect.style.display = "none";

  // Event listeners on persistent select controls
  evalSelect.addEventListener("change", () => {
    currentEvalId = evalSelect.value;
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

  dimSelect.addEventListener("change", () => {
    currentDim = dimSelect.value as "probability_threshold" | "ppcr";
    currentValue = pickBestValue(currentEvalId, currentDim, currentValue);
    updateChart();
  });

  // Helper to create radio group
  const createRadioGroup = <T extends string>(
    groupLabel: string,
    name: string,
    options: Array<{ value: T; label: string }>,
    currentVal: T,
    onChange: (newVal: T) => void,
  ): HTMLElement => {
    const group = document.createElement("div");
    group.className = "rtichoke-pd-radio-group";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", groupLabel);

    const labelSpan = document.createElement("span");
    labelSpan.className = "rtichoke-pd-radio-group-label";
    labelSpan.textContent = `${groupLabel}:`;
    group.append(labelSpan);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "rtichoke-pd-radio-options";

    for (const opt of options) {
      const optionLabel = document.createElement("label");
      optionLabel.className = "rtichoke-pd-radio-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = name;
      radio.value = opt.value;
      radio.checked = opt.value === currentVal;

      radio.addEventListener("change", () => {
        if (radio.checked) {
          onChange(opt.value);
        }
      });

      const optSpan = document.createElement("span");
      optSpan.textContent = opt.label;

      optionLabel.append(radio, optSpan);
      optionsContainer.append(optionLabel);
    }

    group.append(optionsContainer);
    return group;
  };

  const evalControlContainer = document.createElement("div");
  evalControlContainer.className = "rtichoke-pd-controls-row";

  const updateEvalControls = () => {
    evalControlContainer.replaceChildren();

    evalSelect.replaceChildren();
    for (const evalSpec of spec.evaluations) {
      const opt = document.createElement("option");
      opt.value = evalSpec.id;
      opt.textContent =
        evalSpec.label ?? evalSpec.model ?? evalSpec.population ?? evalSpec.id;
      evalSelect.append(opt);
    }
    evalSelect.value = currentEvalId;

    if (spec.evaluations.length > 1) {
      const refGroupOptions = spec.evaluations.map((e) => ({
        value: e.id,
        label: e.label ?? e.model ?? e.population ?? e.id,
      }));

      const refRadioGroup = createRadioGroup(
        "Reference Group",
        `pd-ref-group-${instanceId}`,
        refGroupOptions,
        currentEvalId,
        (selectedEvalId) => {
          currentEvalId = selectedEvalId;
          updateChart();
        },
      );
      evalControlContainer.append(refRadioGroup);
    }
  };

  const presentationControlContainer = document.createElement("div");
  presentationControlContainer.className = "rtichoke-pd-controls-row";

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
    lineSpan.style.border = `1px solid ${theme.axis.color}`;
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

  controlsDiv.append(evalControlContainer, presentationControlContainer);

  container.append(
    controlsDiv,
    summaryDiv,
    sliderControl,
    legendDiv,
    chartDiv,
  );

  const updateChart = () => {
    updateEvalControls();

    presentationControlContainer.replaceChildren();

    colorModeSelect.value = currentColorMode;
    conditioningSelect.value =
      currentConditioning === "all_observations"
        ? "predicted_positives"
        : currentConditioning;
    conditioningGroup.style.display =
      currentColorMode === "observed_outcome" ? "none" : "inline-flex";

    dimSelect.replaceChildren();
    const availableDims = getAvailableDimensions(currentEvalId);
    for (const dim of availableDims) {
      const opt = document.createElement("option");
      opt.value = dim;
      opt.textContent =
        dim === "probability_threshold" ? "Probability threshold" : "PPCR";
      dimSelect.append(opt);
    }
    dimSelect.value = currentDim;

    // Display Radio Group
    const displayRadioGroup = createRadioGroup(
      "Display",
      `pd-display-${instanceId}`,
      [
        { value: "stacked", label: "Stacked" },
        { value: "mirrored", label: "Mirrored" },
      ],
      currentDisplayMode,
      (newMode) => {
        currentDisplayMode = newMode;
        updateChart();
      },
    );

    // Color Bars By Radio Group
    const colorModeRadioGroup = createRadioGroup(
      "Color Bars By",
      `pd-color-${instanceId}`,
      [
        { value: "confusion_matrix_cell", label: "Confusion Matrix Cell" },
        { value: "observed_outcome", label: "Observed Outcome" },
      ],
      currentColorMode,
      (newMode) => {
        currentColorMode = newMode;
        updateChart();
      },
    );

    presentationControlContainer.append(
      displayRadioGroup,
      colorModeRadioGroup,
      evalSelect,
      colorModeSelect,
      conditioningGroup,
      dimSelect,
    );

    // Dimension Radio Group (if >1 available)
    if (availableDims.length > 1) {
      const dimRadioGroup = createRadioGroup(
        "Dimension",
        `pd-dim-${instanceId}`,
        [
          { value: "probability_threshold", label: "Probability Threshold" },
          { value: "ppcr", label: "PPCR" },
        ],
        currentDim,
        (newDim) => {
          currentDim = newDim;
          currentValue = pickBestValue(currentEvalId, currentDim, currentValue);
          updateChart();
        },
      );
      presentationControlContainer.append(dimRadioGroup);
    }

    const availableValues = getValuesFor(currentEvalId, currentDim);
    const matchedValue = availableValues.find((v) => Math.abs(v - currentValue) < 1e-6);
    if (matchedValue !== undefined) {
      currentValue = matchedValue;
    } else {
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

    // Prepare plot data
    const prep = preparePredictionDistributionPlotData(
      spec,
      currentEvalId,
      currentDim,
      currentValue,
      digits,
    );

    const {
      cutoff,
      cutoffX,
      xAxisLabel,
      yAxisLabel,
      yMax,
      totalN,
      performanceMetrics,
      confusion,
      ordinaryPlotData,
    } = prep;

    const cellColors = resolveConfusionCellColors(
      theme.predictionDistribution,
      currentConditioning,
    );

    legendDiv.replaceChildren();
    if (currentColorMode === "observed_outcome") {
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
    }

    const marks: Plot.Markish[] = [];

    const cutoffTextLabel =
      currentDim === "probability_threshold"
        ? `Cutoff = ${cutoff.toFixed(digits)}`
        : `PPCR = ${currentValue.toFixed(digits)}`;

    const effectiveYMax = currentDisplayMode === "mirrored" ? yMax : yMax;
    const effectiveYMin = currentDisplayMode === "mirrored" ? -yMax : 0;

    marks.push(
      Plot.ruleX([cutoffX], {
        stroke: theme.axis.color,
        strokeWidth: 2,
        strokeDasharray: "4,3",
      }),
    );

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
          y: effectiveYMax,
          text: "label",
          dy: -10,
          fill: theme.axis.color,
          fontSize: 11,
          fontWeight: 700,
        },
      ),
    );

    if (currentDisplayMode === "mirrored") {
      marks.push(
        Plot.ruleY([0], {
          stroke: theme.axis.color,
          strokeWidth: 1.5,
        }),
      );
    }

    const getDatumFillAndOpacity = (d: (typeof ordinaryPlotData)[0]) => {
      let fill = "";
      if (currentColorMode === "observed_outcome") {
        fill =
          d.category === "Observed Positives"
            ? theme.predictionDistribution.observedPositive
            : theme.predictionDistribution.observedNegative;
      } else {
        switch (d.classificationCell) {
          case "TP":
            fill = cellColors.tp;
            break;
          case "FP":
            fill = cellColors.fp;
            break;
          case "TN":
            fill = cellColors.tn;
            break;
          case "FN":
            fill = cellColors.fn;
            break;
        }
      }

      let isEmphasized = true;
      switch (currentConditioning) {
        case "all_observations":
          isEmphasized = true;
          break;
        case "predicted_positives":
          isEmphasized = d.isPredictedPositive;
          break;
        case "predicted_negatives":
          isEmphasized = !d.isPredictedPositive;
          break;
        case "real_positives":
          isEmphasized = d.category === "Observed Positives";
          break;
        case "real_negatives":
          isEmphasized = d.category === "Observed Negatives";
          break;
      }

      return {
        fill,
        fillOpacity: isEmphasized ? 0.88 : 0.18,
        strokeOpacity: isEmphasized ? 0.4 : 0.1,
      };
    };

    if (currentDisplayMode === "stacked") {
      const styledData = ordinaryPlotData.map((d) => {
        const { fill, fillOpacity, strokeOpacity } = getDatumFillAndOpacity(d);
        return { ...d, fill, fillOpacity, strokeOpacity };
      });

      marks.push(
        Plot.rectY(
          styledData,
          Plot.stackY({
            x1: "x1",
            x2: "x2",
            y: "count",
            fill: "fill",
            fillOpacity: "fillOpacity",
            stroke: theme.axis.color,
            strokeOpacity: "strokeOpacity",
            strokeWidth: 0.75,
            title: (d) => d.title,
            tip: true,
          }),
        ),
      );
    } else {
      const posData = ordinaryPlotData
        .filter((d) => d.category === "Observed Positives")
        .map((d) => {
          const { fill, fillOpacity, strokeOpacity } = getDatumFillAndOpacity(d);
          return { ...d, fill, fillOpacity, strokeOpacity };
        });

      const negData = ordinaryPlotData
        .filter((d) => d.category === "Observed Negatives")
        .map((d) => {
          const { fill, fillOpacity, strokeOpacity } = getDatumFillAndOpacity(d);
          return { ...d, fill, fillOpacity, strokeOpacity };
        });

      if (posData.length > 0) {
        marks.push(
          Plot.rectY(posData, {
            x1: "x1",
            x2: "x2",
            y1: 0,
            y2: "count",
            fill: "fill",
            fillOpacity: "fillOpacity",
            stroke: theme.axis.color,
            strokeOpacity: "strokeOpacity",
            strokeWidth: 0.75,
            title: (d) => d.title,
            tip: true,
          }),
        );
      }

      if (negData.length > 0) {
        marks.push(
          Plot.rectY(negData, {
            x1: "x1",
            x2: "x2",
            y1: 0,
            y2: (d) => -d.count,
            fill: "fill",
            fillOpacity: "fillOpacity",
            stroke: theme.axis.color,
            strokeOpacity: "strokeOpacity",
            strokeWidth: 0.75,
            title: (d) => d.title,
            tip: true,
          }),
        );
      }
    }

    const plotSpec = {
      width: theme.width,
      height: Math.round(theme.height * 0.68),
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
        domain: [effectiveYMin, effectiveYMax],
        grid: false,
        line: true,
        ticks: 5,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
        tickFormat: (d: number) => String(Math.abs(d)),
      },
      marks,
    };

    const chartSvg = themedPlot(plotSpec, theme);
    chartDiv.replaceChildren(chartSvg);

    summaryDiv.replaceChildren();

    // Render Confusion Matrix Table matching Performance Table visual grammar
    if (confusion) {
      const { tp, fp, tn, fn, totalPositives, totalNegatives, totalPredictedPos, totalPredictedNeg } = confusion;

      const table = document.createElement("table");
      table.className = "rtichoke-pd-matrix";

      // Enforce equal column widths for data columns
      const colGroup = document.createElement("colgroup");
      const colControl = document.createElement("col");
      colControl.style.width = "28%";
      const colData1 = document.createElement("col");
      colData1.style.width = "24%";
      const colData2 = document.createElement("col");
      colData2.style.width = "24%";
      const colData3 = document.createElement("col");
      colData3.style.width = "24%";
      colGroup.append(colControl, colData1, colData2, colData3);
      table.append(colGroup);

      const createCondRadioLabel = (
        val: PredictionDistributionConditioning,
        label: string,
      ) => {
        const labelEl = document.createElement("label");
        labelEl.className = `rtichoke-pd-cond-option ${
          currentConditioning === val ? "rtichoke-pd-cond-option--active" : ""
        }`;

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `pd-cond-${instanceId}`;
        radio.value = val;
        radio.checked = currentConditioning === val;

        radio.addEventListener("change", () => {
          if (radio.checked) {
            currentConditioning = val;
            updateChart();
          }
        });

        const span = document.createElement("span");
        span.textContent = label;

        labelEl.append(radio, span);
        return labelEl;
      };

      const thead = document.createElement("thead");
      const trH = document.createElement("tr");

      const thCorner = document.createElement("th");
      thCorner.className = "rtichoke-pd-matrix__corner";
      thCorner.append(createCondRadioLabel("all_observations", "All Observations"));

      const thRealPos = document.createElement("th");
      thRealPos.className = `rtichoke-pd-matrix__col-header ${
        currentConditioning === "real_positives" ? "rtichoke-pd-matrix__col-header--active" : ""
      }`;
      thRealPos.append(createCondRadioLabel("real_positives", "Real Positive"));

      const thRealNeg = document.createElement("th");
      thRealNeg.className = `rtichoke-pd-matrix__col-header ${
        currentConditioning === "real_negatives" ? "rtichoke-pd-matrix__col-header--active" : ""
      }`;
      thRealNeg.append(createCondRadioLabel("real_negatives", "Real Negative"));

      // NO visible "Total" label on rightmost column header
      const thTot = document.createElement("th");
      thTot.className = "rtichoke-pd-matrix__col-header rtichoke-pd-matrix__col-header--blank";

      trH.append(thCorner, thRealPos, thRealNeg, thTot);
      thead.append(trH);

      const tbody = document.createElement("tbody");

      // Cell colors based on Color Bars By choice:
      const cellTpColor =
        currentColorMode === "observed_outcome"
          ? theme.predictionDistribution.observedPositive
          : cellColors.tp;
      const cellFnColor =
        currentColorMode === "observed_outcome"
          ? theme.predictionDistribution.observedPositive
          : cellColors.fn;
      const cellFpColor =
        currentColorMode === "observed_outcome"
          ? theme.predictionDistribution.observedNegative
          : cellColors.fp;
      const cellTnColor =
        currentColorMode === "observed_outcome"
          ? theme.predictionDistribution.observedNegative
          : cellColors.tn;

      // Stable Marginal Colors:
      const realPosMarginColor = theme.predictionDistribution.observedPositive;
      const realNegMarginColor = theme.predictionDistribution.observedNegative;
      const neutralMarginColor = "#E5E7EB";

      // Helper for conditional percentages:
      // Computes formatted percentage or null if suppressed
      const getPercentageText = (
        cellType: "TP" | "FP" | "TN" | "FN",
      ): string | null => {
        if (totalN === 0) return null;
        switch (currentConditioning) {
          case "all_observations": {
            const count =
              cellType === "TP"
                ? tp
                : cellType === "FP"
                  ? fp
                  : cellType === "TN"
                    ? tn
                    : fn;
            return `(${(count / totalN * 100).toFixed(1)}%)`;
          }
          case "predicted_positives": {
            const denom = tp + fp;
            if (denom === 0) return null;
            if (cellType === "TP") return `(${(tp / denom * 100).toFixed(1)}%)`;
            if (cellType === "FP") return `(${(fp / denom * 100).toFixed(1)}%)`;
            return null; // Suppress percentages in Predicted Negative row
          }
          case "predicted_negatives": {
            const denom = tn + fn;
            if (denom === 0) return null;
            if (cellType === "TN") return `(${(tn / denom * 100).toFixed(1)}%)`;
            if (cellType === "FN") return `(${(fn / denom * 100).toFixed(1)}%)`;
            return null; // Suppress percentages in Predicted Positive row
          }
          case "real_positives": {
            const denom = tp + fn;
            if (denom === 0) return null;
            if (cellType === "TP") return `(${(tp / denom * 100).toFixed(1)}%)`;
            if (cellType === "FN") return `(${(fn / denom * 100).toFixed(1)}%)`;
            return null; // Suppress percentages in Real Negative column
          }
          case "real_negatives": {
            const denom = tn + fp;
            if (denom === 0) return null;
            if (cellType === "TN") return `(${(tn / denom * 100).toFixed(1)}%)`;
            if (cellType === "FP") return `(${(fp / denom * 100).toFixed(1)}%)`;
            return null; // Suppress percentages in Real Positive column
          }
        }
      };

      // Helper for rendering stable cell layout:
      // Fixed semantic label region [TP/FP/TN/FN] + right-aligned count/percentage
      const renderInteriorCell = (
        td: HTMLTableCellElement,
        labelStr: "TP" | "FP" | "TN" | "FN",
        countVal: number,
        barColor: string,
      ) => {
        td.replaceChildren();
        td.className = `rtichoke-prediction-distribution__cell--${labelStr.toLowerCase()} rtichoke-pd-matrix__cell`;
        td.style.backgroundColor = "#ffffff";
        td.style.color = theme.axis.color;

        const pctWidth = totalN > 0 ? (countVal / totalN) * 100 : 0;

        const bar = document.createElement("div");
        bar.className = "rtichoke-pd-cell-bar";
        bar.style.width = `${pctWidth}%`;
        bar.style.backgroundColor = barColor;

        const content = document.createElement("div");
        content.className = "rtichoke-pd-cell-content";

        const labelSpan = document.createElement("span");
        labelSpan.className = "rtichoke-pd-cell-label";
        labelSpan.textContent = labelStr;

        const numDiv = document.createElement("div");
        numDiv.className = "rtichoke-pd-cell-num";

        const countSpan = document.createElement("span");
        countSpan.className = "rtichoke-pd-cell-count";
        countSpan.textContent = countVal.toLocaleString();

        const pctText = getPercentageText(labelStr);
        const pctSpan = document.createElement("span");
        pctSpan.className = "rtichoke-pd-cell-pct";
        pctSpan.textContent = pctText ?? "";

        numDiv.append(countSpan, pctSpan);
        content.append(labelSpan, numDiv);
        td.append(bar, content);
      };

      const renderMarginCell = (
        td: HTMLTableCellElement,
        countVal: number,
        barColor: string,
      ) => {
        td.replaceChildren();
        td.className = "rtichoke-prediction-distribution__cell--total rtichoke-pd-matrix__cell";
        td.style.backgroundColor = "#ffffff";

        const pctWidth = totalN > 0 ? (countVal / totalN) * 100 : 0;

        const bar = document.createElement("div");
        bar.className = "rtichoke-pd-cell-bar";
        bar.style.width = `${pctWidth}%`;
        bar.style.backgroundColor = barColor;

        const content = document.createElement("div");
        content.className = "rtichoke-pd-cell-content rtichoke-pd-cell-content--margin";

        const countSpan = document.createElement("span");
        countSpan.className = "rtichoke-pd-cell-count";
        countSpan.textContent = countVal.toLocaleString();

        content.append(countSpan);
        td.append(bar, content);
      };

      // Predicted Positive Row
      const trPredPos = document.createElement("tr");
      if (currentConditioning === "predicted_positives") {
        trPredPos.className = "rtichoke-pd-matrix__row--active";
      }

      const thPredPos = document.createElement("th");
      thPredPos.className = `rtichoke-pd-matrix__row-header ${
        currentConditioning === "predicted_positives" ? "rtichoke-pd-matrix__row-header--active" : ""
      }`;
      thPredPos.append(createCondRadioLabel("predicted_positives", "Predicted Positive"));

      const tdTp = document.createElement("td");
      renderInteriorCell(tdTp, "TP", tp, cellTpColor);

      const tdFp = document.createElement("td");
      renderInteriorCell(tdFp, "FP", fp, cellFpColor);

      const tdTotPredPos = document.createElement("td");
      renderMarginCell(tdTotPredPos, totalPredictedPos, neutralMarginColor);

      trPredPos.append(thPredPos, tdTp, tdFp, tdTotPredPos);

      // Predicted Negative Row
      const trPredNeg = document.createElement("tr");
      if (currentConditioning === "predicted_negatives") {
        trPredNeg.className = "rtichoke-pd-matrix__row--active";
      }

      const thPredNeg = document.createElement("th");
      thPredNeg.className = `rtichoke-pd-matrix__row-header ${
        currentConditioning === "predicted_negatives" ? "rtichoke-pd-matrix__row-header--active" : ""
      }`;
      thPredNeg.append(createCondRadioLabel("predicted_negatives", "Predicted Negative"));

      const tdFn = document.createElement("td");
      renderInteriorCell(tdFn, "FN", fn, cellFnColor);

      const tdTn = document.createElement("td");
      renderInteriorCell(tdTn, "TN", tn, cellTnColor);

      const tdTotPredNeg = document.createElement("td");
      renderMarginCell(tdTotPredNeg, totalPredictedNeg, neutralMarginColor);

      trPredNeg.append(thPredNeg, tdFn, tdTn, tdTotPredNeg);

      // Total Row (NO visible "Total" label on bottom header)
      const trTot = document.createElement("tr");
      trTot.className = "rtichoke-pd-matrix__tot-row";

      const thTotLabel = document.createElement("th");
      thTotLabel.className = "rtichoke-pd-matrix__row-header rtichoke-pd-matrix__row-header--blank";

      const tdTotRealPos = document.createElement("td");
      renderMarginCell(tdTotRealPos, totalPositives, realPosMarginColor);

      const tdTotRealNeg = document.createElement("td");
      renderMarginCell(tdTotRealNeg, totalNegatives, realNegMarginColor);

      const tdTotN = document.createElement("td");
      renderMarginCell(tdTotN, totalN, neutralMarginColor);

      trTot.append(thTotLabel, tdTotRealPos, tdTotRealNeg, tdTotN);

      tbody.append(trPredPos, trPredNeg, trTot);
      table.append(thead, tbody);

      summaryDiv.append(table);
    }

    // Render Performance Metrics Readout reusing Performance Table design vocabulary
    if (performanceMetrics) {
      const metricsContainer = document.createElement("div");
      metricsContainer.className = "rtichoke-pd-metrics-container rtichoke-performance-table";

      const metricsTable = document.createElement("table");
      metricsTable.className = "rtichoke-performance-table__table rtichoke-pd-metrics-table";

      const mHead = document.createElement("thead");
      const mHeadRow = document.createElement("tr");

      const metricDefs = [
        { id: "sensitivity", label: "Sensitivity", val: performanceMetrics.sensitivity, isEmphasized: currentConditioning === "real_positives", isRatio: false },
        { id: "specificity", label: "Specificity", val: performanceMetrics.specificity, isEmphasized: currentConditioning === "real_negatives", isRatio: false },
        { id: "ppv", label: "PPV", val: performanceMetrics.ppv, isEmphasized: currentConditioning === "predicted_positives", isRatio: false },
        { id: "npv", label: "NPV", val: performanceMetrics.npv, isEmphasized: currentConditioning === "predicted_negatives", isRatio: false },
        { id: "lift", label: "Lift", val: performanceMetrics.lift, isEmphasized: currentConditioning === "predicted_positives", isRatio: true },
      ];

      for (const m of metricDefs) {
        const th = document.createElement("th");
        th.className = `rtichoke-performance-table__metric-header ${
          m.isEmphasized ? "rtichoke-pd-metric--emphasized-header" : ""
        }`;
        th.textContent = m.label;
        mHeadRow.append(th);
      }
      mHead.append(mHeadRow);

      const mBody = document.createElement("tbody");
      const mBodyRow = document.createElement("tr");

      for (const m of metricDefs) {
        const td = document.createElement("td");
        td.className = `rtichoke-performance-table__metric ${
          m.isEmphasized ? "rtichoke-pd-metric--emphasized-cell" : ""
        }`;

        let text = "—";
        if (m.val !== null && m.val !== undefined) {
          text = m.isRatio ? m.val.toFixed(2) : (m.val * 100).toFixed(1) + "%";
        }

        if (m.val !== null && m.val !== undefined && isFinite(m.val)) {
          const bar = document.createElement("div");
          bar.className = "rtichoke-performance-table__bar";

          const fill = document.createElement("div");
          fill.className = "rtichoke-performance-table__bar-fill rtichoke-performance-table__bar-fill--positive";

          // Shared Performance Table Lift scaling behavior (pct = est / maxLift * 100)
          const fillPct = m.isRatio
            ? Math.min(100, (m.val / 3) * 100)
            : Math.min(100, m.val * 100);

          fill.style.width = `${fillPct}%`;
          bar.append(fill);
          td.append(bar);
        }

        const textSpan = document.createElement("span");
        textSpan.className = "rtichoke-performance-table__cell-text";
        textSpan.textContent = text;
        td.append(textSpan);

        mBodyRow.append(td);
      }

      mBody.append(mBodyRow);
      metricsTable.append(mHead, mBody);
      metricsContainer.append(metricsTable);

      summaryDiv.append(metricsContainer);
    }
  };

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
