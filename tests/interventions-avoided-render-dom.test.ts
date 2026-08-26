// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import equalPrevalence from "../fixtures/v2/interventions-avoided-equal-prevalence.json" with { type: "json" };
import modelUnknown from "../fixtures/v2/interventions-avoided-model-unknown.json" with { type: "json" };
import populations from "../fixtures/v2/interventions-avoided-populations.json" with { type: "json" };
import sharedPopulation from "../fixtures/v2/interventions-avoided-shared-population.json" with { type: "json" };
import single from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import { renderInterventionsAvoidedV2 } from "../src/render/interventions-avoided.js";
import { selectHorizonSpec } from "../src/render/v2.js";
import type { InterventionsAvoidedV2Reference, InterventionsAvoidedV2Spec } from "../src/spec/v2/interventions-avoided.js";

function svgOf(element: SVGSVGElement | HTMLElement) {
  return element instanceof SVGSVGElement
    ? element
    : [...element.querySelectorAll<SVGSVGElement>("svg")].find(
        (svg) => Number(svg.getAttribute("width")) > 100,
      )!;
}

const tdSharedPopulation: InterventionsAvoidedV2Spec = {
  schemaVersion: "2.0",
  type: "interventions_avoided",
  evaluations: [
    { id: "evaluation-1", population: "Population A", model: "Model A" },
    { id: "evaluation-2", population: "Population A", model: "Model B" },
  ],
  series: [
    { id: "series-1", evaluationId: "evaluation-1", horizon: 5, display: { label: "Model A", group: "Model A", role: "model" } },
    { id: "series-2", evaluationId: "evaluation-2", horizon: 5, display: { label: "Model B", group: "Model B", role: "model" } },
    { id: "series-3", evaluationId: "evaluation-1", horizon: 10, display: { label: "Model A", group: "Model A", role: "model" } },
    { id: "series-4", evaluationId: "evaluation-2", horizon: 10, display: { label: "Model B", group: "Model B", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", threshold: 0.1, interventionsAvoided: 14 },
    { seriesId: "series-1", threshold: 0.2, interventionsAvoided: 24 },
    { seriesId: "series-2", threshold: 0.1, interventionsAvoided: 10 },
    { seriesId: "series-2", threshold: 0.2, interventionsAvoided: 20 },
    { seriesId: "series-3", threshold: 0.1, interventionsAvoided: 18 },
    { seriesId: "series-3", threshold: 0.2, interventionsAvoided: 28 },
    { seriesId: "series-4", threshold: 0.1, interventionsAvoided: 12 },
    { seriesId: "series-4", threshold: 0.2, interventionsAvoided: 22 },
  ],
  x: "threshold",
  y: "interventionsAvoided",
  xAxis: { label: "Probability Threshold", domain: [0, 0.5] },
  yAxis: { label: "Interventions Avoided (per 100)" },
  references: [
    { type: "horizontal", value: 0, label: "Treat All", scope: "global", benchmark: "treat_all" },
    { type: "path", points: [{ x: 0.1, y: -100 }, { x: 0.2, y: 0 }], label: "Treat None — Population A (5y)", scope: "population_horizon", population: "Population A", horizon: 5, benchmark: "treat_none" },
    { type: "path", points: [{ x: 0.1, y: -120 }, { x: 0.2, y: -10 }], label: "Treat None — Population A (10y)", scope: "population_horizon", population: "Population A", horizon: 10, benchmark: "treat_none" },
  ],
};

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

  it("preserves static geometry and references without a horizon selector", () => {
    const element = renderInterventionsAvoidedV2(single as InterventionsAvoidedV2Spec);
    const svg = svgOf(element);
    expect(element.querySelector("select")).toBeNull();
    expect(svg.querySelector('[aria-label="rule"]')).not.toBeNull();
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(svg.textContent).toContain("Probability Threshold");
    expect(svg.textContent).toContain("Interventions Avoided (per 100)");
  });

  it("renders a single-horizon TD spec directly without an unnecessary selector UI", () => {
    const selected = selectHorizonSpec(tdSharedPopulation, 5);
    const element = renderInterventionsAvoidedV2(selected);
    const svg = svgOf(element);
    expect(element.querySelector("select")).toBeNull();
    expect(new Set(selected.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-1", "series-2"]),
    );
    const refs = selected.references as unknown as InterventionsAvoidedV2Reference[];
    expect(
      refs.map((reference) => reference.benchmark),
    ).toEqual(["treat_all", "treat_none"]);
    expect(svg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(svg.querySelectorAll('[aria-label="line"] path')).toHaveLength(3);
  });

  it("renders a deterministic multi-horizon selector and updates chart on selection", () => {
    const element = renderInterventionsAvoidedV2(tdSharedPopulation);
    const select = element.querySelector("select")!;
    expect(select).not.toBeNull();
    expect(select.getAttribute("aria-label")).toBe("Fixed Time Horizon");
    expect(select.value).toBe("5");
    expect([...select.options].map((opt) => opt.value)).toEqual(["5", "10"]);

    const initialSvg = svgOf(element);
    expect(initialSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(initialSvg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(initialSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(3);

    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const updatedSvg = svgOf(element);
    expect(updatedSvg).not.toBe(initialSvg);
    expect(updatedSvg.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
    expect(updatedSvg.querySelectorAll('[aria-label="line"]')).toHaveLength(2);
    expect(updatedSvg.querySelectorAll('[aria-label="line"] path')).toHaveLength(3);
  });

  it("filters model geometry and Treat None references by horizon, leaving no stale geometry", () => {
    const element = renderInterventionsAvoidedV2(tdSharedPopulation);
    const select = element.querySelector("select")!;

    const svgHorizon5 = svgOf(element);
    const pathsHorizon5 = [...svgHorizon5.querySelectorAll('[aria-label="line"] path')].map((p) =>
      p.getAttribute("d"),
    );

    // Switch to horizon 10
    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const svgHorizon10 = svgOf(element);
    const pathsHorizon10 = [...svgHorizon10.querySelectorAll('[aria-label="line"] path')].map((p) =>
      p.getAttribute("d"),
    );

    // Geometry at horizon 10 must be distinct from horizon 5
    expect(pathsHorizon10).not.toEqual(pathsHorizon5);

    // Assert no stale horizon 5 path geometries remain in DOM for model series or Treat None
    for (const pathD of pathsHorizon5) {
      if (pathD) {
        expect(pathsHorizon10).not.toContain(pathD);
      }
    }

    // Treat None title/label test
    expect(svgHorizon5.innerHTML).toContain("Treat None — Population A (5y)");
    expect(svgHorizon10.innerHTML).not.toContain("Treat None — Population A (5y)");
    expect(svgHorizon10.innerHTML).toContain("Treat None — Population A (10y)");
  });

  it("retains single global Treat All zero reference across all horizons", () => {
    const element = renderInterventionsAvoidedV2(tdSharedPopulation);
    const select = element.querySelector("select")!;

    const svg5 = svgOf(element);
    expect(svg5.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);

    select.value = "10";
    select.dispatchEvent(new Event("change"));

    const svg10 = svgOf(element);
    expect(svg10.querySelectorAll('[aria-label="rule"]')).toHaveLength(1);
  });

  it("preserves distinct equal-valued population_horizon Treat None references at the same horizon", () => {
    const spec: InterventionsAvoidedV2Spec = {
      ...tdSharedPopulation,
      evaluations: [
        { id: "evaluation-1", population: "Population A", model: "Model A" },
        { id: "evaluation-2", population: "Population B", model: "Model B" },
      ],
      references: [
        { type: "horizontal", value: 0, label: "Treat All", scope: "global", benchmark: "treat_all" },
        { type: "path", points: [{ x: 0.1, y: -100 }, { x: 0.2, y: 0 }], label: "Treat None — Population A (5y)", scope: "population_horizon", population: "Population A", horizon: 5, benchmark: "treat_none" },
        { type: "path", points: [{ x: 0.1, y: -100 }, { x: 0.2, y: 0 }], label: "Treat None — Population B (5y)", scope: "population_horizon", population: "Population B", horizon: 5, benchmark: "treat_none" },
      ],
    };

    const selected = selectHorizonSpec(spec, 5);
    const refs = selected.references as unknown as InterventionsAvoidedV2Reference[];
    expect(refs).toHaveLength(3);
    expect("points" in refs[1] && "points" in refs[2] && refs[1].points).toEqual("points" in refs[2] ? refs[2].points : undefined);

    const svg = svgOf(renderInterventionsAvoidedV2(selected));
    // 2 Treat None reference line marks + 1 model data line mark = 3 line marks
    expect(svg.querySelectorAll('[aria-label="line"]')).toHaveLength(3);
    // 2 Treat None paths + 2 model series paths = 4 path elements
    expect(svg.querySelectorAll('[aria-label="line"] path')).toHaveLength(4);
  });

  it("maintains stable evaluation.id with distinct seriesId across horizons", () => {
    const horizon5 = selectHorizonSpec(tdSharedPopulation, 5);
    const horizon10 = selectHorizonSpec(tdSharedPopulation, 10);

    // Evaluation IDs are identical across horizons
    expect(horizon5.evaluations.map((e) => e.id)).toEqual(
      horizon10.evaluations.map((e) => e.id),
    );
    expect(horizon5.evaluations.map((e) => e.id)).toEqual(["evaluation-1", "evaluation-2"]);

    // Series IDs are distinct per horizon
    expect(horizon5.series.map((s) => s.id)).toEqual(["series-1", "series-2"]);
    expect(horizon10.series.map((s) => s.id)).toEqual(["series-3", "series-4"]);

    // Data seriesIds map correctly to the selected horizon's series IDs
    expect(new Set(horizon5.data.map((d) => d.seriesId))).toEqual(new Set(["series-1", "series-2"]));
    expect(new Set(horizon10.data.map((d) => d.seriesId))).toEqual(new Set(["series-3", "series-4"]));
  });
});
