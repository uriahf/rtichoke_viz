import * as Plot from "@observablehq/plot";
import type { CalibrationV2Spec } from "../spec/v2/calibration.js";
import type { DecisionCurveV2Spec } from "../spec/v2/decision-curve.js";
import type { GainsV2Spec } from "../spec/v2/gains.js";
import type { InterventionsAvoidedV2Spec } from "../spec/v2/interventions-avoided.js";
import type { LiftV2Spec } from "../spec/v2/lift.js";
import type { PrecisionRecallV2Spec } from "../spec/v2/precision_recall.js";
import type { RocV2Spec } from "../spec/v2/roc.js";
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
};

export interface V2RenderOptions {
  width?: number;
  height?: number;
  colors?: readonly string[];
  theme?: V2ThemeOptions;
}

export const RTICHOKE_BROWSER_THEME: V2RendererTheme = {
  width: 600,
  height: 600,
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
  marker: { radius: 5, fill: null, stroke: "#ffffff", strokeWidth: 1.5 },
  reference: { color: "#BEBEBE", width: 2, dash: "4,4" },
  legend: { position: "top", swatchWidth: 15, columns: null },
  tip: { digits: 3 },
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
  };
}

export function resolveV2RenderOptions(
  groupsOrCount: readonly string[] | number,
  options: V2RenderOptions = {},
): ResolvedV2RenderOptions {
  const groups =
    typeof groupsOrCount === "number"
      ? Array.from(
          { length: groupsOrCount },
          (_, index) => `group-${index + 1}`,
        )
      : [...groupsOrCount];
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
  const colors = groups.length <= 1 ? ["#000000"] : [...theme.colors];
  if (colors.length < groups.length)
    throw new Error(
      "Renderer colors must contain at least one color per display group",
    );
  const assigned = colors.slice(0, Math.max(groups.length, 1));
  return {
    theme: { ...theme, colors: assigned },
    groups,
    colors: assigned,
    colorByGroup: new Map(
      groups.map((group, index) => [group, assigned[index]]),
    ),
    showLegend: groups.length > 1,
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

function tooltip(digits: number, fields: Array<[string, unknown]>) {
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
    if (reference.type === "identity")
      marks.push(
        Plot.line(
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          { x: "x", y: "y", ...style, title: reference.label },
        ),
      );
    else if (reference.type === "horizontal" && reference.value !== undefined)
      marks.push(
        Plot.ruleY([reference.value], { ...style, title: reference.label }),
      );
    else if (reference.type === "path" && reference.points)
      marks.push(
        Plot.line(reference.points, {
          x: "x",
          y: "y",
          ...style,
          title: reference.label,
        }),
      );
  }
  return marks;
}

function finishMarks(marks: Plot.Markish[], theme: V2RendererTheme) {
  marks.push(frameMark(theme));
  return marks;
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
  const r = customTheme?.marker?.radius ?? 7.5;

  return Plot.dot(data, {
    x,
    y,
    fill,
    stroke,
    strokeWidth,
    r,
    title: "title",
    tip: true,
  });
}

function themedPlot(options: Plot.PlotOptions, theme: V2RendererTheme) {
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
      'svg[width="15"]',
    )) {
      swatch.setAttribute("width", String(theme.legend.swatchWidth));
    }
  }
  return plot;
}

function renderRocChart(
  spec: RocV2Spec,
  options: V2RenderOptions = {},
  selectedOperatingPointValue?: number,
): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const resolved = resolveV2RenderOptions(displayGroups(spec), options);
  const { theme } = resolved;
  const data = seriesRenderData(spec, spec.data).map((datum) => ({
    ...datum,
    false_positive_rate: 1 - datum.specificity,
    title: tooltip(theme.tip.digits, [
      ["Series", datum.label],
      ["Cutoff", datum.cutoff],
      ["Sensitivity", datum.sensitivity],
      ["Specificity", datum.specificity],
    ]),
  }));
  const marks = referenceMarks(spec, theme);
  marks.push(
    Plot.line(data, {
      x: "false_positive_rate",
      y: "sensitivity",
      z: "seriesId",
      stroke: "group",
      strokeWidth: theme.line.width,
      strokeDasharray: theme.line.dash ?? undefined,
      title: "title",
      tip: true,
    }),
  );
  if (selectedOperatingPointValue !== undefined && spec.operatingPoint) {
    const dimField = spec.operatingPoint.dimension === "probability_threshold" ? "cutoff" : "ppcr";
    const selectedPoints = data.filter((datum) => datum[dimField] === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, "false_positive_rate", "sensitivity", resolved, options.theme),
      );
    }
  }
  return themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      x: axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
      y: axisOptions(theme, spec.yAxis.label, spec.yAxis.domain),
      marks: finishMarks(marks, theme),
    },
    theme,
  );
}

export function renderRocV2(
  spec: RocV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderWithHorizonSelection(spec, (selected, preferredOpVal, onOpValChange) =>
    renderWithOperatingPointSelection(
      selected,
      options,
      (specWithOp, activeOpVal) => renderRocChart(specWithOp, options, activeOpVal),
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
      title: "title",
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
        title: "title",
        tip: true,
      }),
    );
  const hasDistribution = (spec.distribution?.length ?? 0) > 0;
  const mainHeight = hasDistribution
    ? Math.round(theme.height * 0.8)
    : theme.height;
  const observedValues = data.map((datum) => datum.observed).filter(Number.isFinite);
  const yDomain = spec.yAxis.domain ?? [
    Math.min(0, ...observedValues),
    Math.max(1, ...observedValues),
  ];
  const calibration = themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      height: mainHeight,
      marginBottom: hasDistribution ? 8 : theme.margins.bottom,
      x: hasDistribution
        ? {
            ...axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
            axis: null,
            label: null,
          }
        : axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
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
      height: theme.height - mainHeight,
      marginTop: 0,
      marginBottom: theme.margins.bottom,
      x: axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
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
            title: "title",
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
  const { theme } = resolved;
  const data = seriesRenderData(
    spec,
    spec.data as Array<{
      seriesId: string;
      cutoff: number;
      sensitivity?: number;
      ppcr?: number;
      ppv?: number;
      lift?: number;
    }>,
  ).map((datum) => {
    const values = datum as typeof datum & {
      cutoff: number;
      sensitivity?: number;
      ppcr?: number;
      ppv?: number;
      lift?: number;
    };
    const yLabel = y === "ppv" ? "PPV" : y === "sensitivity" ? "Sensitivity" : "Lift";
    return {
      ...datum,
      title: tooltip(theme.tip.digits, [
        ["Series", datum.label],
        ["Cutoff", values.cutoff],
        [x === "ppcr" ? "PPCR" : "Sensitivity", values[x]],
        [yLabel, values[y]],
      ]),
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
      title: "title",
      tip: true,
    }),
  );
  if (selectedOperatingPointValue !== undefined && (spec as OperatingPointSupportedSpec).operatingPoint) {
    const dim = (spec as OperatingPointSupportedSpec).operatingPoint!.dimension;
    const dimField = dim === "probability_threshold" ? "cutoff" : "ppcr";
    const selectedPoints = data.filter((datum) => datum[dimField] === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, x, y, resolved, options.theme),
      );
    }
  }
  return themedPlot(
    {
      ...basePlotOptions(resolved, spec),
      x: axisOptions(theme, spec.xAxis.label, spec.xAxis.domain),
      y: axisOptions(theme, spec.yAxis.label, spec.yAxis.domain),
      marks: finishMarks(marks, theme),
    },
    theme,
  );
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
): SVGSVGElement | HTMLElement {
  const availableHorizons = horizons(spec);
  if (availableHorizons.length <= 1) return render(spec);

  let currentOpValue: number | undefined;

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
  return renderWithHorizonSelection(spec, (selected, preferredOpVal, onOpValChange) =>
    renderWithOperatingPointSelection(
      selected as OperatingPointSupportedSpec,
      options,
      (specWithOp, activeOpVal) =>
        renderLineChart(specWithOp as any, options, x, y, activeOpVal),
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
