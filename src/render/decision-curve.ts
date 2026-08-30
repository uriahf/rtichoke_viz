import * as Plot from "@observablehq/plot";
import type { DecisionCurveV2Spec } from "../spec/v2/decision-curve.js";
import { assertV2ReferentialIntegrity } from "../spec/v2/validate.js";
import {
  operatingPointDotMark,
  renderWithHorizonSelection,
  renderWithOperatingPointSelection,
  resolveV2RenderOptions,
  type OperatingPointSupportedSpec,
  type V2RenderOptions,
} from "./v2.js";

export function renderDecisionCurveV2(spec: DecisionCurveV2Spec, options: V2RenderOptions = {}): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
  return renderWithHorizonSelection(spec, (selected, preferredOpVal, onOpValChange) =>
    renderWithOperatingPointSelection(
      selected as OperatingPointSupportedSpec,
      options,
      (specWithOp, activeOpVal) => renderDecisionCurveChart(specWithOp as DecisionCurveV2Spec, options, activeOpVal),
      preferredOpVal,
      onOpValChange,
    ),
  );
}

function renderDecisionCurveChart(spec: DecisionCurveV2Spec, options: V2RenderOptions, selectedOperatingPointValue?: number): SVGSVGElement | HTMLElement {
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const resolved = resolveV2RenderOptions(groups, options);
  const { theme } = resolved;
  const displayBySeries = new Map(spec.series.map((series) => [series.id, series.display]));
  const labelByGroup = new Map(spec.series.map((series) => [series.display.group, series.display.label]));
  const data = spec.data.map((datum) => ({
    ...datum,
    group: displayBySeries.get(datum.seriesId)!.group,
    label: displayBySeries.get(datum.seriesId)!.label,
    title: `Series: ${displayBySeries.get(datum.seriesId)!.label}\nThreshold: ${datum.threshold.toFixed(theme.tip.digits)}\nNet Benefit: ${datum.netBenefit.toFixed(theme.tip.digits)}`,
  }));
  const referenceStyle = { stroke: theme.reference.color, strokeWidth: theme.reference.width, strokeDasharray: theme.reference.dash };
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references) {
    if (reference.benchmark === "treat_none") {
      marks.push(Plot.ruleY([0], { ...referenceStyle, title: () => reference.label ?? "Treat None" }));
    } else {
      marks.push(Plot.line(reference.points, { x: "x", y: "y", ...referenceStyle, title: () => reference.label ?? `Treat All — ${reference.population}` }));
    }
  }
  marks.push(
    Plot.line(data, { x: "threshold", y: "netBenefit", z: "seriesId", stroke: "group", strokeWidth: theme.line.width, strokeDasharray: theme.line.dash ?? undefined, title: "title", tip: true }),
  );
  if (selectedOperatingPointValue !== undefined && spec.operatingPoint) {
    const selectedPoints = data.filter((datum) => datum.threshold === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, "threshold", "netBenefit", resolved, options.theme),
      );
    }
  }
  marks.push(
    Plot.frame({ stroke: theme.frame.color, strokeWidth: theme.frame.width }),
  );
  const axis = (label: string, domain: [number, number] | undefined) => ({ label, domain, grid: false, line: true, ticks: theme.axis.ticks, tickSize: theme.axis.tickSize, tickPadding: theme.axis.tickPadding, tickFormat: theme.axis.numberFormat });
  const plot = Plot.plot({
    width: theme.width, height: theme.height,
    marginTop: theme.margins.top, marginRight: theme.margins.right, marginBottom: theme.margins.bottom, marginLeft: theme.margins.left,
    style: { background: theme.background, color: theme.axis.color, fontFamily: theme.typography.fontFamily, fontSize: `${theme.typography.fontSize}px` },
    color: { legend: resolved.showLegend, domain: resolved.groups, range: resolved.colors, tickFormat: (group: string) => labelByGroup.get(group) ?? group },
    x: axis(spec.xAxis.label, spec.xAxis.domain), y: axis(spec.yAxis.label, spec.yAxis.domain), marks,
  });
  for (const label of plot.querySelectorAll<SVGTextElement>('[aria-label$="axis label"] text')) {
    label.style.fontSize = `${theme.typography.axisTitleSize}px`;
    label.style.fontWeight = String(theme.typography.axisTitleWeight);
  }
  return plot;
}
