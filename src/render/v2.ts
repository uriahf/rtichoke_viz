import * as Plot from "@observablehq/plot";
import type { CalibrationV2Spec } from "../spec/v2/calibration.js";
import type { GainsV2Spec } from "../spec/v2/gains.js";
import type { PrecisionRecallV2Spec } from "../spec/v2/precision_recall.js";
import type { RocV2Spec } from "../spec/v2/roc.js";
import { assertV2ReferentialIntegrity } from "../spec/v2/validate.js";

const RTICHOKE_COLORS = [
  "#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#07004D",
  "#E6AB02", "#FE5F55", "#54494B", "#006E90", "#BC96E6",
];

const BASE_STYLE = {
  background: "transparent",
  color: "#222",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "13px",
};

export interface V2RenderOptions {
  width?: number;
  height?: number;
  colors?: readonly string[];
}

export function resolveV2RenderOptions(
  groupCount: number,
  options: V2RenderOptions = {},
) {
  const width = options.width ?? 600;
  const height = options.height ?? 600;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("Renderer width and height must be positive finite numbers");
  }

  const colors = groupCount <= 1
    ? ["#000000"]
    : [...(options.colors ?? RTICHOKE_COLORS)];
  if (colors.length < groupCount) {
    throw new Error("Renderer colors must contain at least one color per display group");
  }

  return { width, height, colors: colors.slice(0, Math.max(groupCount, 1)) };
}

type SeriesChartSpec = RocV2Spec | CalibrationV2Spec | PrecisionRecallV2Spec | GainsV2Spec;

function displayBySeries(spec: SeriesChartSpec) {
  return new Map(spec.series.map((series) => [series.id, series.display]));
}

export function seriesRenderData<T extends { seriesId: string }>(spec: SeriesChartSpec, data: T[]) {
  const displays = displayBySeries(spec);
  return data.map((datum) => ({
    ...datum,
    group: displays.get(datum.seriesId)!.group,
    label: displays.get(datum.seriesId)!.label,
  }));
}

function referenceMarks(spec: SeriesChartSpec): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references ?? []) {
    if (reference.type === "identity") {
      marks.push(Plot.line([{ x: 0, y: 0 }, { x: 1, y: 1 }], {
        x: "x", y: "y", stroke: "#BEBEBE", strokeWidth: 2, strokeDasharray: "4,4",
      }));
    } else if (reference.type === "path" && reference.points) {
      marks.push(Plot.line(reference.points, {
        x: "x", y: "y", stroke: "#BEBEBE", strokeWidth: 2, strokeDasharray: "4,4",
      }));
    }
  }
  return marks;
}

export function renderRocV2(spec: RocV2Spec): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const showLegend = groups.length > 1;
  const data = seriesRenderData(spec, spec.data).map((datum) => ({ ...datum, false_positive_rate: 1 - datum.specificity }));
  const marks: Plot.Markish[] = [];
  if (spec.references?.some((reference) => reference.type === "identity")) {
    marks.push(Plot.line([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: "x", y: "y", stroke: "#BEBEBE", strokeWidth: 2 }));
  }
  marks.push(Plot.line(data, { x: "false_positive_rate", y: "sensitivity", z: "seriesId", stroke: "group", strokeWidth: 2, tip: true }));
  return Plot.plot({ width: 600, height: 600, marginLeft: 64, marginBottom: 56, style: BASE_STYLE,
    x: { label: spec.xAxis.label, domain: spec.xAxis.domain, grid: false, ticks: 6 },
    y: { label: spec.yAxis.label, domain: spec.yAxis.domain, grid: false, ticks: 6 },
    color: { legend: showLegend, range: showLegend ? RTICHOKE_COLORS : ["#000000"] }, marks });
}

export function renderCalibrationV2(spec: CalibrationV2Spec): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const showLegend = groups.length > 1;
  const colorRange = showLegend ? RTICHOKE_COLORS : ["#000000"];
  const data = seriesRenderData(spec, spec.data);
  const marks: Plot.Markish[] = [];
  if (spec.references?.some((reference) => reference.type === "identity")) {
    marks.push(Plot.line([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: "x", y: "y", stroke: "#BEBEBE", strokeWidth: 2, strokeDasharray: "4,4" }));
  }
  marks.push(Plot.line(data, { x: "predicted", y: "observed", z: "seriesId", stroke: "group", strokeWidth: 2, tip: true }));
  const discrete = data.filter((datum) => datum.method === "discrete");
  if (discrete.length > 0) marks.push(Plot.dot(discrete, { x: "predicted", y: "observed", fill: "group", stroke: "white", strokeWidth: 1.5, r: 5, tip: true }));
  const hasDistribution = (spec.distribution?.length ?? 0) > 0;
  const calibration = Plot.plot({ width: 600, height: hasDistribution ? 480 : 600, marginLeft: 64, marginBottom: hasDistribution ? 16 : 56, style: BASE_STYLE,
    x: { label: hasDistribution ? null : spec.xAxis.label, domain: spec.xAxis.domain, grid: false, ticks: 6, axis: hasDistribution ? null : "bottom" },
    y: { label: spec.yAxis.label, domain: spec.yAxis.domain, grid: false, ticks: 6 }, color: { legend: showLegend, range: colorRange }, marks });
  if (!hasDistribution || !spec.distribution) return calibration;
  const distribution = seriesRenderData(spec, spec.distribution);
  const histogram = Plot.plot({ width: 600, height: 120, marginLeft: 64, marginTop: 0, marginBottom: 48, style: BASE_STYLE,
    x: { label: spec.xAxis.label, domain: spec.xAxis.domain, grid: false, ticks: 6 }, y: { label: null, grid: false, ticks: 3 },
    color: { legend: false, range: colorRange }, marks: [Plot.rectY(distribution, { x1: (datum) => datum.midpoint - datum.binWidth / 2, x2: (datum) => datum.midpoint + datum.binWidth / 2, y: "count", fill: "group", fillOpacity: 1 / Math.max(groups.length, 1), tip: true })] });
  const container = document.createElement("div"); container.style.width = "600px"; container.style.maxWidth = "100%"; container.append(calibration, histogram); return container;
}

export function renderPrecisionRecallV2(spec: PrecisionRecallV2Spec): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const showLegend = groups.length > 1;
  const data = seriesRenderData(spec, spec.data);
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references ?? []) if (reference.type === "horizontal" && reference.value !== undefined) marks.push(Plot.ruleY([reference.value], { stroke: "#BEBEBE", strokeWidth: 2, strokeDasharray: "4,4" }));
  marks.push(Plot.line(data, { x: "sensitivity", y: "ppv", z: "seriesId", stroke: "group", strokeWidth: 2, tip: true }));
  marks.push(Plot.dot(data, { x: "sensitivity", y: "ppv", fill: "group", stroke: "white", strokeWidth: 1.5, r: 4, tip: true }));
  return Plot.plot({ width: 600, height: 600, marginLeft: 64, marginBottom: 56, style: BASE_STYLE,
    x: { label: spec.xAxis.label, domain: spec.xAxis.domain, grid: false, ticks: 6 }, y: { label: spec.yAxis.label, domain: spec.yAxis.domain, grid: false, ticks: 6 },
    color: { legend: showLegend, domain: groups, range: showLegend ? RTICHOKE_COLORS : ["#000000"] }, marks });
}

export function renderGainsV2(
  spec: GainsV2Spec,
  options: V2RenderOptions = {},
): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const showLegend = groups.length > 1;
  const resolved = resolveV2RenderOptions(groups.length, options);
  const data = seriesRenderData(spec, spec.data);
  const marks = referenceMarks(spec);
  marks.push(Plot.line(data, { x: "ppcr", y: "sensitivity", z: "seriesId", stroke: "group", strokeWidth: 2, tip: true }));
  marks.push(Plot.dot(data, { x: "ppcr", y: "sensitivity", fill: "group", stroke: "white", strokeWidth: 1.5, r: 4, tip: true }));
  return Plot.plot({ width: resolved.width, height: resolved.height, marginLeft: 64, marginBottom: 56, style: BASE_STYLE,
    x: { label: spec.xAxis.label, domain: spec.xAxis.domain, grid: false, ticks: 6 }, y: { label: spec.yAxis.label, domain: spec.yAxis.domain, grid: false, ticks: 6 },
    color: { legend: showLegend, domain: groups, range: resolved.colors }, marks });
}
