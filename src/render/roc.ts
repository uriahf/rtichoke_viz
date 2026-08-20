import * as Plot from "@observablehq/plot";
import type { RocSpec } from "../spec/roc.js";

const RTICHOKE_COLORS = [
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
];

/** Render an ROC specification with rtichoke-style visual semantics. */
export function renderRoc(spec: RocSpec): SVGSVGElement | HTMLElement {
  const data = spec.data.map((d) => ({
    ...d,
    false_positive_rate: 1 - d.specificity,
  }));

  const marks: Plot.Markish[] = [
    Plot.line(data, {
      x: "false_positive_rate",
      y: "sensitivity",
      stroke: "model",
      strokeWidth: 2,
      tip: true,
    }),
  ];

  if (spec.references?.some((reference) => reference.type === "identity")) {
    marks.unshift(
      Plot.line(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        { x: "x", y: "y", stroke: "#BEBEBE", strokeWidth: 2 },
      ),
    );
  }

  return Plot.plot({
    width: 600,
    height: 600,
    marginLeft: 64,
    marginBottom: 56,
    style: {
      background: "transparent",
      color: "#222",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "13px",
    },
    x: {
      label: spec.xAxis.label,
      domain: spec.xAxis.domain,
      grid: false,
      ticks: 6,
    },
    y: {
      label: spec.yAxis.label,
      domain: spec.yAxis.domain,
      grid: false,
      ticks: 6,
    },
    color: { legend: true, range: RTICHOKE_COLORS },
    marks,
  });
}
