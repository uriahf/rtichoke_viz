import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/summary-metrics.json" with { type: "json" };
import { StandaloneCanonicalSpecSchema } from "../src/spec/report.js";
import { RtichokeChartSpecV2Schema } from "../src/spec/v2/chart.js";
import {
  SummaryMetricsSpecSchema,
  type SummaryMetricsSpec,
} from "../src/spec/v2/summary-metrics.js";
import { assertSummaryMetricsReferentialIntegrity } from "../src/spec/v2/validate-summary-metrics.js";

function spec(): SummaryMetricsSpec {
  return structuredClone(fixture) as SummaryMetricsSpec;
}

describe("SummaryMetricsSpec v1.0", () => {
  it("validates valid AUROC + evaluation owner + finite estimate", () => {
    const s = spec();
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(true);
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).not.toThrow();
  });

  it("validates valid AUROC + evaluation owner + null estimate", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "auroc",
        owner: { type: "evaluation", evaluationId: "eval-1" },
        estimate: null,
      },
    ];
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(true);
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).not.toThrow();
  });

  it("validates valid prevalence + population owner + finite estimate", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "prevalence",
        owner: { type: "population", populationId: "pop-1" },
        estimate: 0.23,
      },
    ];
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(true);
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).not.toThrow();
  });

  it("rejects AUROC with population owner", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "auroc",
        owner: { type: "population", populationId: "pop-1" } as any,
        estimate: 0.82,
      },
    ];
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(false);
  });

  it("rejects prevalence with evaluation owner", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "prevalence",
        owner: { type: "evaluation", evaluationId: "eval-1" } as any,
        estimate: 0.23,
      },
    ];
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(false);
  });

  it("rejects unknown metric kind", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "c_index" as any,
        owner: { type: "evaluation", evaluationId: "eval-1" },
        estimate: 0.82,
      },
    ];
    expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(false);
  });

  it("rejects non-finite estimate in validation", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "auroc",
        owner: { type: "evaluation", evaluationId: "eval-1" },
        estimate: NaN,
      },
    ];
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "non-finite metric estimate",
    );
  });

  it("rejects duplicate population IDs", () => {
    const s = spec();
    s.populations.push({ id: "pop-1", label: "Another label" });
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "duplicate population id: pop-1",
    );
  });

  it("rejects unknown AUROC evaluationId", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "auroc",
        owner: { type: "evaluation", evaluationId: "missing-eval" },
        estimate: 0.8,
      },
    ];
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "unknown evaluation id: missing-eval",
    );
  });

  it("rejects unknown prevalence populationId", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "prevalence",
        owner: { type: "population", populationId: "missing-pop" },
        estimate: 0.1,
      },
    ];
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "unknown population id: missing-pop",
    );
  });

  it("rejects duplicate AUROC for one evaluation", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "auroc",
        owner: { type: "evaluation", evaluationId: "eval-1" },
        estimate: 0.82,
      },
      {
        metric: "auroc",
        owner: { type: "evaluation", evaluationId: "eval-1" },
        estimate: 0.85,
      },
    ];
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "duplicate metric ownership: auroc for evaluation eval-1",
    );
  });

  it("rejects duplicate prevalence for one population", () => {
    const s = spec();
    s.metrics = [
      {
        metric: "prevalence",
        owner: { type: "population", populationId: "pop-1" },
        estimate: 0.23,
      },
      {
        metric: "prevalence",
        owner: { type: "population", populationId: "pop-1" },
        estimate: 0.25,
      },
    ];
    expect(() => assertSummaryMetricsReferentialIntegrity(s)).toThrow(
      "duplicate metric ownership: prevalence for population pop-1",
    );
  });

  describe("Population identity independence", () => {
    it("allows two populations to have the same visible label if IDs differ", () => {
      const s = spec();
      s.populations = [
        { id: "pop-a", label: "Shared Label" },
        { id: "pop-b", label: "Shared Label" },
      ];
      s.metrics = [
        {
          metric: "prevalence",
          owner: { type: "population", populationId: "pop-a" },
          estimate: 0.2,
        },
        {
          metric: "prevalence",
          owner: { type: "population", populationId: "pop-b" },
          estimate: 0.3,
        },
      ];
      expect(Value.Check(SummaryMetricsSpecSchema, s)).toBe(true);
      expect(() => assertSummaryMetricsReferentialIntegrity(s)).not.toThrow();
    });

    it("does not infer population ownership by matching evaluation.population", () => {
      const s = spec();
      // evaluation.population string is "Validation", but population.id is "pop-1" with label "Validation cohort"
      expect(s.evaluations[0].population).toBe("Validation");
      expect(s.populations[0].id).toBe("pop-1");
      expect(s.populations[0].label).toBe("Validation cohort");
      expect(() => assertSummaryMetricsReferentialIntegrity(s)).not.toThrow();
    });
  });

  it("is a standalone canonical spec, not a chart spec", () => {
    const s = spec();
    expect(Value.Check(StandaloneCanonicalSpecSchema, s)).toBe(true);
    expect(Value.Check(RtichokeChartSpecV2Schema, s)).toBe(false);
  });
});
