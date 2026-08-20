import * as Plot from "@observablehq/plot";
import type { CalibrationSpec } from "../spec/calibration.js";

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

/** Render a calibration specification with rtichoke-style visual semantics. */
export function renderCalibration(spec: CalibrationSpec): SVGSVGElement | HTMLElement {
  const marks: Plot.Markish[] = [];

  if (spec.references?.some((reference) => reference.type === "identity")) {
    marks.push(
      Plot.line(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        {
          x: "x",
          y: "y",
          stroke: "#BEBEBE",
          strokeWidth: 2,
          strokeDasharray: "4,4",
        },
      ),
    );
  }

  marks.push(
    Plot.line(spec.data, {
      x: "predicted",
      y: "observed",
      stroke: "model",
      strokeWidth: 2,
      tip: true,
    }),
  );

  const discrete = spec.data.filter((datum) => datum.method === "discrete");
  if (discrete.length > 0) {
    marks.push(
      Plot.dot(discrete, {
        x: "predicted",
        y: "observed",
        fill: "model",
        stroke: "white",
        strokeWidth: 1.5,
        r: 5,
        tip: true,
      }),
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
