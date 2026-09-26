import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MIN_DEMO_POPULATION_SIZE, scaleCalibrationForDemo } from "../src/demo-data.js";
import type { CalibrationV2Spec } from "../src/index.js";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import calibrationPopulationsFixture from "../fixtures/v2/calibration-populations.json" with { type: "json" };
import demoCalibrationFixture from "../fixtures/v2/demo/calibration.json" with { type: "json" };
import demoCalibrationPopulationsFixture from "../fixtures/v2/demo/calibration-populations.json" with { type: "json" };

describe("Demo Sample Size & Calibration Scaling", () => {
  it("scaleCalibrationForDemo produces at least MIN_DEMO_POPULATION_SIZE observations per series", () => {
    const singleScaled = scaleCalibrationForDemo(calibrationFixture as CalibrationV2Spec);
    const multiScaled = scaleCalibrationForDemo(
      calibrationPopulationsFixture as CalibrationV2Spec,
    );

    for (const spec of [singleScaled, multiScaled]) {
      const distribution = spec.distribution ?? [];
      const seriesIds = new Set(distribution.map((d) => d.seriesId));

      for (const seriesId of seriesIds) {
        const populationSum = distribution
          .filter((d) => d.seriesId === seriesId)
          .reduce((sum, bin) => sum + bin.count, 0);

        expect(populationSum).toBeGreaterThanOrEqual(MIN_DEMO_POPULATION_SIZE);
      }
    }
  });

  it("verifies dedicated demo calibration fixtures have N >= 1000 and ~10 groups per population", () => {
    for (const spec of [demoCalibrationFixture, demoCalibrationPopulationsFixture]) {
      const distribution = spec.distribution ?? [];
      const seriesIds = new Set(distribution.map((d) => d.seriesId));

      for (const seriesId of seriesIds) {
        const seriesBins = distribution.filter((d) => d.seriesId === seriesId);
        const populationSum = seriesBins.reduce((sum, bin) => sum + bin.count, 0);

        expect(populationSum).toBeGreaterThanOrEqual(MIN_DEMO_POPULATION_SIZE);
        expect(seriesBins.length).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("matches discrete points to distribution bins and updates total and events correctly", () => {
    const singleScaled = scaleCalibrationForDemo(calibrationFixture as CalibrationV2Spec);
    const multiScaled = scaleCalibrationForDemo(
      calibrationPopulationsFixture as CalibrationV2Spec,
    );

    for (const spec of [singleScaled, multiScaled]) {
      const distribution = spec.distribution ?? [];
      for (const point of spec.data) {
        if (point.method !== "discrete") continue;

        const matchingBin = distribution.find(
          (bin) => bin.seriesId === point.seriesId && bin.midpoint === point.predicted,
        );

        if (matchingBin) {
          expect(point.total).toBe(matchingBin.count);
          expect(point.events).toBe(Math.round(point.observed * (point.total ?? 0)));
        }
      }
    }
  });

  it("does not mutate the original specification object", () => {
    const originalFixture = JSON.parse(JSON.stringify(calibrationFixture)) as CalibrationV2Spec;
    const originalJson = JSON.stringify(originalFixture);

    scaleCalibrationForDemo(originalFixture);

    expect(JSON.stringify(originalFixture)).toBe(originalJson);
  });

  it("verifies src/demo.ts no longer imports golden prediction distribution fixtures", () => {
    const demoContent = fs.readFileSync(
      path.resolve(__dirname, "../src/demo.ts"),
      "utf-8",
    );

    expect(demoContent).not.toContain("prediction-distribution-threshold.json");
    expect(demoContent).not.toContain("prediction-distribution-ppcr-tie.json");
  });

  it("verifies demo/index.html no longer contains Threshold Golden or PPCR Tie sections", () => {
    const htmlContent = fs.readFileSync(
      path.resolve(__dirname, "../demo/index.html"),
      "utf-8",
    );

    expect(htmlContent).not.toContain("Threshold Golden");
    expect(htmlContent).not.toContain("PPCR Tie");
  });
});
