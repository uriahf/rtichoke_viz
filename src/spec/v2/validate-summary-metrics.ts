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

    if (item.metric === "auroc") {
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
    }
  }
}
