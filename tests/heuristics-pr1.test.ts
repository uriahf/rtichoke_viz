import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  ReportSpecSchema,
  type ReportSpecV1_1,
} from "../src/spec/report.js";
import { OutcomeDistributionSpecSchema } from "../src/spec/v2/outcome-distribution.js";
import { assertReportReferentialIntegrity } from "../src/spec/validate-report.js";
import { assertOutcomeDistributionReferentialIntegrity } from "../src/spec/v2/validate-outcome-distribution.js";

describe("PR 1: Interactive Heuristics Schema Foundation", () => {
  const fixturePath = join(
    process.cwd(),
    "fixtures/v2/fixture-a-heuristics-report.json",
  );
  const fixtureJson = readFileSync(fixturePath, "utf-8");
  const fixtureReport = JSON.parse(fixtureJson) as ReportSpecV1_1;

  it("validates the committed eight-variant Fixture A report against ReportSpecSchema and referential integrity", () => {
    expect(Value.Check(ReportSpecSchema, fixtureReport)).toBe(true);
    expect(() =>
      assertReportReferentialIntegrity(fixtureReport),
    ).not.toThrow();

    const comp = fixtureReport.sections[0].items[0];
    if (comp.type === "component") {
      expect(Value.Check(OutcomeDistributionSpecSchema, comp.spec)).toBe(true);
      expect(() =>
        assertOutcomeDistributionReferentialIntegrity(comp.spec as any),
      ).not.toThrow();
    }
  });

  it("verifies exact probability estimates and exclusion counts for Fixture A at horizon 10 across key variants", () => {
    const comp = fixtureReport.sections[0].items[0];
    if (comp.type !== "component" || comp.spec.type !== "outcome_distribution") {
      throw new Error("expected outcome_distribution component");
    }

    const variants = comp.spec.variants!;

    // 1. "adjusted:excluded", horizon 10: primary risk "4/9"
    const adjEx = variants["adjusted:excluded"]!;
    expect(adjEx.status).toBe("available");
    if (adjEx.status === "available") {
      const h10 = adjEx.stateDistributions.find((d) => d.horizon === 10)!;
      const primary = h10.states.find((s) => s.stateId === "primary")!;
      expect(primary.estimate).toBeCloseTo(4 / 9, 8);

      const excl = adjEx.exclusions[0].excludedCounts.find(
        (c) => c.horizon === 10,
      )!;
      expect(excl.censoredExcludedCount).toBe(0);
      expect(excl.competingExcludedCount).toBe(2);
    }

    // 2. "excluded:adjusted_as_censored", horizon 10: primary risk "3/8" (0.375)
    const exAdjCens = variants["excluded:adjusted_as_censored"]!;
    expect(exAdjCens.status).toBe("available");
    if (exAdjCens.status === "available") {
      const h10 = exAdjCens.stateDistributions.find((d) => d.horizon === 10)!;
      const primary = h10.states.find((s) => s.stateId === "primary")!;
      expect(primary.estimate).toBe(0.375);

      const excl = exAdjCens.exclusions[0].excludedCounts.find(
        (c) => c.horizon === 10,
      )!;
      expect(excl.censoredExcludedCount).toBe(2);
      expect(excl.competingExcludedCount).toBe(0);
    }

    // 3. "adjusted:adjusted_as_negative", horizon 10: three-state probabilities "(5/16, 5/16, 3/8)"
    const adjNeg = variants["adjusted:adjusted_as_negative"]!;
    expect(adjNeg.status).toBe("available");
    if (adjNeg.status === "available") {
      const h10 = adjNeg.stateDistributions.find((d) => d.horizon === 10)!;
      const primary = h10.states.find((s) => s.stateId === "primary")!;
      const competing = h10.states.find((s) => s.stateId === "competing")!;
      const eventFree = h10.states.find((s) => s.stateId === "event_free")!;
      expect(primary.estimate).toBe(5 / 16);
      expect(competing.estimate).toBe(5 / 16);
      expect(eventFree.estimate).toBe(3 / 8);

      const excl = adjNeg.exclusions[0].excludedCounts.find(
        (c) => c.horizon === 10,
      )!;
      expect(excl.censoredExcludedCount).toBe(0);
      expect(excl.competingExcludedCount).toBe(0);
    }
  });

  it("rejects report with malformed heuristic key both structurally and in referential integrity", () => {
    const invalidReport = JSON.parse(JSON.stringify(fixtureReport));
    invalidReport.heuristics.active = "invalid:key";
    expect(Value.Check(ReportSpecSchema, invalidReport)).toBe(false);
    expect(() => assertReportReferentialIntegrity(invalidReport)).toThrow(
      "invalid active heuristic pair key: 'invalid:key'",
    );
  });

  it("rejects malformed variant payload structurally via TypeBox", () => {
    const invalidReport = JSON.parse(JSON.stringify(fixtureReport));
    const comp = invalidReport.sections[0].items[0];
    comp.spec.variants["excluded:excluded"] = {
      status: "available",
      stateDistributions: [], // minItems: 1 violation
      exclusions: [],
    };
    expect(Value.Check(OutcomeDistributionSpecSchema, comp.spec)).toBe(false);
  });

  it("rejects report with duplicate heuristic in available array", () => {
    const invalidReport = JSON.parse(JSON.stringify(fixtureReport));
    invalidReport.heuristics.available.push("adjusted:adjusted_as_censored");
    expect(() => assertReportReferentialIntegrity(invalidReport)).toThrow(
      "duplicate heuristic pair key in available: 'adjusted:adjusted_as_censored'",
    );
  });

  it("rejects report when active heuristic is missing from available heuristics", () => {
    const invalidReport = JSON.parse(JSON.stringify(fixtureReport));
    invalidReport.heuristics.available = ["excluded:excluded"];
    invalidReport.heuristics.active = "adjusted:adjusted_as_censored";
    expect(() => assertReportReferentialIntegrity(invalidReport)).toThrow(
      "active heuristic 'adjusted:adjusted_as_censored' must be present in available heuristics",
    );
  });

  it("rejects component variant key not declared in report heuristics.available", () => {
    const invalidReport = JSON.parse(JSON.stringify(fixtureReport));
    invalidReport.heuristics.available = ["adjusted:adjusted_as_censored"];
    invalidReport.heuristics.active = "adjusted:adjusted_as_censored";
    expect(() => assertReportReferentialIntegrity(invalidReport)).toThrow(
      "component 'fixture-a-outcome-distribution' variant 'excluded:excluded' is not declared in report heuristics.available",
    );
  });

  it("supports typed status: 'unsupported' variants", () => {
    const reportWithUnsupported = JSON.parse(JSON.stringify(fixtureReport));
    const comp = reportWithUnsupported.sections[0].items[0];
    comp.spec.variants["excluded:excluded"] = { status: "unsupported" };

    expect(() =>
      assertReportReferentialIntegrity(reportWithUnsupported),
    ).not.toThrow();
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(comp.spec),
    ).not.toThrow();
  });

  it("rejects variant with unknown evaluation id in exclusions", () => {
    const report = JSON.parse(JSON.stringify(fixtureReport));
    const comp = report.sections[0].items[0];
    comp.spec.variants["excluded:excluded"].exclusions[0].evaluationId =
      "unknown-eval";

    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(comp.spec),
    ).toThrow("unknown evaluation id: unknown-eval");
  });

  it("rejects variant exclusion count exceeding original sample size", () => {
    const report = JSON.parse(JSON.stringify(fixtureReport));
    const comp = report.sections[0].items[0];
    comp.spec.variants[
      "excluded:excluded"
    ].exclusions[0].excludedCounts[0].censoredExcludedCount = 10;

    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(comp.spec),
    ).toThrow("total excluded count (11) exceeds original sample size (8)");
  });

  it("validates legacy reports without heuristic configuration seamlessly", () => {
    const legacyReport = {
      schemaVersion: "1.1",
      type: "report",
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "comp-1",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                evaluations: [{ id: "e1", population: "Pop 1" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    estimator: "raw",
                    states: [{ stateId: "s1", count: 10 }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(() =>
      assertReportReferentialIntegrity(legacyReport as any),
    ).not.toThrow();
  });

  it("validates multi-population variant exclusions correctly", () => {
    const multiPopReport = JSON.parse(JSON.stringify(fixtureReport));
    const comp = multiPopReport.sections[0].items[0];
    comp.spec.evaluations.push({
      id: "fixture-a-eval-2",
      population: "Fixture A Cohort 2",
    });

    // Add state distributions for pop 2
    comp.spec.stateDistributions.push({
      evaluationId: "fixture-a-eval-2",
      horizon: 5,
      estimator: "aalen_johansen",
      states: [{ stateId: "primary", estimate: 0.2 }, { stateId: "event_free", estimate: 0.8 }],
    });

    const exEx = comp.spec.variants["excluded:excluded"];
    exEx.stateDistributions.push({
      evaluationId: "fixture-a-eval-2",
      horizon: 5,
      estimator: "kaplan_meier",
      states: [{ stateId: "primary", estimate: 0.2 }, { stateId: "event_free", estimate: 0.8 }],
    });
    exEx.exclusions.push({
      evaluationId: "fixture-a-eval-2",
      originalSampleSize: 10,
      excludedCounts: [
        { horizon: 5, censoredExcludedCount: 1, competingExcludedCount: 1 },
      ],
    });

    expect(() =>
      assertReportReferentialIntegrity(multiPopReport),
    ).not.toThrow();
    expect(() =>
      assertOutcomeDistributionReferentialIntegrity(comp.spec),
    ).not.toThrow();
  });
});
