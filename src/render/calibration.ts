import * as Plot from "@observablehq/plot";
import type { CalibrationSpec } from "../spec/calibration.js";

/** Render a calibration specification with Observable Plot. */
export function renderCalibration(spec: CalibrationSpec): SVGSVGElement | HTMLElement {
  const marks: Plot.Markish[] = [
    Plot.line(spec.data, {
      x: "predicted",
      y: "observed",
      stroke: "model",
      tip: true,
    }),
  ];

  if (spec.data.some((datum) => datum.method === "discrete")) {
    marks.push(
      Plot.dot(
        spec.data.filter((datum) => datum.method === "discrete"),
        { x: "predicted", y: "observed", fill: "model", tip: true },
      ),
    );
  }

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
