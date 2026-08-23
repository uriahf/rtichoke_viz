import type { PerformanceTableSpec } from "./performance-table.js";

export function assertPerformanceTableReferentialIntegrity(
  spec: PerformanceTableSpec,
): void {
  const evaluationIds = new Set<string>();
  for (const evaluation of spec.evaluations) {
    if (evaluationIds.has(evaluation.id)) {
      throw new Error(`duplicate evaluation id: ${evaluation.id}`);
    }
    evaluationIds.add(evaluation.id);
  }

  const metricIds = new Set<string>();
  for (const metric of spec.metrics) {
    if (metricIds.has(metric.id)) {
      throw new Error(`duplicate metric id: ${metric.id}`);
    }
    metricIds.add(metric.id);
  }

  for (const row of spec.rows) {
    if (!evaluationIds.has(row.evaluationId)) {
      throw new Error(`unknown evaluation id: ${row.evaluationId}`);
    }
    for (const value of row.values) {
      if (!metricIds.has(value.metricId)) {
        throw new Error(`unknown metric id: ${value.metricId}`);
      }
    }
  }
}
