// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { renderRocV2, renderPredictionDistribution, renderCalibrationV2 } from "../src/index.js";
import { CalibrationV2SpecSchema, type CalibrationV2Spec } from "../src/spec/v2/calibration.js";
import type { RocV2Spec } from "../src/spec/v2/roc.js";
import type { PredictionDistributionSpec } from "../src/spec/v2/prediction-distribution.js";
import rocFixture from "../fixtures/v2/roc.json" with { type: "json" };
import predDistFixture from "../fixtures/v2/prediction-distribution-threshold.json" with { type: "json" };
import calibrationPopulationsFixture from "../fixtures/v2/calibration-populations.json" with { type: "json" };
import fs from "node:fs";
import path from "node:path";

describe("Slider Accessibility & Multi-Population Calibration Preview", () => {
  it("CSS contains min-height 24px and focus-visible outline for .rtichoke-operating-point-slider", () => {
    const cssPath = path.resolve(__dirname, "../src/rtichoke-viz.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");

    expect(cssContent).toContain(".rtichoke-operating-point-slider {");
    expect(cssContent).toContain("min-height: 24px;");
    expect(cssContent).toContain(".rtichoke-operating-point-slider:focus-visible {");
    expect(cssContent).toContain("outline: 2px solid #2563eb;");
    expect(cssContent).toContain("outline-offset: 2px;");
  });

  it("shared-v2 operating-point slider has unique ID and associated label.htmlFor", () => {
    const spec: RocV2Spec = {
      ...(rocFixture as RocV2Spec),
      operatingPoint: { dimension: "probability_threshold" },
    };

    const container = document.createElement("div");
    container.append(renderRocV2(spec));

    const label = container.querySelector<HTMLLabelElement>(".rtichoke-operating-point-label");
    const slider = container.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");

    expect(label).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(slider!.id).toBeTruthy();
    expect(label!.htmlFor).toBe(slider!.id);
  });

  it("Prediction Distribution slider has unique ID and associated label.htmlFor", () => {
    const spec = predDistFixture as PredictionDistributionSpec;

    const container = document.createElement("div");
    container.append(renderPredictionDistribution(spec));

    const label = container.querySelector<HTMLLabelElement>(".rtichoke-operating-point-label");
    const slider = container.querySelector<HTMLInputElement>(".rtichoke-operating-point-slider");

    expect(label).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(slider!.id).toBeTruthy();
    expect(label!.htmlFor).toBe(slider!.id);
  });

  it("multi-slider components on a single page generate distinct non-colliding DOM IDs", () => {
    const rocSpec: RocV2Spec = {
      ...(rocFixture as RocV2Spec),
      operatingPoint: { dimension: "probability_threshold" },
    };
    const predDistSpec = predDistFixture as PredictionDistributionSpec;

    const root = document.createElement("div");
    root.append(renderRocV2(rocSpec));
    root.append(renderRocV2(rocSpec));
    root.append(renderPredictionDistribution(predDistSpec));
    root.append(renderPredictionDistribution(predDistSpec));

    const sliders = Array.from(root.querySelectorAll<HTMLInputElement>(".rtichoke-operating-point-slider"));
    const labels = Array.from(root.querySelectorAll<HTMLLabelElement>(".rtichoke-operating-point-label"));

    expect(sliders.length).toBe(4);
    expect(labels.length).toBe(4);

    const sliderIds = sliders.map((s) => s.id);
    const uniqueIds = new Set(sliderIds);

    expect(uniqueIds.size).toBe(4);
    labels.forEach((label, idx) => {
      expect(label.htmlFor).toBe(sliderIds[idx]);
    });
  });

  it("multi-population calibration preview fixture passes schema validation and contains >= 2 populations", () => {
    const spec = calibrationPopulationsFixture as CalibrationV2Spec;

    expect(Value.Check(CalibrationV2SpecSchema, spec)).toBe(true);

    const populations = spec.evaluations.map((e) => e.population);
    const uniquePopulations = new Set(populations);

    expect(uniquePopulations.size).toBeGreaterThanOrEqual(2);
    expect(spec.series.length).toBeGreaterThanOrEqual(2);

    const container = document.createElement("div");
    container.append(renderCalibrationV2(spec));

    const svgLines = container.querySelectorAll("svg line, svg path");
    expect(svgLines.length).toBeGreaterThan(0);
  });
});
