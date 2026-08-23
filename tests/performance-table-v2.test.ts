import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/performance-table.json" with { type: "json" };
import { RtichokeChartSpecV2Schema } from "../src/spec/v2/chart.js";
import {
  PerformanceTableSpecSchema,
  type PerformanceTableSpec,
} from "../src/spec/v2/performance-table.js";
import { assertPerformanceTableReferentialIntegrity } from "../src/spec/v2/validate-performance-table.js";

function spec(): PerformanceTableSpec {
  return structuredClone(fixture) as PerformanceTableSpec;
}

describe("canonical v2 performance table", () => {
  it("validates the compact semantic scenario matrix", () => {
    const value = spec();
    expect(Value.Check(PerformanceTableSpecSchema, value)).toBe(true);
    expect(() => assertPerformanceTableReferentialIntegrity(value)).not.toThrow();
  });

  it("is a sibling surface, not a chart spec", () => {
    expect(Value.Check(RtichokeChartSpecV2Schema, spec())).toBe(false);
  });

  it("represents probability-threshold and PPCR operating points", () => {
    const rows = spec().rows;
    expect(rows[0].operatingPoint).toEqual({
      type: "probability_threshold",
      value: 0.25,
    });
    expect(rows[1].operatingPoint).toEqual({ type: "ppcr", value: 0.2 });
  });

  it("preserves shared and distinct population evaluation identity", () => {
    const evaluations = spec().evaluations;
    expect(evaluations[0].population).toBe(evaluations[1].population);
    expect(evaluations[0].population).not.toBe(evaluations[2].population);
    expect(spec().rows[0].values[0].estimate).toBe(spec().rows[2].values[0].estimate);
    expect(spec().rows[0].evaluationId).not.toBe(spec().rows[2].evaluationId);
  });

  it("preserves model-known and model-unknown evaluations", () => {
    const evaluations = spec().evaluations;
    expect(evaluations[0].model).toBe("model-a");
    expect(evaluations[3].model).toBeUndefined();
  });

  it("supports one evaluation across multiple horizons and a narrow context", () => {
    const rows = spec().rows.slice(3);
    expect(rows.map((row) => row.evaluationId)).toEqual([
      "eval-unknown-pop-c",
      "eval-unknown-pop-c",
    ]);
    expect(rows.map((row) => row.horizon)).toEqual([365, 730]);
    expect(rows[0].context).toEqual({
      censoringHeuristic: "adjusted",
      competingEventHeuristic: "adjusted_as_negative",
    });
  });

  it("distinguishes zero, null, and an omitted metric", () => {
    const rows = spec().rows;
    expect(rows[0].values.find((value) => value.metricId === "net_benefit")?.estimate).toBe(0);
    expect(rows[1].values.find((value) => value.metricId === "ppv")?.estimate).toBeNull();
    expect(rows[1].values.find((value) => value.metricId === "net_benefit")).toBeUndefined();
  });

  it("permits optional uncertainty without requiring it", () => {
    const value = spec();
    value.rows[0].values[0].lower = 0.76;
    value.rows[0].values[0].upper = 0.87;
    expect(Value.Check(PerformanceTableSpecSchema, value)).toBe(true);
  });

  it("rejects duplicate evaluation ids", () => {
    const value = spec();
    value.evaluations.push({ ...value.evaluations[0] });
    expect(() => assertPerformanceTableReferentialIntegrity(value)).toThrow(
      "duplicate evaluation id: eval-model-a-pop-a",
    );
  });

  it("rejects duplicate metric ids", () => {
    const value = spec();
    value.metrics.push({ ...value.metrics[0] });
    expect(() => assertPerformanceTableReferentialIntegrity(value)).toThrow(
      "duplicate metric id: sensitivity",
    );
  });

  it("rejects dangling row evaluation ids", () => {
    const value = spec();
    value.rows[0].evaluationId = "missing-evaluation";
    expect(() => assertPerformanceTableReferentialIntegrity(value)).toThrow(
      "unknown evaluation id: missing-evaluation",
    );
  });

  it("rejects dangling metric ids", () => {
    const value = spec();
    value.rows[0].values[0].metricId = "missing" as "sensitivity";
    expect(() => assertPerformanceTableReferentialIntegrity(value)).toThrow(
      "unknown metric id: missing",
    );
  });
});
