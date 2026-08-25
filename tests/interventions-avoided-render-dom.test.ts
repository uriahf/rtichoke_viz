// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/interventions-avoided-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/interventions-avoided-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/interventions-avoided-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/interventions-avoided-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import { renderInterventionsAvoidedV2 } from "../src/render/interventions-avoided.js";
import type { InterventionsAvoidedV2Spec } from "../src/spec/v2/interventions-avoided.js";

describe("Interventions Avoided v2 browser rendering", () => {
  it.each([single, sharedPopulation, populations, equalPrevalence, modelUnknown])("renders actual SVG chart content", (fixture) => {
    const svg = renderInterventionsAvoidedV2(fixture as InterventionsAvoidedV2Spec);
    expect(svg.querySelector("path, line")).not.toBeNull();
    expect(svg.querySelector('[aria-label^="x-axis"]')).not.toBeNull();
    expect(svg.querySelector('[aria-label^="y-axis"]')).not.toBeNull();
  });

  it("renders model geometry plus Treat All and Treat None", () => {
    const svg = renderInterventionsAvoidedV2(single as InterventionsAvoidedV2Spec);
    expect(svg.querySelector('[aria-label="rule"]')).not.toBeNull();
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(svg.textContent).toContain("Probability Threshold");
    expect(svg.textContent).toContain("Interventions Avoided (per 100)");
  });

  it("renders two model series while sharing one Treat None reference", () => {
    const svg = renderInterventionsAvoidedV2(sharedPopulation as InterventionsAvoidedV2Spec);
    expect(sharedPopulation.series).toHaveLength(2);
    expect(sharedPopulation.references.filter((x) => x.benchmark === "treat_none")).toHaveLength(1);
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(2);
  });

  it("retains separate equal-geometry Treat None semantic objects", () => {
    const refs = equalPrevalence.references.filter((x) => x.benchmark === "treat_none");
    expect(refs[0].points).toEqual(refs[1].points);
    expect(refs[0].population).not.toBe(refs[1].population);
    expect(renderInterventionsAvoidedV2(equalPrevalence as InterventionsAvoidedV2Spec).querySelectorAll("path").length).toBeGreaterThan(3);
  });

  it("uses population labels for model-unknown display groups", () => {
    const svg = renderInterventionsAvoidedV2(modelUnknown as InterventionsAvoidedV2Spec);
    expect(svg.textContent).toContain("Opaque cohort A");
    expect(svg.textContent).toContain("Model A @ Population A");
  });
});
