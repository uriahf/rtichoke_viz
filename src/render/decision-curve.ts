import * as Plot from "@observablehq/plot";
import type { DecisionCurveV2Spec } from "../spec/v2/decision-curve.js";
import { assertV2ReferentialIntegrity } from "../spec/v2/validate.js";
import type { PerformanceMetricId } from "../spec/v2/performance-table.js";
import {
  buildCarriedPerformanceTooltipFields,
  buildReferenceTooltipMarkOptions,
  buildStructuredTooltipMarkOptions,
  DCA_CANONICAL_ORDER,
  formatNativeNumber,
  installCurveHoverLayer,
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

const DECISION_CURVE_CARRIED_ORDER: PerformanceMetricId[] = [
  "net_benefit",
  "ppcr",
  "sensitivity",
  "specificity",
  "false_positive_rate",
  "ppv",
  "npv",
  "lift",
  "predicted_positives",
  "true_positives",
  "true_negatives",
  "false_positives",
  "false_negatives",
];

export function renderDecisionCurveV2(spec: DecisionCurveV2Spec, options: V2RenderOptions = {}): SVGSVGElement | HTMLElement {
  assertV2ReferentialIntegrity(spec);
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
            (specWithOp, activeOpVal) => renderDecisionCurveChart(specWithOp as DecisionCurveV2Spec, opts, activeOpVal),
            pOpVal,
            onOpChange,
          ),
        preferredOpVal,
        onOpValChange,
      ),
  );
}

function renderDecisionCurveChart(spec: DecisionCurveV2Spec, options: V2RenderOptions, selectedOperatingPointValue?: number): SVGSVGElement | HTMLElement {
  const groups = [...new Set(spec.series.map((series) => series.display.group))];
  const resolved = resolveV2RenderOptions(groups, { ...options, showLegend: false });
  const { theme, colorByGroup } = resolved;
  const displayBySeries = new Map(spec.series.map((series) => [series.id, series.display]));
  const labelByGroup = new Map(spec.series.map((series) => [series.display.group, series.display.label]));
  const data = spec.data.map((datum) => {
    const fields: Array<[string, unknown]> = [
      ["Series", displayBySeries.get(datum.seriesId)!.label],
      ["Threshold", formatNativeNumber(datum.threshold, theme.tip.digits)],
      ["Net Benefit", formatNativeNumber(datum.netBenefit, theme.tip.digits)],
    ];
    if (datum.performance && datum.performance.length > 0) {
      fields.push(
        ...buildCarriedPerformanceTooltipFields(
          datum.performance,
          DECISION_CURVE_CARRIED_ORDER,
          theme.tip.digits,
          new Set(["net_benefit"]),
        ),
      );
    }
    return {
      ...datum,
      group: displayBySeries.get(datum.seriesId)!.group,
      label: displayBySeries.get(datum.seriesId)!.label,
      tooltipFields: fields,
      title: tooltip(theme.tip.digits, fields),
    };
  });

  const defaultReferenceStyle = { stroke: theme.reference.color, strokeWidth: theme.reference.width, strokeDasharray: theme.reference.dash };
  const marks: Plot.Markish[] = [];
  for (const reference of spec.references) {
    if (reference.benchmark === "treat_none") {
      marks.push(Plot.ruleY([0], { ...defaultReferenceStyle }));
    } else {
      marks.push(Plot.line(reference.points, { x: "x", y: "y", ...defaultReferenceStyle }));
    }
  }
  marks.push(
    Plot.line(data, { x: "threshold", y: "netBenefit", z: "seriesId", stroke: "group", strokeWidth: theme.line.width, strokeDasharray: theme.line.dash ?? undefined }),
    ordinaryPointDotMark(data, "threshold", "netBenefit", resolved, options.theme),
  );

  let selectedPoints: typeof data = [];
  if (selectedOperatingPointValue !== undefined && spec.operatingPoint) {
    selectedPoints = data.filter((datum) => datum.threshold === selectedOperatingPointValue);
    if (selectedPoints.length > 0) {
      marks.push(
        operatingPointDotMark(selectedPoints, "threshold", "netBenefit", resolved, options.theme),
      );
    }
  }

  const axis = (label: string, domain: [number, number] | undefined) => ({ label, domain, grid: false, line: true, ticks: theme.axis.ticks, tickSize: theme.axis.tickSize, tickPadding: theme.axis.tickPadding, tickFormat: theme.axis.numberFormat });
  const chart = themedPlot({
    width: theme.width, height: theme.height,
    marginTop: theme.margins.top, marginRight: theme.margins.right, marginBottom: theme.margins.bottom, marginLeft: theme.margins.left,
    style: { background: theme.background, color: theme.axis.color, fontFamily: theme.typography.fontFamily, fontSize: `${theme.typography.fontSize}px` },
    color: { legend: resolved.showLegend, domain: resolved.groups, range: resolved.colors, tickFormat: (group: string) => labelByGroup.get(group) ?? group },
    x: axis(spec.xAxis.label, spec.xAxis.domain), y: axis(spec.yAxis.label, spec.yAxis.domain), marks,
  }, theme);

  const hoverItems = data.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: d.threshold,
    yValue: d.netBenefit,
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const selectedOpHoverItems = selectedPoints.map((d) => ({
    seriesId: d.seriesId,
    group: d.group,
    xValue: d.threshold,
    yValue: d.netBenefit,
    tooltipFields: d.tooltipFields,
    backgroundColor: colorByGroup.get(d.group) ?? "#1b9e77",
  }));

  const referenceHoverItems = spec.references.map((ref) => {
    if (ref.type === "horizontal") {
      const label = ref.label ?? "Treat None";
      return {
        type: "horizontal" as const,
        value: ref.value,
        label,
      };
    } else if (ref.type === "path") {
      const popLabel = (ref as any).population ? `Treat All — ${(ref as any).population}` : "Treat All";
      const label = ref.label ?? popLabel;
      return {
        type: "path" as const,
        points: ref.points,
        label,
      };
    }
    return {
      type: "horizontal" as const,
      value: 0,
      label: ref.label ?? "Reference",
    };
  });

  installCurveHoverLayer(chart, {
    items: hoverItems,
    selectedOperatingPointItems: selectedOpHoverItems,
    references: referenceHoverItems,
    theme,
  });

  return chart;
}
