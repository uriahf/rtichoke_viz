import * as Plot from "@observablehq/plot";
import type { RocSpec } from "../spec/roc.js";

/** Render an ROC specification with Observable Plot. */
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
      tip: true,
    }),
  ];

  if (spec.references?.some((reference) => reference.type === "identity")) {
    marks.push(Plot.line([[0, 0], [1, 1]], { x: "0", y: "1", strokeDasharray: "4,4" }));
  }

  return Plot.plot({
    x: { label: spec.xAxis.label, domain: spec.xAxis.domain },
    y: { label: spec.yAxis.label, domain: spec.yAxis.domain },
    color: { legend: true },
    marks,
  });
}
