// @vitest-environment jsdom

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import staticRoc from "../fixtures/v2/roc.json" with { type: "json" };
import {
  renderRocV2,
  selectHorizonSpec,
} from "../src/render/v2.js";
import {
  RocV2SpecSchema,
  type RocV2Spec,
} from "../src/spec/v2/roc.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

const staticSpec = staticRoc as RocV2Spec;

const multiRoc: RocV2Spec = {
  schemaVersion: "2.0",
  type: "roc",
  evaluations: [
    { id: "eval-a", model: "Model A", population: "Pop 1", label: "Model A" },
    { id: "eval-b", model: "Model B", population: "Pop 1", label: "Model B" },
  ],
  series: [
    {
      id: "series-a-5",
      evaluationId: "eval-a",
      horizon: 5,
      display: { label: "Model A (5y)", group: "Model A", role: "model" },
    },
    {
      id: "series-b-5",
      evaluationId: "eval-b",
      horizon: 5,
      display: { label: "Model B (5y)", group: "Model B", role: "model" },
    },
    {
      id: "series-a-10",
      evaluationId: "eval-a",
      horizon: 10,
      display: { label: "Model A (10y)", group: "Model A", role: "model" },
    },
    {
      id: "series-b-10",
      evaluationId: "eval-b",
      horizon: 10,
      display: { label: "Model B (10y)", group: "Model B", role: "model" },
    },
  ],
  data: [
    { seriesId: "series-a-5", cutoff: 0.8, sensitivity: 0.5, specificity: 0.9 },
    { seriesId: "series-a-5", cutoff: 0.2, sensitivity: 0.9, specificity: 0.4 },
    { seriesId: "series-b-5", cutoff: 0.8, sensitivity: 0.4, specificity: 0.85 },
    { seriesId: "series-b-5", cutoff: 0.2, sensitivity: 0.85, specificity: 0.35 },
    { seriesId: "series-a-10", cutoff: 0.8, sensitivity: 0.6, specificity: 0.85 },
    { seriesId: "series-a-10", cutoff: 0.2, sensitivity: 0.92, specificity: 0.3 },
    { seriesId: "series-b-10", cutoff: 0.8, sensitivity: 0.45, specificity: 0.8 },
    { seriesId: "series-b-10", cutoff: 0.2, sensitivity: 0.88, specificity: 0.25 },
  ],
  x: "false_positive_rate",
  y: "sensitivity",
  xAxis: { label: "1 - Specificity", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  references: [
    { type: "identity", scope: "global", label: "Random Guess" },
  ],
};

function svgOf(element: SVGSVGElement | HTMLElement) {
  return element instanceof SVGSVGElement
    ? element
    : [...element.querySelectorAll<SVGSVGElement>("svg")].find(
        (svg) => Number(svg.getAttribute("width")) > 100,
      )!;
}

describe("horizon-aware ROC v2 rendering", () => {
  it("accepts the multi-horizon canonical ROC spec without a schema change", () => {
    expect(Value.Check(RocV2SpecSchema, multiRoc)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(multiRoc)).not.toThrow();
  });

  it("preserves static ROC rendering without a horizon selector", () => {
    const element = renderRocV2(staticSpec);
    expect(element.querySelector("select")).toBeNull();
    expect(svgOf(element)).toBeDefined();
  });

  it("renders a single selected horizon as an ordinary chart without selector UI", () => {
    const horizon5 = selectHorizonSpec(multiRoc, 5);
    const element = renderRocV2(horizon5);
    expect(element.querySelector("select")).toBeNull();
    expect(svgOf(element)).toBeDefined();
  });

  it("filters series and data without mutating identity or global references", () => {
    const horizon5 = selectHorizonSpec(multiRoc, 5);

    expect(horizon5.series.map((series) => series.id)).toEqual([
      "series-a-5",
      "series-b-5",
    ]);
    expect(new Set(horizon5.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-a-5", "series-b-5"]),
    );
    expect(horizon5.references).toHaveLength(1);
    expect(horizon5.references).toMatchObject([
      { type: "identity", scope: "global", label: "Random Guess" },
    ]);
    expect(horizon5.evaluations.map((evalId) => evalId.id)).toEqual([
      "eval-a",
      "eval-b",
    ]);

    expect(multiRoc.series).toHaveLength(4);
    expect(multiRoc.data).toHaveLength(8);
  });

  it("renders one deterministic horizon at a time and switches geometry and data", () => {
    const element = renderRocV2(multiRoc);
    const select = element.querySelector("select")!;

    expect(select.getAttribute("aria-label")).toBe("Fixed Time Horizon");
    expect(select.value).toBe("5");
    expect([...select.options].map((option) => option.value)).toEqual(["5", "10"]);

    const initialSvg = svgOf(element);
    expect(initialSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(2); // 1 identity line + 1 grouped series path
    expect(initialSvg.textContent).toContain("1 - Specificity");
    expect(initialSvg.textContent).toContain("Sensitivity");

    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const updatedSvg = svgOf(element);
    expect(updatedSvg).not.toBe(initialSvg);
    expect(updatedSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(2);
  });

  it("preserves global identity reference across horizon selection", () => {
    const horizon5 = selectHorizonSpec(multiRoc, 5);
    const element = renderRocV2(horizon5);
    const svg = svgOf(element);
    expect(svg.querySelectorAll('[aria-label="line"] path')).toHaveLength(2); // 1 identity line + 1 grouped series path
  });
});
