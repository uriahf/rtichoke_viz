import * as Plot from "@observablehq/plot";
import type { InterventionsAvoidedV2Spec } from "../spec/v2/interventions-avoided.js";
import { assertV2ReferentialIntegrity } from "../spec/v2/validate.js";
import {
  operatingPointDotMark,
  ordinaryPointDotMark,
  renderWithHorizonSelection,
  renderWithLegendFiltering,
  renderWithOperatingPointSelection,
  resolveV2RenderOptions,
  themedPlot,
  tooltip,
  type OperatingPointSupportedSpec,
  type V2RenderOptions,
} from "./v2.js";

export function renderInterventionsAvoidedV2(spec: InterventionsAvoidedV2Spec, options: V2RenderOptions = {}): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  return renderWithLegendFiltering(
    spec as OperatingPointSupportedSpec,
    options,
    (filteredSpec, opts) =>
      renderWithHorizonSelection(filteredSpec, (selected, preferredOpVal, onOpValChange) =>
        renderWithOperatingPointSelection(
          selected as OperatingPointSupportedSpec,
          opts,
          (specWithOp, activeOpVal) => renderInterventionsAvoidedChart(specWithOp as InterventionsAvoidedV2Spec, opts, activeOpVal),
          preferredOpVal,
          onOpValChange,
        ),
      ),
  );
}

function renderInterventionsAvoidedChart(spec: InterventionsAvoidedV2Spec, options: V2RenderOptions, selectedOperatingPointValue?: number): SVGSVGElement | HTMLElement {
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const resolved = resolveV2RenderOptions(groups, options);
  const { theme } = resolved;
  const displayBySeries = new Map(spec.series.map((series) => [series.id, series.display]));
  const labelByGroup = new Map(spec.series.map((series) => [series.display.group, series.display.label]));
  const data = spec.data.map((datum) => ({
    ...datum,
    group: displayBySeries.get(datum.seriesId)!.group,
    label: displayBySeries.get(datum.seriesId)!.label,
    title: tooltip(theme.tip.digits, [
      ["Series", displayBySeries.get(datum.seriesId)!.label],
      ["Threshold", datum.threshold],
      ["Interventions Avoided", datum.interventionsAvoided],
    ]),
  }));
  const defaultZeroStyle = { stroke: theme.reference.color, strokeWidth: theme.reference.width, strokeDasharray: theme.reference.dash };
  const defaultPathStyle = { stroke: theme.reference.color, strokeWidth: theme.reference.width, strokeDasharray: "4,3" };
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references) {
    if (reference.benchmark === "treat_all") {
      marks.push(Plot.ruleY([0], { ...defaultZeroStyle, title: () => reference.label ?? "Treat All" }));
    } else {
      marks.push(Plot.line(reference.points, { x: "x", y: "y", ...defaultPathStyle, title: () => reference.label ?? `Treat None — ${reference.population}` }));
    }
  }
  marks.push(
    Plot.line(data, { x: "threshold", y: "interventionsAvoided", z: "seriesId", stroke: "group", strokeWidth: theme.line.width, strokeDasharray: theme.line.dash ?? undefined }),
    ordinaryPointDotMark(data, "threshold", "interventionsAvoided", resolved, options.theme),
  );
  if (selectedOperatingPointValue !== undefined && spec.operatingPoint) {
    const selectedPoints = data.filter((datum) => datum.threshold === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, "threshold", "interventionsAvoided", resolved, options.theme),
      );
    }
  }
  const axis = (label: string, domain: [number, number] | undefined) => ({ label, domain, grid: false, line: true, ticks: theme.axis.ticks, tickSize: theme.axis.tickSize, tickPadding: theme.axis.tickPadding, tickFormat: theme.axis.numberFormat });
  return themedPlot({
    width: theme.width, height: theme.height,
    marginTop: theme.margins.top, marginRight: theme.margins.right, marginBottom: theme.margins.bottom, marginLeft: theme.margins.left,
    style: { background: theme.background, color: theme.axis.color, fontFamily: theme.typography.fontFamily, fontSize: `${theme.typography.fontSize}px` },
    color: { legend: resolved.showLegend, domain: resolved.groups, range: resolved.colors, tickFormat: (group: string) => labelByGroup.get(group) ?? group },
    x: axis(spec.xAxis.label, spec.xAxis.domain), y: axis(spec.yAxis.label, spec.yAxis.domain), marks,
  }, theme);
}
