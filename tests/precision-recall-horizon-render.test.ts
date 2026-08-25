// @vitest-environment jsdom

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import staticPrecisionRecall from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import multiHorizon from "../fixtures/v2/precision-recall-time-multi.json" with { type: "json" };
import {
  renderPrecisionRecallV2,
  selectHorizonSpec,
} from "../src/render/v2.js";
import {
  PrecisionRecallV2SpecSchema,
  type PrecisionRecallV2Spec,
} from "../src/spec/v2/precision_recall.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

const multi = multiHorizon as PrecisionRecallV2Spec;
const staticSpec = staticPrecisionRecall as PrecisionRecallV2Spec;

function svgOf(element: SVGSVGElement | HTMLElement) {
  return element instanceof SVGSVGElement
    ? element
    : [...element.querySelectorAll<SVGSVGElement>("svg")].find(
        (svg) => Number(svg.getAttribute("width")) > 100,
      )!;
}

describe("horizon-aware Precision-Recall v2 rendering", () => {
  it("accepts the multi-horizon canonical contract without a schema change", () => {
    expect(Value.Check(PrecisionRecallV2SpecSchema, multi)).toBe(true);
    expect(() => assertV2ReferentialIntegrity(multi)).not.toThrow();
  });

  it("preserves static Precision-Recall rendering without a horizon selector", () => {
    const element = renderPrecisionRecallV2(staticSpec);
    expect(element.querySelector("select")).toBeNull();
    expect(svgOf(element)).toBeDefined();
  });

  it("renders a single selected horizon as an ordinary chart without selector UI", () => {
    const horizon5 = selectHorizonSpec(multi, 5);
    const element = renderPrecisionRecallV2(horizon5);
    expect(element.querySelector("select")).toBeNull();
    expect(svgOf(element)).toBeDefined();
  });

  it("filters series, data, and population-horizon references without mutating identity", () => {
    const horizon5 = selectHorizonSpec(multi, 5);

    expect(horizon5.series.map((series) => series.id)).toEqual([
      "series-a-5",
      "series-b-5",
      "series-c-5",
    ]);
    expect(new Set(horizon5.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-a-5", "series-b-5", "series-c-5"]),
    );
    expect(horizon5.references).toHaveLength(2);
    expect(horizon5.references?.map((reference) => reference.horizon)).toEqual([
      5,
      5,
    ]);
    expect(horizon5.references?.map((reference) => reference.population)).toEqual([
      "Population X",
      "Population Y",
    ]);
    expect(horizon5.references?.map((reference) => reference.value)).toEqual([
      0.25,
      0.25,
    ]);
    expect(horizon5.evaluations.map((evaluation) => evaluation.id)).toEqual([
      "eval-a",
      "eval-b",
      "eval-c",
    ]);

    expect(multi.series).toHaveLength(6);
    expect(multi.references).toHaveLength(4);
  });

  it("renders one deterministic horizon at a time and switches geometry and references", () => {
    const element = renderPrecisionRecallV2(multi);
    const select = element.querySelector("select")!;

    expect(select.getAttribute("aria-label")).toBe("Fixed Time Horizon");
    expect(select.value).toBe("5");
    expect([...select.options].map((option) => option.value)).toEqual(["5", "10"]);

    const initialSvg = svgOf(element);
    expect(initialSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(2);
    expect(initialSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(3);
    expect(initialSvg.textContent).toContain("Sensitivity");
    expect(initialSvg.textContent).toContain("PPV");

    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const updatedSvg = svgOf(element);
    expect(updatedSvg).not.toBe(initialSvg);
    expect(updatedSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(2);
    expect(updatedSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(3);
  });

  it("keeps equal-valued references distinct by semantic population-horizon owner", () => {
    const horizon5 = selectHorizonSpec(multi, 5);
    expect(horizon5.references).toHaveLength(2);
    expect(new Set(horizon5.references?.map((reference) => reference.population))).toEqual(
      new Set(["Population X", "Population Y"]),
    );
    expect(horizon5.references?.map((reference) => reference.value)).toEqual([
      0.25,
      0.25,
    ]);

    const svg = svgOf(renderPrecisionRecallV2(horizon5));
    expect(svg.querySelectorAll('[aria-label="rule"]')).toHaveLength(2);
  });
});
