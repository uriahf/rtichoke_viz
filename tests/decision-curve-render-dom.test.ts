// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/decision-curve-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/decision-curve-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/decision-curve-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/decision-curve-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import { renderDecisionCurveV2 } from "../src/render/decision-curve.js";
import type { DecisionCurveV2Spec } from "../src/spec/v2/decision-curve.js";

describe("Decision Curve v2 browser rendering", () => {
  it.each([single, sharedPopulation, populations, equalPrevalence, modelUnknown])("renders actual SVG chart content", (fixture) => {
    const svg = renderDecisionCurveV2(fixture as DecisionCurveV2Spec);
    expect(svg.querySelector("path, line")).not.toBeNull();
    expect(svg.querySelector('[aria-label^="x-axis"]')).not.toBeNull();
    expect(svg.querySelector('[aria-label^="y-axis"]')).not.toBeNull();
  });

  it("renders model geometry plus Treat None and Treat All", () => {
    const svg = renderDecisionCurveV2(single as DecisionCurveV2Spec);
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(1);
    expect(svg.textContent).toContain("Treat None");
    expect(svg.textContent).toContain("Treat All");
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
});
