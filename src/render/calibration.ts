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

const BASE_STYLE = {
  background: "transparent",
  color: "#222",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "13px",
};

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

  const hasDistribution = (spec.distribution?.length ?? 0) > 0;
  const calibration = Plot.plot({
    width: 600,
    height: hasDistribution ? 480 : 600,
    marginLeft: 64,
    marginBottom: hasDistribution ? 16 : 56,
    style: BASE_STYLE,
    x: {
      label: hasDistribution ? null : spec.xAxis.label,
      domain: spec.xAxis.domain,
      grid: false,
      ticks: 6,
      axis: hasDistribution ? null : "bottom",
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

  if (!hasDistribution || !spec.distribution) {
    return calibration;
  }

  const modelCount = new Set(spec.distribution.map((datum) => datum.model)).size;
  const histogram = Plot.plot({
    width: 600,
    height: 120,
    marginLeft: 64,
    marginTop: 0,
    marginBottom: 48,
    style: BASE_STYLE,
    x: {
      label: spec.xAxis.label,
      domain: spec.xAxis.domain,
      grid: false,
      ticks: 6,
    },
    y: {
      label: null,
      grid: false,
      ticks: 3,
    },
    color: { legend: false, range: RTICHOKE_COLORS },
    marks: [
      Plot.rectY(spec.distribution, {
        x1: (datum) => datum.midpoint - datum.binWidth / 2,
        x2: (datum) => datum.midpoint + datum.binWidth / 2,
        y: "count",
        fill: "model",
        fillOpacity: 1 / Math.max(modelCount, 1),
        tip: true,
      }),
    ],
  });

  const container = document.createElement("div");
  container.style.width = "600px";
  container.style.maxWidth = "100%";
  container.append(calibration, histogram);
  return container;
}
