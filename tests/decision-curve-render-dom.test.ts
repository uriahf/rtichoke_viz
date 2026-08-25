// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/decision-curve-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/decision-curve-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/decision-curve-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/decision-curve-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import timeMulti from "../fixtures/v2/decision-curve-time-multi.json" with { type: "json" };
import { renderDecisionCurveV2 } from "../src/render/decision-curve.js";
import { selectHorizonSpec } from "../src/render/v2.js";
import type { DecisionCurveV2Spec } from "../src/spec/v2/decision-curve.js";

function svgOf(element: SVGSVGElement | HTMLElement) {
  return element instanceof SVGSVGElement
    ? element
    : [...element.querySelectorAll<SVGSVGElement>("svg")].find(
        (svg) => Number(svg.getAttribute("width")) > 100,
      )!;
}

describe("Decision Curve v2 browser rendering", () => {
  it.each([single, sharedPopulation, populations, equalPrevalence, modelUnknown])("renders actual SVG chart content", (fixture) => {
    const svg = renderDecisionCurveV2(fixture as DecisionCurveV2Spec);
    expect(svg.querySelector("path, line")).not.toBeNull();
    expect(svg.querySelector('[aria-label^="x-axis"]')).not.toBeNull();
    expect(svg.querySelector('[aria-label^="y-axis"]')).not.toBeNull();
  });

  it("renders model geometry plus Treat None and Treat All", () => {
    const svg = renderDecisionCurveV2(single as DecisionCurveV2Spec);
    expect(svg.querySelector('[aria-label="rule"]')).not.toBeNull();
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
  });

  it("renders two model series while sharing one Treat All reference", () => {
    const svg = renderDecisionCurveV2(sharedPopulation as DecisionCurveV2Spec);
    expect(sharedPopulation.series).toHaveLength(2);
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_all")).toHaveLength(1);
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(2);
  });

  it("retains separate equal-geometry Treat All semantic objects", () => {
    const refs = equalPrevalence.references.filter((x) => x.benchmark === "treat_all");
    expect(refs[0].points).toEqual(refs[1].points);
    expect(refs[0].population).not.toBe(refs[1].population);
    expect(renderDecisionCurveV2(equalPrevalence as DecisionCurveV2Spec).querySelectorAll("path").length).toBeGreaterThan(3);
  });

  it("uses population labels for model-unknown display groups", () => {
    const svg = renderDecisionCurveV2(modelUnknown as DecisionCurveV2Spec);
    expect(svg.textContent).toContain("Opaque cohort A");
    expect(svg.textContent).toContain("Model A @ Population A");
  });

  it("does not force a non-negative y domain", () => {
    expect(single.yAxis).not.toHaveProperty("domain");
    expect(renderDecisionCurveV2(single as DecisionCurveV2Spec)).toBeTruthy();
  });

  it("preserves static geometry and references without a horizon selector", () => {
    const element = renderDecisionCurveV2(single as DecisionCurveV2Spec);
    const svg = svgOf(element);
    expect(element.querySelector("select")).toBeNull();
    expect(svg.querySelector('[aria-label="rule"]')).not.toBeNull();
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(svg.textContent).toContain("Probability threshold");
    expect(svg.textContent).toContain("Net benefit");
  });

  it("renders a canonical single horizon without unnecessary selector UI", () => {
    const selected = selectHorizonSpec(
      timeMulti as DecisionCurveV2Spec,
      5,
    );
    const element = renderDecisionCurveV2(selected);
    const svg = svgOf(element);
    expect(element.querySelector("select")).toBeNull();
    expect(new Set(selected.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-1", "series-2"]),
    );
    expect(selected.references.map((reference) => "benchmark" in reference ? reference.benchmark : undefined)).toEqual([
      "treat_none",
      "treat_all",
    ]);
    expect(svg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
  });

  it("switches model data and Treat All while retaining Treat None and evaluation identity", () => {
    const spec = timeMulti as DecisionCurveV2Spec;
    const horizon5 = selectHorizonSpec(spec, 5);
    const horizon10 = selectHorizonSpec(spec, 10);
    expect(horizon5.evaluations.map(({ id }) => id)).toEqual(
      horizon10.evaluations.map(({ id }) => id),
    );
    expect(horizon5.series.map(({ id }) => id)).toEqual(["series-1", "series-2"]);
    expect(horizon10.series.map(({ id }) => id)).toEqual(["series-3", "series-4"]);
    expect(new Set(horizon5.data.map(({ seriesId }) => seriesId))).toEqual(
      new Set(["series-1", "series-2"]),
    );
    expect(new Set(horizon10.data.map(({ seriesId }) => seriesId))).toEqual(
      new Set(["series-3", "series-4"]),
    );
    expect(horizon5.references[1]).toMatchObject({ benchmark: "treat_all", horizon: 5 });
    expect(horizon10.references[1]).toMatchObject({ benchmark: "treat_all", horizon: 10 });

    const element = renderDecisionCurveV2(spec);
    const select = element.querySelector("select")!;
    expect(select.getAttribute("aria-label")).toBe("Fixed Time Horizon");
    expect(select.value).toBe("5");
    expect([...select.options].map(({ value }) => value)).toEqual(["5", "10"]);

    const initialSvg = svgOf(element);
    const initialGeometry = [...initialSvg.querySelectorAll("path")]
      .map((path) => path.getAttribute("d"))
      .join("|");
    expect(initialSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(initialSvg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);

    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const updatedSvg = svgOf(element);
    const updatedGeometry = [...updatedSvg.querySelectorAll("path")]
      .map((path) => path.getAttribute("d"))
      .join("|");
    expect(updatedSvg).not.toBe(initialSvg);
    expect(updatedGeometry).not.toBe(initialGeometry);
    expect(updatedSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(updatedSvg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
  });

  it("retains equal Treat All paths owned by distinct populations at one horizon", () => {
    const spec = structuredClone(equalPrevalence) as DecisionCurveV2Spec;
    spec.series.forEach((series) => { series.horizon = 5; });
    spec.references = spec.references.map((reference) =>
      "benchmark" in reference && reference.benchmark === "treat_all"
        ? { ...reference, scope: "population_horizon", horizon: 5 }
        : reference,
    ) as DecisionCurveV2Spec["references"];

    const svg = svgOf(renderDecisionCurveV2(spec));
    expect(spec.references.filter((reference) => "benchmark" in reference && reference.benchmark === "treat_all")).toHaveLength(2);
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(3);
  });
});
