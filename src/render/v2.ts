import * as Plot from "@observablehq/plot";
import type { CalibrationV2Spec } from "../spec/v2/calibration.js";
import type { GainsV2Spec } from "../spec/v2/gains.js";
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

export function renderRocV2(
  spec: RocV2Spec,
  options: V2RenderOptions = {},
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
      y: axisOptions(theme, spec.yAxis.label, spec.yAxis.domain),
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

function horizons(spec: PrecisionRecallV2Spec | GainsV2Spec | LiftV2Spec) {
  return [
    ...new Set(
      spec.series
        .map((series) => series.horizon)
        .filter((horizon): horizon is number => horizon !== undefined),
    ),
  ];
}

export function selectHorizonSpec<T extends PrecisionRecallV2Spec | GainsV2Spec | LiftV2Spec>(
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

function renderHorizonLineChart(
  spec: PrecisionRecallV2Spec | GainsV2Spec | LiftV2Spec,
  options: V2RenderOptions,
  x: "sensitivity" | "ppcr",
  y: "ppv" | "sensitivity" | "lift",
) {
  const availableHorizons = horizons(spec);
  if (availableHorizons.length <= 1) return renderLineChart(spec, options, x, y);

  const container = document.createElement("div");
  container.className = "rtichoke-horizon-chart";
  const control = document.createElement("label");
  control.textContent = "Fixed Time Horizon: ";
  const select = document.createElement("select");
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
      renderLineChart(selectHorizonSpec(spec, horizon), options, x, y),
    );
  };
  select.addEventListener("change", () => draw(Number(select.value)));
  container.append(control, chart);
  draw(availableHorizons[0]);
  return container;
}

export function renderPrecisionRecallV2(
  spec: PrecisionRecallV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  return renderLineChart(spec, options, "sensitivity", "ppv");
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
