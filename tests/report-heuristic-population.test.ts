// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderReport } from "../src/render/report.js";
import type { OutcomeDistributionSpec } from "../src/spec/v2/outcome-distribution.js";

const fixture = readFileSync("fixtures/v2/fixture-a-heuristics-report.json", "utf8");

describe("Outcome report population selection across heuristic updates", () => {
  it.each([false, true])("preserves semantic population with distinct horizons: %s", (distinctHorizons) => {
    const report = JSON.parse(fixture);
    const spec = report.sections[0].items[0].spec as OutcomeDistributionSpec;
    const secondId = "same-numbers-distinct-population";
    spec.evaluations.push({ id: secondId, population: "Second cohort" });
    const shift = (h: number) => distinctHorizons ? h + 10 : h;
    spec.stateDistributions.push(...spec.stateDistributions.map(row => ({
      ...structuredClone(row), evaluationId: secondId, horizon: shift(row.horizon ?? 0),
    })));
    for (const variant of Object.values(spec.variants ?? {})) {
      if (variant.status !== "available") continue;
      variant.stateDistributions.push(...variant.stateDistributions.map(row => ({
        ...structuredClone(row), evaluationId: secondId, horizon: shift(row.horizon ?? 0),
      })));
      variant.exclusions?.push(...variant.exclusions.map(ex => ({
        ...structuredClone(ex), evaluationId: secondId,
        excludedCounts: ex.excludedCounts.map(count => ({...count, horizon: shift(count.horizon)})),
      })));
    }
    spec.exclusions?.push(...spec.exclusions.map(ex => ({
      ...structuredClone(ex), evaluationId: secondId,
      excludedCounts: ex.excludedCounts.map(count => ({...count, horizon: shift(count.horizon)})),
    })));
    const first = renderReport(report);
    const secondReport = structuredClone(report);
    secondReport.sections[0].id += "-other-instance";
    const second = renderReport(secondReport);
    document.body.append(first, second);
    const choose = (root: HTMLElement, selector: string) => {
      const radio = root.querySelector<HTMLInputElement>(selector)!;
      radio.checked = true;
      radio.dispatchEvent(new Event("change", {bubbles:true}));
    };
    choose(first, `input[value="${secondId}"]`);
    const slider = first.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = "2";
    slider.dispatchEvent(new Event("input", {bubbles:true}));
    const readout = (root: HTMLElement) => root.querySelector(".rtichoke-outcome-distribution__readout")!.textContent;
    const expectedTime = distinctHorizons ? "Time = 20.000" : "Time = 10.000";
    expect(readout(first)).toContain(expectedTime);
    const unchangedSecond = readout(second);
    for (const pair of report.heuristics.available) {
      const [censoring, competing] = pair.split(":");
      choose(first, `input[name$="-censoring"][value="${censoring}"]`);
      choose(first, `input[name$="-competing"][value="${competing}"]`);
      expect(first.querySelector<HTMLInputElement>(`input[value="${secondId}"]`)!.checked).toBe(true);
      expect(readout(first)).toContain(expectedTime);
      expect(readout(second)).toBe(unchangedSecond);
    }
    first.remove(); second.remove();
  });
});
