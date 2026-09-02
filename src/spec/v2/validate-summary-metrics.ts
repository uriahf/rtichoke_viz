import type { SummaryMetricsSpec } from "./summary-metrics.js";

export function assertSummaryMetricsReferentialIntegrity(
  spec: SummaryMetricsSpec,
): void {
  const evaluationIds = new Set<string>();
  for (const evaluation of spec.evaluations) {
    if (evaluationIds.has(evaluation.id)) {
      throw new Error(`duplicate evaluation id: ${evaluation.id}`);
    }
    evaluationIds.add(evaluation.id);
  }

  const populationIds = new Set<string>();
  for (const population of spec.populations) {
    if (populationIds.has(population.id)) {
      throw new Error(`duplicate population id: ${population.id}`);
    }
    populationIds.add(population.id);
  }

  const seenMetrics = new Set<string>();

  for (const item of spec.metrics) {
    if (item.estimate !== null && !Number.isFinite(item.estimate)) {
      throw new Error(`non-finite metric estimate: ${item.estimate}`);
    }

    if ("horizon" in item && item.horizon !== undefined) {
      if (!Number.isFinite(item.horizon) || item.horizon < 0) {
        throw new Error(`invalid horizon: ${item.horizon}`);
      }
    }

    if (item.metric === "auroc") {
      if ("horizon" in item && item.horizon !== undefined) {
        throw new Error("auroc metric cannot specify horizon");
      }
      if (!evaluationIds.has(item.owner.evaluationId)) {
        throw new Error(`unknown evaluation id: ${item.owner.evaluationId}`);
      }
      const key = `auroc:${item.owner.evaluationId}`;
      if (seenMetrics.has(key)) {
        throw new Error(
          `duplicate metric ownership: auroc for evaluation ${item.owner.evaluationId}`,
        );
      }
      seenMetrics.add(key);
    } else if (item.metric === "prevalence") {
      if ("horizon" in item && item.horizon !== undefined) {
        throw new Error("prevalence metric cannot specify horizon");
      }
      if (!populationIds.has(item.owner.populationId)) {
        throw new Error(`unknown population id: ${item.owner.populationId}`);
      }
      const key = `prevalence:${item.owner.populationId}`;
      if (seenMetrics.has(key)) {
        throw new Error(
          `duplicate metric ownership: prevalence for population ${item.owner.populationId}`,
        );
      }
      seenMetrics.add(key);
    } else if (item.metric === "event_risk") {
      if (spec.schemaVersion !== "1.1") {
        throw new Error(
          `event_risk metric requires schemaVersion 1.1, got ${spec.schemaVersion}`,
        );
      }
      if (!("horizon" in item) || item.horizon === undefined) {
        throw new Error("event_risk metric requires horizon");
      }
      if (!populationIds.has(item.owner.populationId)) {
        throw new Error(`unknown population id: ${item.owner.populationId}`);
      }
      const key = `event_risk:${item.owner.populationId}:${item.horizon}`;
      if (seenMetrics.has(key)) {
        throw new Error(
          `duplicate metric ownership: event_risk for population ${item.owner.populationId} at horizon ${item.horizon}`,
        );
      }
      seenMetrics.add(key);
    }
  }
}
