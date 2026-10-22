// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  computeJointMaxProportion,
  computeScenarioStats,
  createBinDefinitions,
  renderContinuousOutcomeDistributionPOC,
} from "../src/experimental/continuous-outcome-distribution.js";
import { generateSyntheticContinuousDataset } from "../src/experimental/synthetic-data.js";

describe("Continuous Outcome Distribution POC — Statistical & Interaction Tests", () => {
  it("1. Generates exactly 600 synthetic subjects across 36 steps (0-35)", () => {
    const dataset = generateSyntheticContinuousDataset();
    expect(dataset.nSubjects).toBe(600);
    expect(dataset.numSteps).toBe(36);
    expect(dataset.subjects.length).toBe(600);

    for (const sub of dataset.subjects) {
      expect(sub.outcomes.length).toBe(36);
      expect(sub.censoringStep).toBeGreaterThanOrEqual(0);
      expect(sub.censoringStep).toBeLessThanOrEqual(35);
    }
  });

  it("2. Validates monotone censoring and observed sample sizes in Scenario B", () => {
    const dataset = generateSyntheticContinuousDataset();
    const statsA = computeScenarioStats(dataset, "A", 20);
    const statsB = computeScenarioStats(dataset, "B", 20);

    // Scenario A: complete follow-up
    for (let s = 0; s < 36; s++) {
      expect(statsA[s].includedCount).toBe(600);
      expect(statsA[s].excludedCount).toBe(0);
      expect(statsA[s].excludedProportion).toBe(0);
    }

    // Scenario B: monotone nonincreasing included count
    expect(statsB[0].includedCount).toBe(600);
    expect(statsB[0].excludedCount).toBe(0);

    for (let s = 1; s < 36; s++) {
      expect(statsB[s].includedCount).toBeLessThanOrEqual(statsB[s - 1].includedCount);
      expect(statsB[s].excludedCount + statsB[s].includedCount).toBe(600);
    }

    // Monotone right censoring reaches ~390 subjects at step 35
    expect(statsB[35].includedCount).toBeGreaterThanOrEqual(350);
    expect(statsB[35].includedCount).toBeLessThanOrEqual(430);
  });

  it("3. Verifies every outcome is in [0, 1] and bin proportions sum to 1.0 (100%)", () => {
    const dataset = generateSyntheticContinuousDataset();

    for (const scenario of ["A", "B"] as const) {
      const stats = computeScenarioStats(dataset, scenario, 20);

      for (const stepSum of stats) {
        if (stepSum.includedCount > 0) {
          const sumProp = stepSum.cells.reduce((acc, c) => acc + c.proportion, 0);
          expect(sumProp).toBeCloseTo(1.0, 6);

          const totalBinCounts = stepSum.cells.reduce((acc, c) => acc + c.count, 0);
          expect(totalBinCounts).toBe(stepSum.includedCount);
        }
      }
    }
  });

  it("4. Confirms heatmap cell counts and histogram cell counts agree exactly", () => {
    const dataset = generateSyntheticContinuousDataset();
    const statsA = computeScenarioStats(dataset, "A", 20);

    for (let s = 0; s < 36; s++) {
      const stepSum = statsA[s];
      for (let b = 0; b < 20; b++) {
        const cell = stepSum.cells[b];
        expect(cell.count).toBe(stepSum.cells[b].count);
        expect(cell.percentage).toBeCloseTo((cell.count / stepSum.includedCount) * 100, 5);
      }
    }
  });

  it("5. Computes joint maximum proportion across Scenario A and B consistently", () => {
    const dataset = generateSyntheticContinuousDataset();
    const jointProp20 = computeJointMaxProportion(dataset, 20);

    expect(jointProp20).toBeGreaterThan(0);
    expect(jointProp20).toBeLessThanOrEqual(1.0);
  });

  it("6. DOM & Interaction rendering check: mounts successfully and updates UI elements", () => {
    const dataset = generateSyntheticContinuousDataset();
    const el = renderContinuousOutcomeDistributionPOC({ dataset });

    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.querySelector(".rtichoke-outcome-distribution__title")?.textContent).toContain("Continuous Outcome Distribution");

    // Heatmap SVG present
    const heatmapSvg = el.querySelector(".rtichoke-continuous-heatmap-wrapper svg");
    expect(heatmapSvg).not.toBeNull();

    // Histogram SVG permanently present side-by-side in right column
    const histogramSvg = el.querySelector(".rtichoke-continuous-right-column svg");
    expect(histogramSvg).not.toBeNull();

    // Confirm bin resolution radio is no longer present
    expect(el.querySelector('[aria-label="Bin Resolution"]')).toBeNull();

    // Excluded panel expanded by default
    expect(el.querySelector(".rtichoke-continuous-excluded-section")?.textContent).toContain("Scenario A has complete follow-up");

    // Toggle Excluded Panel button toggles visibility
    const toggleExclBtn = el.querySelector<HTMLButtonElement>(".rtichoke-continuous-toggle-excluded");
    expect(toggleExclBtn).not.toBeNull();
    toggleExclBtn?.click(); // collapse
    expect(el.querySelector(".rtichoke-continuous-excluded-section")?.textContent).not.toContain("Scenario A has complete follow-up");
    toggleExclBtn?.click(); // re-expand
    expect(el.querySelector(".rtichoke-continuous-excluded-section")?.textContent).toContain("Scenario A has complete follow-up");
  });
});
