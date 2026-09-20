import * as Plot from "@observablehq/plot";
import { select, pointer } from "d3-selection";
import type { CalibrationV2Spec } from "../spec/v2/calibration.js";
import type { DecisionCurveV2Spec } from "../spec/v2/decision-curve.js";
import type { GainsV2Spec } from "../spec/v2/gains.js";
import type { InterventionsAvoidedV2Spec } from "../spec/v2/interventions-avoided.js";
import type { LiftV2Spec } from "../spec/v2/lift.js";
import type { PrecisionRecallV2Spec } from "../spec/v2/precision_recall.js";
import type { RocV2Spec } from "../spec/v2/roc.js";
import type { PerformanceMetricId, PerformanceMetricValue } from "../spec/v2/performance-table.js";
import { assertV2ReferentialIntegrity } from "../spec/v2/validate.js";


export const RTICHOKE_COLORS = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#07004D",
  "#E6AB02",
  "#FE5F55",
  "#54494B",
  "#006E90",
  "#BC96E6",
] as const;

export interface PredictionDistributionThemeOptions {
  emphasizedTrue?: string;
  nonEmphasizedTrue?: string;
  emphasizedFalse?: string;
  nonEmphasizedFalse?: string;
  observedPositive?: string;
  observedNegative?: string;
}

export interface PredictionDistributionTheme {
  emphasizedTrue: string;
  nonEmphasizedTrue: string;
  emphasizedFalse: string;
  nonEmphasizedFalse: string;
  observedPositive: string;
  observedNegative: string;
}

export interface V2RendererTheme {
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  background: string;
  frame: { color: string; width: number };
  typography: {
    fontFamily: string;
    fontSize: number;
    axisTitleSize: number;
    axisTitleWeight: number;
    legendSize: number;
  };
  axis: {
    color: string;
    tickSize: number;
    tickPadding: number;
    ticks: number;
    numberFormat: string;
  };
  colors: readonly string[];
  line: { width: number; dash: string | null };
  marker: {
    radius: number;
    fill: string | null;
    stroke: string;
    strokeWidth: number;
  };
  reference: { color: string; width: number; dash: string };
  legend: { position: "top"; swatchWidth: number; columns: number | null };
  tip: { digits: number };
  predictionDistribution: PredictionDistributionTheme;
}

export type V2ThemeOptions = {
  margins?: Partial<V2RendererTheme["margins"]>;
  frame?: Partial<V2RendererTheme["frame"]>;
  typography?: Partial<V2RendererTheme["typography"]>;
  axis?: Partial<V2RendererTheme["axis"]>;
  line?: Partial<V2RendererTheme["line"]>;
  marker?: Partial<V2RendererTheme["marker"]>;
  reference?: Partial<V2RendererTheme["reference"]>;
  legend?: Partial<V2RendererTheme["legend"]>;
  tip?: Partial<V2RendererTheme["tip"]>;
  background?: string;
  predictionDistribution?: PredictionDistributionThemeOptions;
};

export interface V2RenderOptions {
  width?: number;
  height?: number;
  colors?: readonly string[];
  theme?: V2ThemeOptions;
  allGroups?: readonly string[];
  showLegend?: boolean;
}

export const RTICHOKE_BROWSER_THEME: V2RendererTheme = {
  width: 600,
  height: 500,
  margins: { top: 28, right: 28, bottom: 58, left: 66 },
  background: "#ffffff",
  frame: { color: "#444444", width: 1 },
  typography: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 12,
    axisTitleSize: 14,
    axisTitleWeight: 400,
    legendSize: 12,
  },
  axis: {
    color: "#444444",
    tickSize: 5,
    tickPadding: 7,
    ticks: 6,
    numberFormat: ".1f",
  },
  colors: RTICHOKE_COLORS,
  line: { width: 2, dash: null },
  marker: { radius: 2.5, fill: null, stroke: "#ffffff", strokeWidth: 0.5 },
  reference: { color: "#BEBEBE", width: 1.5, dash: "2,3" },
  legend: { position: "top", swatchWidth: 12, columns: null },
  tip: { digits: 3 },
  predictionDistribution: {
    emphasizedTrue: "#009E73",
    nonEmphasizedTrue: "#F4FFF0",
    emphasizedFalse: "#FAC8CD",
    nonEmphasizedFalse: "#FFF7F8",
    observedPositive: "#4C5454",
    observedNegative: "#E0E0E0",
  },
};

export interface ResolvedV2RenderOptions {
  theme: V2RendererTheme;
  groups: readonly string[];
  colors: readonly string[];
  colorByGroup: ReadonlyMap<string, string>;
  showLegend: boolean;
}

function mergeTheme(options: V2RenderOptions): V2RendererTheme {
  const custom = options.theme ?? {};
  return {
    ...RTICHOKE_BROWSER_THEME,
    width: options.width ?? RTICHOKE_BROWSER_THEME.width,
    height: options.height ?? RTICHOKE_BROWSER_THEME.height,
    background: custom.background ?? RTICHOKE_BROWSER_THEME.background,
    colors: options.colors ?? RTICHOKE_BROWSER_THEME.colors,
    margins: { ...RTICHOKE_BROWSER_THEME.margins, ...custom.margins },
    frame: { ...RTICHOKE_BROWSER_THEME.frame, ...custom.frame },
    typography: { ...RTICHOKE_BROWSER_THEME.typography, ...custom.typography },
    axis: { ...RTICHOKE_BROWSER_THEME.axis, ...custom.axis },
    line: { ...RTICHOKE_BROWSER_THEME.line, ...custom.line },
    marker: { ...RTICHOKE_BROWSER_THEME.marker, ...custom.marker },
    reference: { ...RTICHOKE_BROWSER_THEME.reference, ...custom.reference },
    legend: { ...RTICHOKE_BROWSER_THEME.legend, ...custom.legend },
    tip: { ...RTICHOKE_BROWSER_THEME.tip, ...custom.tip },
    predictionDistribution: {
      ...RTICHOKE_BROWSER_THEME.predictionDistribution,
      ...custom.predictionDistribution,
    },
  };
}

export function resolveV2RenderOptions(
  groupsOrCount: readonly string[] | number,
  options: V2RenderOptions = {},
): ResolvedV2RenderOptions {
  const allGroups =
    options.allGroups ??
    (typeof groupsOrCount === "number"
      ? Array.from(
          { length: groupsOrCount },
          (_, index) => `group-${index + 1}`,
        )
      : [...groupsOrCount]);

  const theme = mergeTheme(options);
  if (
    !Number.isFinite(theme.width) ||
    theme.width <= 0 ||
    !Number.isFinite(theme.height) ||
    theme.height <= 0
  )
    throw new Error(
      "Renderer width and height must be positive finite numbers",
    );
  if (
    !Number.isInteger(theme.tip.digits) ||
    theme.tip.digits < 0 ||
    theme.tip.digits > 20
  )
    throw new Error("Renderer tip digits must be an integer between 0 and 20");

  const colors = allGroups.length <= 1 ? ["#000000"] : [...theme.colors];
  if (colors.length < allGroups.length)
    throw new Error(
      "Renderer colors must contain at least one color per display group",
    );
  const assigned = colors.slice(0, Math.max(allGroups.length, 1));
  const showLegend = options.showLegend ?? allGroups.length > 1;

  return {
    theme: { ...theme, colors: assigned },
    groups: allGroups,
    colors: assigned,
    colorByGroup: new Map(
      allGroups.map((group, index) => [group, assigned[index]]),
    ),
    showLegend,
  };
}

type SeriesChartSpec =
  | RocV2Spec
  | CalibrationV2Spec
  | PrecisionRecallV2Spec
  | GainsV2Spec
  | LiftV2Spec;

export type OperatingPointSupportedSpec = (
  | RocV2Spec
  | PrecisionRecallV2Spec
  | GainsV2Spec
  | LiftV2Spec
  | DecisionCurveV2Spec
  | InterventionsAvoidedV2Spec
) & {
  operatingPoint?: {
    dimension: "probability_threshold" | "ppcr";
  };
};

export function extractOperatingPointValues(
  spec: OperatingPointSupportedSpec,
): number[] {
  if (!spec.operatingPoint) return [];
  const dim = spec.operatingPoint.dimension;
  const key =
    dim === "probability_threshold"
      ? spec.type === "decision_curve" || spec.type === "interventions_avoided"
        ? "threshold"
        : "cutoff"
      : "ppcr";

  if (dim === "probability_threshold") {
    // Probability threshold domain policy: exact common/intersection domain across all active series.
    // Consumers generate aligned threshold grids, so taking exact intersection guarantees that
    // every selectable threshold exists in every active series.
    const seriesIds = spec.series.map((s) => s.id);
    if (seriesIds.length === 0) return [];

    let intersectionSet: Set<number> | null = null;
    for (const id of seriesIds) {
      const sData = spec.data.filter((datum) => datum.seriesId === id);
      const sValues = sData
        .map((datum) => (datum as Record<string, unknown>)[key])
        .filter(
          (val): val is number => typeof val === "number" && Number.isFinite(val),
        );
      const sSet = new Set(sValues);
      if (intersectionSet === null) {
        intersectionSet = sSet;
      } else {
        const currentIntersection: Set<number> = intersectionSet;
        intersectionSet = new Set(
          Array.from(currentIntersection).filter((val: number) => sSet.has(val)),
        );
      }
    }
    return Array.from(intersectionSet ?? []).sort((a, b) => a - b);
  } else {
    // PPCR domain policy: retain exact supplied union domain.
    // PPCR values naturally differ across models/populations, so exact intersection would frequently
    // collapse to 0 or 1 point. Selecting a PPCR value highlights matching points for series containing it.
    const rawValues = spec.data
      .map((datum) => (datum as Record<string, unknown>)[key])
      .filter(
        (val): val is number => typeof val === "number" && Number.isFinite(val),
      );
    const uniqueSorted = [...new Set(rawValues)].sort((a, b) => a - b);
    return uniqueSorted;
  }
}

export function selectOperatingPointValue(
  values: number[],
  preferredValue?: number,
): number | undefined {
  if (values.length === 0) return undefined;
  if (preferredValue !== undefined && values.includes(preferredValue)) {
    return preferredValue;
  }
  return values[0];
}

export function filterSpecByGroups<T extends OperatingPointSupportedSpec>(
  spec: T,
  activeGroups: Set<string>,
): T {
  const visibleSeries = spec.series.filter((s) => activeGroups.has(s.display.group));
  const visibleSeriesIds = new Set(visibleSeries.map((s) => s.id));
  return {
    ...spec,
    series: visibleSeries,
    data: spec.data.filter((d) => visibleSeriesIds.has(d.seriesId)),
  } as T;
}

export function renderWithLegendFiltering<T extends OperatingPointSupportedSpec>(
  spec: T,
  options: V2RenderOptions,
  render: (
    filteredSpec: T,
    opts: V2RenderOptions,
    preferredOpVal?: number,
    onOpValChange?: (val: number) => void,
  ) => SVGSVGElement | HTMLElement,
  preferredValue?: number,
  onValueChange?: (val: number) => void,
): SVGSVGElement | HTMLElement {
  const allGroups = displayGroups(spec as any);
  let currentOpVal = preferredValue;

  // If single-series or no groups, delegate directly to child render without legend UI
  if (allGroups.length <= 1) {
    return render(spec, options, currentOpVal, (val) => {
      currentOpVal = val;
      if (onValueChange) onValueChange(val);
    });
  }

  // Multi-series: build custom HTML legend
  const childOptions: V2RenderOptions = {
    ...options,
    allGroups,
    showLegend: false,
  };

  const resolved = resolveV2RenderOptions(allGroups, childOptions);
  const { theme, colorByGroup } = resolved;
  const labelByGroup = new Map(spec.series.map((s) => [s.display.group, s.display.label]));

  // Track active visible groups
  const activeGroups = new Set(allGroups);

  const container = document.createElement("div");
  container.className = "rtichoke-legend-chart";
  container.style.maxWidth = `${theme.width}px`;

  const legendNav = document.createElement("div");
  legendNav.className = "rtichoke-legend";
  legendNav.style.paddingLeft = `${theme.margins.left}px`;
  legendNav.setAttribute("aria-label", "Chart legend");

  const buttonsByGroup = new Map<string, HTMLButtonElement>();

  allGroups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rtichoke-legend-item";
    btn.setAttribute("aria-pressed", "true");
    const groupLabel = labelByGroup.get(group) ?? group;
    btn.setAttribute("aria-label", `Toggle series ${groupLabel}`);

    const swatch = document.createElement("span");
    swatch.className = "rtichoke-legend-swatch";

    const lineSpan = document.createElement("span");
    lineSpan.className = "rtichoke-legend-line";
    lineSpan.style.backgroundColor = colorByGroup.get(group) ?? "#000000";

    swatch.append(lineSpan);

    const labelSpan = document.createElement("span");
    labelSpan.className = "rtichoke-legend-label";
    labelSpan.textContent = groupLabel;

    btn.append(swatch, labelSpan);
    legendNav.append(btn);
    buttonsByGroup.set(group, btn);
  });

  const contentArea = document.createElement("div");
  contentArea.className = "rtichoke-legend-content";

  const updateChart = () => {
    const filteredSpec = filterSpecByGroups(spec, activeGroups);
    const chartContent = render(filteredSpec, childOptions, currentOpVal, (val) => {
      currentOpVal = val;
      if (onValueChange) onValueChange(val);
    });
    contentArea.replaceChildren(chartContent);
  };

  allGroups.forEach((group) => {
    const btn = buttonsByGroup.get(group)!;
    btn.addEventListener("click", () => {
      const isCurrentlyActive = activeGroups.has(group);
      if (isCurrentlyActive) {
        // Zero-visible-series rule: prevent hiding the final visible series
        if (activeGroups.size <= 1) {
          return;
        }
        activeGroups.delete(group);
        btn.setAttribute("aria-pressed", "false");
      } else {
        activeGroups.add(group);
        btn.setAttribute("aria-pressed", "true");
      }

      updateChart();
    });
  });

  container.append(legendNav, contentArea);
  updateChart();
  return container;
}

export function renderWithOperatingPointSelection<
  T extends OperatingPointSupportedSpec,
>(
  spec: T,
  options: V2RenderOptions,
  render: (
    selectedSpec: T,
    selectedValue?: number,
  ) => SVGSVGElement | HTMLElement,
  preferredValue?: number,
  onValueChange?: (val: number) => void,
): SVGSVGElement | HTMLElement {
  if (!spec.operatingPoint) return render(spec, undefined);

  const values = extractOperatingPointValues(spec);
  if (values.length === 0) return render(spec, undefined);

  const resolved = resolveV2RenderOptions(displayGroups(spec as any), options);
  const { theme } = resolved;

  const container = document.createElement("div");
  container.className = "rtichoke-operating-point-chart";
  container.style.maxWidth = `${theme.width}px`;

  const control = document.createElement("div");
  control.className = "rtichoke-operating-point-control";
  control.style.marginLeft = `${theme.margins.left}px`;
  control.style.marginRight = `${theme.margins.right}px`;

  const ariaLabelText =
    spec.operatingPoint.dimension === "probability_threshold"
      ? "Probability threshold"
      : "Predicted positives condition rate (PPCR)";

  const visibleLabelText =
    spec.operatingPoint.dimension === "probability_threshold"
      ? "Probability threshold"
      : "PPCR";

  const label = document.createElement("label");
  label.className = "rtichoke-operating-point-label";

  const labelSpan = document.createElement("span");
  labelSpan.textContent = `${visibleLabelText}: `;

  const valueSpan = document.createElement("span");
  valueSpan.className = "rtichoke-operating-point-value";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "rtichoke-operating-point-slider";
  slider.min = "0";
  slider.max = String(values.length - 1);
  slider.step = "1";
  slider.setAttribute("aria-label", ariaLabelText);

  let selectedIndex = 0;
  if (preferredValue !== undefined) {
    const matchIdx = values.indexOf(preferredValue);
    if (matchIdx !== -1) {
      selectedIndex = matchIdx;
    }
  }

  const selectedValue = values[selectedIndex];
  slider.value = String(selectedIndex);
  const formattedVal = selectedValue.toFixed(theme.tip.digits);
  valueSpan.textContent = formattedVal;
  slider.setAttribute("aria-valuetext", formattedVal);
  if (onValueChange) {
    onValueChange(selectedValue);
  }

  label.append(labelSpan, valueSpan);
  control.append(label, slider);

  const chart = document.createElement("div");
  chart.className = "rtichoke-operating-point-content";

  const draw = (val: number) => {
    chart.replaceChildren(render(spec, val));
  };

  slider.addEventListener("input", () => {
    const idx = Number(slider.value);
    const val = values[idx];
    const valFormatted = val.toFixed(theme.tip.digits);
    valueSpan.textContent = valFormatted;
    slider.setAttribute("aria-valuetext", valFormatted);
    if (onValueChange) {
      onValueChange(val);
    }
    draw(val);
  });

  container.append(chart, control);
  draw(selectedValue);
  return container;
}

function displayBySeries(spec: SeriesChartSpec) {
  return new Map(spec.series.map((series) => [series.id, series.display]));
}
function displayGroups(spec: SeriesChartSpec) {
  return [...new Set(spec.series.map((series) => series.display.group))];
}

export function seriesRenderData<T extends { seriesId: string }>(
  spec: SeriesChartSpec,
  data: T[],
) {
  const displays = displayBySeries(spec);
  return data.map((datum) => ({
    ...datum,
    group: displays.get(datum.seriesId)!.group,
    label: displays.get(datum.seriesId)!.label,
  }));
}

const METRIC_LABELS: Record<PerformanceMetricId, string> = {
  true_positives: "TP",
  true_negatives: "TN",
  false_positives: "FP",
  false_negatives: "FN",
  sensitivity: "Sensitivity",
  specificity: "Specificity",
  false_positive_rate: "FPR",
  ppv: "PPV",
  npv: "NPV",
  lift: "Lift",
  predicted_positives: "Predicted Positives",
  ppcr: "PPCR",
  net_benefit: "Net Benefit",
  net_benefit_interventions_avoided: "Interventions Avoided",
};

const INTEGER_METRICS = new Set<PerformanceMetricId>([
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
  "predicted_positives",
]);

export function formatMetricValue(
  metricId: PerformanceMetricId,
  value: number | null | undefined,
  digits: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (INTEGER_METRICS.has(metricId)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(digits);
  }
  return value.toFixed(digits);
}

export function buildCarriedPerformanceTooltipFields(
  performance: PerformanceMetricValue[] | undefined,
  metricOrder: PerformanceMetricId[],
  digits: number,
  omitSet?: Set<PerformanceMetricId>,
): Array<[string, unknown]> {
  if (!performance || performance.length === 0) return [];
  const map = new Map<PerformanceMetricId, number | null>();
  for (const item of performance) {
    if (item.estimate !== undefined && item.estimate !== null) {
      map.set(item.metricId, item.estimate);
    }
  }

  const fields: Array<[string, unknown]> = [];
  for (const metricId of metricOrder) {
    if (omitSet && omitSet.has(metricId)) continue;
    if (map.has(metricId)) {
      const val = map.get(metricId)!;
      const label = METRIC_LABELS[metricId] ?? metricId;
      const formatted = formatMetricValue(metricId, val, digits);
      if (formatted !== undefined) {
        fields.push([label, formatted]);
      }
    }
  }
  return fields;
}

export function formatNativeNumber(value: unknown, digits: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" ? value.toFixed(digits) : String(value);
}

export function tooltip(digits: number, fields: Array<[string, unknown]>) {
  return fields
    .filter(([, value]) => value !== undefined)
    .map(
      ([label, value]) =>
        `${label}: ${typeof value === "number" ? value.toFixed(digits) : String(value)}`,
    )
    .join("\n");
}

function basePlotOptions(
  resolved: ResolvedV2RenderOptions,
  spec: SeriesChartSpec,
) {
  const { theme } = resolved;
  const labelByGroup = new Map(
    spec.series.map((series) => [series.display.group, series.display.label]),
  );
  return {
    width: theme.width,
    height: theme.height,
    marginTop: theme.margins.top,
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
      legend: resolved.showLegend,
      domain: resolved.groups,
      range: resolved.colors,
      tickFormat: (group: string) => labelByGroup.get(group) ?? group,
    },
  };
}

function axisOptions(
  theme: V2RendererTheme,
  label: string,
  domain: [number, number] | undefined,
) {
  return {
    label,
    domain,
    grid: false,
    line: true,
    ticks: theme.axis.ticks,
    tickSize: theme.axis.tickSize,
    tickPadding: theme.axis.tickPadding,
    tickFormat: theme.axis.numberFormat,
  };
}

function frameMark(theme: V2RendererTheme) {
  return Plot.frame({
    stroke: theme.frame.color,
    strokeWidth: theme.frame.width,
  });
}

export function buildReferenceTooltipMarkOptions(label: string) {
  return {
    channels: {
      ch_0: { value: () => label, label: "Reference" },
    },
    tip: {
      format: { x: false, y: false, z: false, stroke: false, fill: false },
    },
  };
}

function referenceMarks(
  spec: SeriesChartSpec,
  theme: V2RendererTheme,
): Plot.Markish[] {
  const style = {
    stroke: theme.reference.color,
    strokeWidth: theme.reference.width,
    strokeDasharray: theme.reference.dash,
  };
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references ?? []) {
    if (reference.type === "identity") {
      marks.push(
        Plot.line(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          { x: "x", y: "y", ...style },
        ),
      );
    } else if (reference.type === "horizontal" && reference.value !== undefined) {
      marks.push(
        Plot.ruleY([reference.value], { ...style }),
      );
    } else if (reference.type === "path" && reference.points) {
      marks.push(
        Plot.line(reference.points, {
          x: "x",
          y: "y",
          ...style,
        }),
      );
    }
  }
  return marks;
}

function finishMarks(marks: Plot.Markish[], theme: V2RendererTheme) {
  return marks;
}

export function thinOrdinaryPoints<T>(
  data: T[],
  getSeriesId: (item: T) => string,
  targetMax = 40,
): T[] {
  const bySeries = new Map<string, T[]>();
  for (const item of data) {
    const id = getSeriesId(item);
    let list = bySeries.get(id);
    if (!list) {
      list = [];
      bySeries.set(id, list);
    }
    list.push(item);
  }

  const result: T[] = [];
  for (const list of bySeries.values()) {
    const n = list.length;
    if (n <= targetMax) {
      result.push(...list);
    } else {
      const selectedIndices = new Set<number>();
      for (let k = 0; k < targetMax; k++) {
        const idx = Math.round((k * (n - 1)) / (targetMax - 1));
        selectedIndices.add(idx);
      }
      for (const idx of selectedIndices) {
        result.push(list[idx]);
      }
    }
  }
  return result;
}

export function buildStructuredTooltipMarkOptions(
  data: Array<{ tooltipFields?: Array<[string, unknown]> }>,
  canonicalFieldOrder?: string[],
) {
  const presentLabels = new Set<string>();
  for (const d of data) {
    if (d.tooltipFields) {
      for (const [label] of d.tooltipFields) {
        presentLabels.add(label);
      }
    }
  }

  const fieldLabels: string[] = [];
  if (canonicalFieldOrder) {
    for (const label of canonicalFieldOrder) {
      if (presentLabels.has(label)) {
        fieldLabels.push(label);
        presentLabels.delete(label);
      }
    }
  }
  for (const label of presentLabels) {
    fieldLabels.push(label);
  }

  const channels: Record<string, { value: (d: any) => any; label: string }> = {};
  fieldLabels.forEach((label, idx) => {
    channels[`ch_${idx}`] = {
      value: (d: any) => {
        if (!d.tooltipFields) return undefined;
        const entry = d.tooltipFields.find(([l]: [string, unknown]) => l === label);
        return entry ? entry[1] : undefined;
      },
      label,
    };
  });

  const format: Record<string, boolean> = {
    x: false,
    y: false,
    z: false,
    stroke: false,
    fill: false,
    r: false,
  };

  return {
    channels,
    tip: { format },
  };
}

export function ordinaryPointDotMark<T extends { seriesId: string }>(
  data: T[],
  x: string,
  y: string,
  resolved: ResolvedV2RenderOptions,
  customTheme?: V2ThemeOptions,
): Plot.Markish {
  const thinned = thinOrdinaryPoints(data, (d) => d.seriesId, 40);
  const theme = resolved.theme;
  const r = customTheme?.marker?.radius ?? theme.marker.radius;
  const stroke = customTheme?.marker?.stroke ?? theme.marker.stroke;
  const strokeWidth = customTheme?.marker?.strokeWidth ?? theme.marker.strokeWidth;

  return Plot.dot(thinned, {
    ariaLabel: "ordinary-point",
    x,
    y,
    fill: "group",
    stroke,
    strokeWidth,
    r,
  });
}

export function operatingPointDotMark(
  data: any[],
  x: string,
  y: string,
  resolved: ResolvedV2RenderOptions,
  customTheme?: V2ThemeOptions,
): Plot.Markish {
  const isMultiSeries = resolved.groups.length > 1;
  const fill = customTheme?.marker?.fill ?? (isMultiSeries ? "group" : "#f6e3be");
  const stroke = customTheme?.marker?.stroke ?? "#1a1a1a";
  const strokeWidth = customTheme?.marker?.strokeWidth ?? 2.5;
  const r = customTheme?.marker?.radius ?? 6;

  return Plot.dot(data, {
    className: "rtichoke-selected-operating-point",
    x,
    y,
    fill,
    stroke,
    strokeWidth,
    r,
  });
}

export function getContrastTextColor(backgroundColor: string): string {
  let hex = backgroundColor.trim().toLowerCase();
  if (hex.startsWith("#")) {
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
    }
  }
  return "#ffffff";
}

export interface CurveHoverItem {
  seriesId: string;
  group: string;
  xValue: number;
  yValue: number;
  tooltipFields: Array<[string, unknown]>;
  backgroundColor: string;
}

export interface ReferenceHoverItem {
  type: "horizontal" | "identity" | "path";
  value?: number;
  points?: Array<{ x: number; y: number }>;
  label: string;
  backgroundColor?: string;
}

export interface InstallCurveHoverLayerOptions {
  items: CurveHoverItem[];
  selectedOperatingPointItems?: CurveHoverItem[];
  references?: ReferenceHoverItem[];
  theme: V2RendererTheme;
}

export function installCurveHoverLayer(
  plotElement: SVGSVGElement | HTMLElement,
  options: InstallCurveHoverLayerOptions,
) {
  const svgNode =
    plotElement instanceof SVGSVGElement
      ? plotElement
      : plotElement.querySelector<SVGSVGElement>("svg");
  if (!svgNode) return;

  const svg = select<SVGSVGElement, unknown>(svgNode);
  const xScale = (plotElement as any).scale?.("x") ?? (svgNode as any).scale?.("x");
  const yScale = (plotElement as any).scale?.("y") ?? (svgNode as any).scale?.("y");
  if (!xScale || !yScale) return;

  const scaledItems = options.items
    .filter((item) => Number.isFinite(item.xValue) && Number.isFinite(item.yValue))
    .map((item) => ({
      ...item,
      px: xScale.apply(item.xValue),
      py: yScale.apply(item.yValue),
    }));

  const scaledOpItems = (options.selectedOperatingPointItems ?? [])
    .filter((item) => Number.isFinite(item.xValue) && Number.isFinite(item.yValue))
    .map((item) => ({
      ...item,
      px: xScale.apply(item.xValue),
      py: yScale.apply(item.yValue),
    }));

  let tooltipGroup = svg.select<SVGGElement>("g.rtichoke-hover-tooltip");
  if (tooltipGroup.empty()) {
    tooltipGroup = svg
      .append("g")
      .attr("class", "rtichoke-hover-tooltip")
      .style("pointer-events", "none")
      .style("display", "none");

    tooltipGroup.append("rect").attr("class", "rtichoke-hover-tooltip-bg");
    tooltipGroup.append("text").attr("class", "rtichoke-hover-tooltip-text");
  }

  const rect = tooltipGroup.select<SVGRectElement>("rect.rtichoke-hover-tooltip-bg");
  const text = tooltipGroup.select<SVGTextElement>("text.rtichoke-hover-tooltip-text");

  function showTooltip(
    event: MouseEvent | PointerEvent,
    fields: Array<[string, unknown]>,
    backgroundColor: string,
  ) {
    const validFields = fields.filter(([, val]) => val !== undefined && val !== null);
    if (validFields.length === 0) return;

    const isReference = fields.length === 1 && fields[0][0] === "Reference";
    const bgFill = isReference ? "#f3f4f6" : backgroundColor;
    const fgColor = isReference ? "#1f2937" : getContrastTextColor(backgroundColor);
    const strokeColor = isReference ? "#d1d5db" : "#374151";

    text
      .attr("fill", fgColor)
      .attr("font-family", options.theme.typography.fontFamily)
      .attr("font-size", "11px");

    text.selectAll("tspan").remove();
    validFields.forEach(([label, val], idx) => {
      const tspan = text
        .append("tspan")
        .attr("dy", idx === 0 ? "1em" : "1.2em");

      tspan
        .append("tspan")
        .attr("font-weight", "bold")
        .text(`${label}: `);

      tspan
        .append("tspan")
        .attr("font-weight", "normal")
        .text(String(val));
    });

    const textNode = text.node();
    if (!textNode) return;
    const bbox = textNode.getBBox();
    const paddingX = 8;
    const paddingY = 6;
    const boxW = Math.max(bbox.width + paddingX * 2, 60);
    const boxH = bbox.height + paddingY * 2;

    const [mx, my] = pointer(event, svgNode);
    const svgW = options.theme.width;
    const svgH = options.theme.height;
    const margins = options.theme.margins;

    let posX = mx + 12;
    if (posX + boxW > svgW - margins.right) {
      posX = mx - 12 - boxW;
    }
    if (posX < margins.left) {
      posX = margins.left;
    }

    let posY = my - boxH / 2;
    if (posY < margins.top) {
      posY = margins.top;
    }
    if (posY + boxH > svgH - margins.bottom) {
      posY = svgH - margins.bottom - boxH;
    }

    select(textNode)
      .selectAll<SVGTSpanElement, unknown>("tspan")
      .filter(function () {
        return this.parentNode === textNode;
      })
      .attr("x", posX + paddingX);

    rect
      .attr("x", posX)
      .attr("y", posY)
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("fill", bgFill)
      .attr("stroke", strokeColor)
      .attr("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4)
      .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.15))");

    text.attr("x", posX + paddingX).attr("y", posY + paddingY);

    // Re-measure after positioning tspans to ensure box encompasses positioned text
    const finalBBox = textNode.getBBox();
    const finalBoxW = Math.max(finalBBox.width + paddingX * 2, 60);
    const finalBoxH = finalBBox.height + paddingY * 2;

    rect
      .attr("x", posX)
      .attr("y", posY)
      .attr("width", finalBoxW)
      .attr("height", finalBoxH);

    tooltipGroup.style("display", null);
  }

  function hideTooltip() {
    tooltipGroup.style("display", "none");
  }

  let targetsGroup = svg.select<SVGGElement>("g.rtichoke-hover-targets");
  if (!targetsGroup.empty()) {
    targetsGroup.remove();
  }
  targetsGroup = svg
    .insert<SVGGElement>("g", "g.rtichoke-hover-tooltip")
    .attr("class", "rtichoke-hover-targets");

  for (const ref of options.references ?? []) {
    const refBg = ref.backgroundColor ?? "#f3f4f6";
    const refFields: Array<[string, unknown]> = [["Reference", ref.label]];

    if (ref.type === "horizontal" && ref.value !== undefined) {
      const ry = yScale.apply(ref.value);
      targetsGroup
        .append("line")
        .attr("class", "rtichoke-hover-ref-target")
        .attr("x1", options.theme.margins.left)
        .attr("x2", options.theme.width - options.theme.margins.right)
        .attr("y1", ry)
        .attr("y2", ry)
        .attr("stroke", "transparent")
        .attr("stroke-width", 12)
        .style("pointer-events", "stroke")
        .on("pointermove", (e: MouseEvent) => showTooltip(e, refFields, refBg))
        .on("mouseleave pointerleave", hideTooltip);
    } else if (
      (ref.type === "identity" || ref.type === "path") &&
      ref.points &&
      ref.points.length > 0
    ) {
      const pathD = ref.points
        .map((p, idx) => `${idx === 0 ? "M" : "L"}${xScale.apply(p.x)},${yScale.apply(p.y)}`)
        .join(" ");
      targetsGroup
        .append("path")
        .attr("class", "rtichoke-hover-ref-target")
        .attr("d", pathD)
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 12)
        .style("pointer-events", "stroke")
        .on("pointermove", (e: MouseEvent) => showTooltip(e, refFields, refBg))
        .on("mouseleave pointerleave", hideTooltip);
    }
  }

  const itemsBySeries = new Map<string, typeof scaledItems>();
  for (const item of scaledItems) {
    let list = itemsBySeries.get(item.seriesId);
    if (!list) {
      list = [];
      itemsBySeries.set(item.seriesId, list);
    }
    list.push(item);
  }

  for (const seriesItems of itemsBySeries.values()) {
    if (seriesItems.length < 2) continue;
    const pathD = seriesItems
      .map((item, idx) => `${idx === 0 ? "M" : "L"}${item.px},${item.py}`)
      .join(" ");

    targetsGroup
      .append("path")
      .attr("class", "rtichoke-hover-line-target")
      .attr("d", pathD)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .style("pointer-events", "stroke")
      .on("pointermove", (e: MouseEvent) => {
        const [mx, my] = pointer(e, svgNode);
        let minDist = Infinity;
        let nearestItem = seriesItems[0];
        for (const item of seriesItems) {
          const dx = item.px - mx;
          const dy = item.py - my;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            nearestItem = item;
          }
        }
        showTooltip(e, nearestItem.tooltipFields, nearestItem.backgroundColor);
      })
      .on("mouseleave pointerleave", hideTooltip);
  }

  for (const item of scaledItems) {
    targetsGroup
      .append("circle")
      .attr("class", "rtichoke-hover-point-target")
      .attr("cx", item.px)
      .attr("cy", item.py)
      .attr("r", 8)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("pointermove", (e: MouseEvent) => showTooltip(e, item.tooltipFields, item.backgroundColor))
      .on("mouseleave pointerleave", hideTooltip);
  }

  for (const item of scaledOpItems) {
    targetsGroup
      .append("circle")
      .attr("class", "rtichoke-hover-op-target")
      .attr("cx", item.px)
      .attr("cy", item.py)
      .attr("r", 10)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("pointermove", (e: MouseEvent) => showTooltip(e, item.tooltipFields, item.backgroundColor))
      .on("mouseleave pointerleave", hideTooltip);
  }

  svg.on("mouseleave pointerleave", hideTooltip);
}

const DEFAULT_HISTOGRAM_HEIGHT =
  RTICHOKE_BROWSER_THEME.height -
  Math.round(RTICHOKE_BROWSER_THEME.height * 0.8);

function equalScalePlotHeight(
  width: number,
  margins: { top: number; right: number; bottom: number; left: number },
  xDomain: [number, number] = [0, 1],
  yDomain: [number, number] = [0, 1],
  marginBottom?: number,
): number {
  const innerWidth = width - margins.left - margins.right;
  const xSpan = Math.abs(xDomain[1] - xDomain[0]);
  const ySpan = Math.abs(yDomain[1] - yDomain[0]);
  const safeXSpan = Number.isFinite(xSpan) && xSpan > 0 ? xSpan : 1;
  const safeYSpan = Number.isFinite(ySpan) && ySpan > 0 ? ySpan : 1;
  const innerHeight = innerWidth * (safeYSpan / safeXSpan);
  const bottom = marginBottom ?? margins.bottom;
  return Math.round(margins.top + innerHeight + bottom);
}

export function themedPlot(options: Plot.PlotOptions, theme: V2RendererTheme) {
  const plot = Plot.plot(options);
  for (const label of plot.querySelectorAll<SVGTextElement>(
    '[aria-label$="axis label"] text',
  )) {
    label.style.fontSize = `${theme.typography.axisTitleSize}px`;
    label.style.fontWeight = String(theme.typography.axisTitleWeight);
  }
  for (const frame of plot.querySelectorAll<SVGElement>(
    '[aria-label="frame"]',
  )) {
    frame.setAttribute("stroke", theme.frame.color);
  }
  if (plot instanceof HTMLElement) {
    plot.style.fontSize = `${theme.typography.legendSize}px`;
    for (const swatch of plot.querySelectorAll<SVGSVGElement>(
      'svg[width="15"], div[class*="-swatches"] svg',
    )) {
      swatch.setAttribute("width", String(theme.legend.swatchWidth));
      swatch.setAttribute("height", "10");
    }
  }
  return plot;
}

export const ROC_CANONICAL_ORDER_THRESHOLD = [
  "Series", "Cutoff", "PPCR", "Sensitivity", "Specificity", "FPR", "False Positive Rate", "PPV", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];
export const ROC_CANONICAL_ORDER_PPCR = [
  "Series", "PPCR", "Cutoff", "Sensitivity", "Specificity", "FPR", "False Positive Rate", "PPV", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];

export const PR_CANONICAL_ORDER_THRESHOLD = [
  "Series", "Cutoff", "PPCR", "Sensitivity", "PPV", "Specificity", "FPR", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];
export const PR_CANONICAL_ORDER_PPCR = [
  "Series", "PPCR", "Cutoff", "Sensitivity", "PPV", "Specificity", "FPR", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];

export const GAINS_CANONICAL_ORDER_THRESHOLD = [
  "Series", "Cutoff", "PPCR", "Sensitivity", "Specificity", "FPR", "PPV", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];
export const GAINS_CANONICAL_ORDER_PPCR = [
  "Series", "PPCR", "Cutoff", "Sensitivity", "Specificity", "FPR", "PPV", "NPV", "Lift", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];

export const LIFT_CANONICAL_ORDER_THRESHOLD = [
  "Series", "Cutoff", "PPCR", "Lift", "Sensitivity", "Specificity", "FPR", "PPV", "NPV", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];
export const LIFT_CANONICAL_ORDER_PPCR = [
  "Series", "PPCR", "Cutoff", "Lift", "Sensitivity", "Specificity", "FPR", "PPV", "NPV", "Net Benefit", "Predicted Positives", "TP", "TN", "FP", "FN"
];

export const DCA_CANONICAL_ORDER = [
  "Series", "Threshold", "Net Benefit", "PPCR", "Sensitivity", "Specificity", "FPR", "PPV", "NPV", "Lift", "Predicted Positives", "TP", "TN", "FP", "FN"
];

export const IA_CANONICAL_ORDER = [
  "Series", "Threshold", "Interventions Avoided", "Net Benefit", "Predicted Positives", "PPCR", "TN", "FN"
];

const ROC_CARRIED_ORDER: PerformanceMetricId[] = [
  "sensitivity",
  "specificity",
  "false_positive_rate",
  "ppv",
  "npv",
  "lift",
  "net_benefit",
  "predicted_positives",
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
];

const PR_CARRIED_ORDER: PerformanceMetricId[] = [
  "sensitivity",
  "ppv",
  "specificity",
  "false_positive_rate",
  "npv",
  "lift",
  "net_benefit",
  "predicted_positives",
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
];

const GAINS_CARRIED_ORDER: PerformanceMetricId[] = [
  "sensitivity",
  "specificity",
  "false_positive_rate",
  "ppv",
  "npv",
  "lift",
  "net_benefit",
  "predicted_positives",
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
];

const LIFT_CARRIED_ORDER: PerformanceMetricId[] = [
  "lift",
  "sensitivity",
  "specificity",
  "false_positive_rate",
  "ppv",
  "npv",
  "net_benefit",
  "predicted_positives",
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
];

function renderRocChart(
  spec: RocV2Spec,
  options: V2RenderOptions = {},
  selectedOperatingPointValue?: number,
): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const resolved = resolveV2RenderOptions(displayGroups(spec), options);
  const { theme, colorByGroup } = resolved;
  const opDim = spec.operatingPoint?.dimension;
  const data = seriesRenderData(spec, spec.data).map((datum) => {
    const fpr = 1 - datum.specificity;
    const fields: Array<[string, unknown]> = [["Series", datum.label]];
    if (opDim === "ppcr") {
      if (datum.ppcr !== undefined) fields.push(["PPCR", formatNativeNumber(datum.ppcr, theme.tip.digits)]);
      fields.push(["Cutoff", formatNativeNumber(datum.cutoff, theme.tip.digits)]);
    } else {
      fields.push(["Cutoff", formatNativeNumber(datum.cutoff, theme.tip.digits)]);
      if (datum.ppcr !== undefined) fields.push(["PPCR", formatNativeNumber(datum.ppcr, theme.tip.digits)]);
    }

    if (datum.performance && datum.performance.length > 0) {
      fields.push(
        ["Sensitivity", formatNativeNumber(datum.sensitivity, theme.tip.digits)],
        ["Specificity", formatNativeNumber(datum.specificity, theme.tip.digits)],
        ["FPR", formatNativeNumber(fpr, theme.tip.digits)],
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          ROC_CARRIED_ORDER,
          theme.tip.digits,
          new Set(["sensitivity", "specificity", "false_positive_rate"]),
        ),
      );
    } else {
      fields.push(
        ["Sensitivity", formatNativeNumber(datum.sensitivity, theme.tip.digits)],
        ["Specificity", formatNativeNumber(datum.specificity, theme.tip.digits)],
        ["False Positive Rate", formatNativeNumber(fpr, theme.tip.digits)],
      );
    }

    return {
      ...datum,
      false_positive_rate: fpr,
      tooltipFields: fields,
      title: tooltip(theme.tip.digits, fields),
    };
  });

  const marks = referenceMarks(spec, theme);
  marks.push(
    Plot.line(data, {
      x: "false_positive_rate",
      y: "sensitivity",
      z: "seriesId",
      stroke: "group",
      strokeWidth: theme.line.width,
      strokeDasharray: theme.line.dash ?? undefined,
    }),
    ordinaryPointDotMark(
      data,
      "false_positive_rate",
      "sensitivity",
      resolved,
      options.theme,
    ),
  );

  let selectedPoints: typeof data = [];
  if (selectedOperatingPointValue !== undefined && spec.operatingPoint) {
    const dimField = spec.operatingPoint.dimension === "probability_threshold" ? "cutoff" : "ppcr";
    selectedPoints = data.filter((datum) => datum[dimField] === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, "false_positive_rate", "sensitivity", resolved, options.theme),
      );
    }
  }

  const xDomain = spec.xAxis.domain ?? [0, 1];
  const yDomain = spec.yAxis.domain ?? [0, 1];
  const height = equalScalePlotHeight(
    theme.width,
    theme.margins,
    xDomain,
    yDomain,
  );

  const chart = themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      height,
      x: axisOptions(theme, spec.xAxis.label, xDomain),
      y: axisOptions(theme, spec.yAxis.label, yDomain),
      marks: finishMarks(marks, theme),
    },
    theme,
  );

  const hoverItems: CurveHoverItem[] = data.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: d.false_positive_rate,
    yValue: d.sensitivity,
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const selectedOpHoverItems: CurveHoverItem[] = selectedPoints.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: d.false_positive_rate,
    yValue: d.sensitivity,
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const referenceHoverItems: ReferenceHoverItem[] = [];
  for (const ref of spec.references ?? []) {
    const label = ref.label ?? (ref.type === "identity" ? "Identity" : "Reference");
    if (ref.type === "identity") {
      referenceHoverItems.push({
        type: "identity",
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        label,
      });
    } else if (ref.type === "horizontal" && ref.value !== undefined) {
      referenceHoverItems.push({
        type: "horizontal",
        value: ref.value,
        label,
      });
    } else if (ref.type === "path" && ref.points) {
      referenceHoverItems.push({
        type: "path",
        points: ref.points,
        label,
      });
    }
  }

  installCurveHoverLayer(chart, {
    items: hoverItems,
    selectedOperatingPointItems: selectedOpHoverItems,
    references: referenceHoverItems,
    theme,
  });

  return chart;
}

export function renderRocV2(
  spec: RocV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderWithLegendFiltering(
    spec,
    options,
    (filteredSpec, opts, preferredOpVal, onOpValChange) =>
      renderWithHorizonSelection(
        filteredSpec,
        (selected, pOpVal, onOpChange) =>
          renderWithOperatingPointSelection(
            selected,
            opts,
            (specWithOp, activeOpVal) => renderRocChart(specWithOp, opts, activeOpVal),
            pOpVal,
            onOpChange,
          ),
        preferredOpVal,
        onOpValChange,
      ),
  );
}

export function renderCalibrationV2(
  spec: CalibrationV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const resolved = resolveV2RenderOptions(displayGroups(spec), options);
  const { theme } = resolved;
  const data = seriesRenderData(spec, spec.data).map((datum) => ({
    ...datum,
    title: tooltip(theme.tip.digits, [
      ["Series", datum.label],
      ["Predicted", datum.predicted],
      ["Observed", datum.observed],
      ["Events", datum.events],
      ["Total", datum.total],
    ]),
  }));
  const marks = referenceMarks(spec, theme);
  marks.push(
    Plot.line(data, {
      x: "predicted",
      y: "observed",
      z: "seriesId",
      stroke: "group",
      strokeWidth: theme.line.width,
      strokeDasharray: theme.line.dash ?? undefined,
      title: (d: any) => d.title,
      tip: true,
    }),
  );
  const discrete = data.filter((datum) => datum.method === "discrete");
  if (discrete.length > 0)
    marks.push(
      Plot.dot(discrete, {
        x: "predicted",
        y: "observed",
        fill: theme.marker.fill ?? "group",
        stroke: theme.marker.stroke,
        strokeWidth: theme.marker.strokeWidth,
        r: theme.marker.radius,
        title: (d: any) => d.title,
        tip: true,
      }),
    );
  const hasDistribution = (spec.distribution?.length ?? 0) > 0;
  const observedValues = data.map((datum) => datum.observed).filter(Number.isFinite);
  const yDomain = spec.yAxis.domain ?? [
    Math.min(0, ...observedValues),
    Math.max(1, ...observedValues),
  ];
  const xDomain = spec.xAxis.domain ?? [0, 1];
  const mainMarginBottom = hasDistribution ? 8 : theme.margins.bottom;
  const mainHeight = equalScalePlotHeight(
    theme.width,
    theme.margins,
    xDomain,
    yDomain,
    mainMarginBottom,
  );

  const calibration = themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      height: mainHeight,
      marginBottom: mainMarginBottom,
      x: hasDistribution
        ? {
            ...axisOptions(theme, spec.xAxis.label, xDomain),
            axis: null,
            label: null,
          }
        : axisOptions(theme, spec.xAxis.label, xDomain),
      y: axisOptions(theme, spec.yAxis.label, yDomain),
      marks: finishMarks(marks, theme),
    },
    theme,
  );
  if (!hasDistribution || !spec.distribution) return calibration;
  const distribution = seriesRenderData(spec, spec.distribution).map(
    (datum) => ({
      ...datum,
      title: tooltip(theme.tip.digits, [
        ["Series", datum.label],
        ["Midpoint", datum.midpoint],
        ["Count", datum.count],
      ]),
    }),
  );
  const histogram = themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      height: DEFAULT_HISTOGRAM_HEIGHT,
      marginTop: 0,
      marginBottom: theme.margins.bottom,
      x: axisOptions(theme, spec.xAxis.label, xDomain),
      y: {
        label: null,
        grid: false,
        ticks: 3,
        tickSize: theme.axis.tickSize,
        tickPadding: theme.axis.tickPadding,
      },
      color: { legend: false, domain: resolved.groups, range: resolved.colors },
      marks: finishMarks(
        [
          Plot.rectY(distribution, {
            x1: (datum) => datum.midpoint - datum.binWidth / 2,
            x2: (datum) => datum.midpoint + datum.binWidth / 2,
            y: "count",
            fill: "group",
            fillOpacity: 1 / Math.max(resolved.groups.length, 1),
            title: (d: any) => d.title,
            tip: true,
          }),
        ],
        theme,
      ),
    },
    theme,
  );
  const container = document.createElement("div");
  container.className = "rtichoke-calibration";
  container.style.width = `${theme.width}px`;
  container.style.maxWidth = "100%";
  container.append(calibration, histogram);
  return container;
}

function renderLineChart(
  spec: PrecisionRecallV2Spec | GainsV2Spec | LiftV2Spec,
  options: V2RenderOptions,
  x: "sensitivity" | "ppcr",
  y: "ppv" | "sensitivity" | "lift",
  selectedOperatingPointValue?: number,
) {
  assertV2ReferentialIntegrity(spec);
  const resolved = resolveV2RenderOptions(displayGroups(spec), options);
  const { theme, colorByGroup } = resolved;
  const opDim = (spec as OperatingPointSupportedSpec).operatingPoint?.dimension;
  const data = seriesRenderData(
    spec,
    spec.data as Array<{
      seriesId: string;
      cutoff: number;
      sensitivity?: number;
      ppcr?: number;
      ppv?: number;
      lift?: number;
      performance?: PerformanceMetricValue[];
    }>,
  ).map((datum) => {
    const values = datum as typeof datum & {
      cutoff: number;
      sensitivity?: number;
      ppcr?: number;
      ppv?: number;
      lift?: number;
      performance?: PerformanceMetricValue[];
    };
    const fields: Array<[string, unknown]> = [["Series", datum.label]];
    if (spec.type === "precision_recall") {
      if (opDim === "ppcr") {
        if (values.ppcr !== undefined) fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
      } else {
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
        if (values.ppcr !== undefined) fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
      }
      fields.push(
        ["Sensitivity", formatNativeNumber(values.sensitivity, theme.tip.digits)],
        ["PPV", formatNativeNumber(values.ppv, theme.tip.digits)],
      );
      if (values.performance && values.performance.length > 0) {
        fields.push(
          ...buildCarriedPerformanceTooltipFields(
            values.performance,
            PR_CARRIED_ORDER,
            theme.tip.digits,
            new Set(["sensitivity", "ppv"]),
          ),
        );
      }
    } else if (spec.type === "gains") {
      if (opDim === "probability_threshold") {
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
        fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
      } else {
        fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
      }
      fields.push(["Sensitivity", formatNativeNumber(values.sensitivity, theme.tip.digits)]);
      if (values.performance && values.performance.length > 0) {
        fields.push(
          ...buildCarriedPerformanceTooltipFields(
            values.performance,
            GAINS_CARRIED_ORDER,
            theme.tip.digits,
            new Set(["sensitivity"]),
          ),
        );
      }
    } else if (spec.type === "lift") {
      if (opDim === "probability_threshold") {
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
        fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
      } else {
        fields.push(["PPCR", formatNativeNumber(values.ppcr, theme.tip.digits)]);
        fields.push(["Cutoff", formatNativeNumber(values.cutoff, theme.tip.digits)]);
      }
      fields.push(["Lift", formatNativeNumber(values.lift, theme.tip.digits)]);
      if (values.performance && values.performance.length > 0) {
        fields.push(
          ...buildCarriedPerformanceTooltipFields(
            values.performance,
            LIFT_CARRIED_ORDER,
            theme.tip.digits,
            new Set(["lift"]),
          ),
        );
      }
    }
    return {
      ...datum,
      tooltipFields: fields,
      title: tooltip(theme.tip.digits, fields),
    };
  });

  const marks = referenceMarks(spec, theme);
  marks.push(
    Plot.line(data, {
      x,
      y,
      z: "seriesId",
      stroke: "group",
      strokeWidth: theme.line.width,
      strokeDasharray: theme.line.dash ?? undefined,
    }),
    ordinaryPointDotMark(
      data,
      x,
      y,
      resolved,
      options.theme,
    ),
  );

  let selectedPoints: typeof data = [];
  if (selectedOperatingPointValue !== undefined && (spec as OperatingPointSupportedSpec).operatingPoint) {
    const dim = (spec as OperatingPointSupportedSpec).operatingPoint!.dimension;
    const dimField = dim === "probability_threshold" ? "cutoff" : "ppcr";
    selectedPoints = data.filter((datum) => datum[dimField] === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, x, y, resolved, options.theme),
      );
    }
  }

  const chart = themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      x: axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
      y: axisOptions(theme, spec.yAxis.label, spec.yAxis.domain),
      marks: finishMarks(marks, theme),
    },
    theme,
  );

  const hoverItems: CurveHoverItem[] = data.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: Number((d as any)[x]),
    yValue: Number((d as any)[y]),
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const selectedOpHoverItems: CurveHoverItem[] = selectedPoints.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: Number((d as any)[x]),
    yValue: Number((d as any)[y]),
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const referenceHoverItems: ReferenceHoverItem[] = [];
  for (const ref of spec.references ?? []) {
    const label = ref.label ?? (ref.type === "identity" ? "Identity" : "Reference");
    if (ref.type === "identity") {
      referenceHoverItems.push({
        type: "identity",
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        label,
      });
    } else if (ref.type === "horizontal" && ref.value !== undefined) {
      referenceHoverItems.push({
        type: "horizontal",
        value: ref.value,
        label,
      });
    } else if (ref.type === "path" && ref.points) {
      referenceHoverItems.push({
        type: "path",
        points: ref.points,
        label,
      });
    }
  }

  installCurveHoverLayer(chart, {
    items: hoverItems,
    selectedOperatingPointItems: selectedOpHoverItems,
    references: referenceHoverItems,
    theme,
  });

  return chart;
}

type HorizonSpec =
  | RocV2Spec
  | PrecisionRecallV2Spec
  | GainsV2Spec
  | LiftV2Spec
  | DecisionCurveV2Spec
  | InterventionsAvoidedV2Spec;

function horizons(spec: HorizonSpec) {
  return [
    ...new Set(
      spec.series
        .map((series) => series.horizon)
        .filter((horizon): horizon is number => horizon !== undefined),
    ),
  ];
}

export function selectHorizonSpec<T extends HorizonSpec>(
  spec: T,
  horizon: number,
): T {
  const series = spec.series.filter(
    (item) => item.horizon === undefined || item.horizon === horizon,
  );
  const seriesIds = new Set(series.map((item) => item.id));
  return {
    ...spec,
    series,
    data: spec.data.filter((datum) => seriesIds.has(datum.seriesId)),
    references: spec.references?.filter(
      (reference) =>
        reference.scope !== "population_horizon" ||
        reference.horizon === horizon,
    ),
  } as T;
}

export function renderWithHorizonSelection<T extends HorizonSpec>(
  spec: T,
  render: (selected: T, preferredOpValue?: number, onOpValueChange?: (val: number) => void) => SVGSVGElement | HTMLElement,
  preferredValue?: number,
  onValueChange?: (val: number) => void,
): SVGSVGElement | HTMLElement {
  const availableHorizons = horizons(spec);
  if (availableHorizons.length <= 1) return render(spec, preferredValue, onValueChange);

  let currentOpValue: number | undefined = preferredValue;

  const container = document.createElement("div");
  container.className = "rtichoke-horizon-chart";
  const control = document.createElement("label");
  control.className = "rtichoke-horizon-control";
  control.textContent = "Fixed Time Horizon: ";
  const select = document.createElement("select");
  select.className = "rtichoke-horizon-select";
  select.setAttribute("aria-label", "Fixed Time Horizon");
  for (const horizon of availableHorizons) {
    const option = document.createElement("option");
    option.value = String(horizon);
    option.textContent = String(horizon);
    select.append(option);
  }
  control.append(select);
  const chart = document.createElement("div");
  const draw = (horizon: number) => {
    chart.replaceChildren(
      render(
        selectHorizonSpec(spec, horizon),
        currentOpValue,
        (val) => {
          currentOpValue = val;
          if (onValueChange) onValueChange(val);
        },
      ),
    );
  };
  select.addEventListener("change", () => draw(Number(select.value)));
  container.append(control, chart);
  draw(availableHorizons[0]);
  return container;
}

function renderHorizonLineChart(
  spec: PrecisionRecallV2Spec | GainsV2Spec | LiftV2Spec,
  options: V2RenderOptions,
  x: "sensitivity" | "ppcr",
  y: "ppv" | "sensitivity" | "lift",
) {
  return renderWithLegendFiltering(
    spec as OperatingPointSupportedSpec,
    options,
    (filteredSpec, opts, preferredOpVal, onOpValChange) =>
      renderWithHorizonSelection(
        filteredSpec,
        (selected, pOpVal, onOpChange) =>
          renderWithOperatingPointSelection(
            selected as OperatingPointSupportedSpec,
            opts,
            (specWithOp, activeOpVal) =>
              renderLineChart(specWithOp as any, opts, x, y, activeOpVal),
            pOpVal,
            onOpChange,
          ),
        preferredOpVal,
        onOpValChange,
      ),
  );
}

export function renderPrecisionRecallV2(
  spec: PrecisionRecallV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderHorizonLineChart(spec, options, "sensitivity", "ppv");
}
export function renderGainsV2(
  spec: GainsV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderHorizonLineChart(spec, options, "ppcr", "sensitivity");
}
export function renderLiftV2(
  spec: LiftV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderHorizonLineChart(spec, options, "ppcr", "lift");
}
