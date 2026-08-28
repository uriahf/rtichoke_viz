import type { SummaryMetricsSpec } from "../spec/v2/summary-metrics.js";
import { assertSummaryMetricsReferentialIntegrity } from "../spec/v2/validate-summary-metrics.js";

const MISSING = "—";

function cell(
  document: Document,
  text: string,
  className?: string,
): HTMLTableCellElement {
  const element = document.createElement("td");
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function header(document: Document, text: string): HTMLTableCellElement {
  const element = document.createElement("th");
  element.scope = "col";
  element.textContent = text;
  return element;
}

function formatEstimate(value: number | null): string {
  if (value === null) return MISSING;
  return value.toFixed(2);
}

/** Render a canonical SummaryMetricsSpec as a semantic HTML table. */
export function renderSummaryMetrics(
  spec: SummaryMetricsSpec,
  document: Document = globalThis.document,
): HTMLDivElement {
  assertSummaryMetricsReferentialIntegrity(spec);

  const root = document.createElement("div");
  root.className = "rtichoke-summary-metrics";
  if (spec.title) {
    const title = document.createElement("div");
    title.className = "rtichoke-summary-metrics__title";
    title.textContent = spec.title;
    root.append(title);
  }

  const table = document.createElement("table");
  table.className = "rtichoke-summary-metrics__table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Owner", "Metric", "Estimate"]) {
    headRow.append(header(document, label));
  }
  head.append(headRow);
  table.append(head);

  const evaluations = new Map(
    spec.evaluations.map((evaluation) => [evaluation.id, evaluation]),
  );
  const populations = new Map(
    spec.populations.map((population) => [population.id, population]),
  );

  const body = document.createElement("tbody");
  for (const item of spec.metrics) {
    const tr = document.createElement("tr");

    let ownerLabel = "";
    let metricLabel = "";

    if (item.metric === "auroc") {
      const evaluation = evaluations.get(item.owner.evaluationId)!;
      ownerLabel =
        evaluation.label ??
        evaluation.model ??
        evaluation.population ??
        evaluation.id;
      metricLabel = "AUROC";
      tr.dataset.metric = "auroc";
      tr.dataset.evaluationId = item.owner.evaluationId;
    } else if (item.metric === "prevalence") {
      const population = populations.get(item.owner.populationId)!;
      ownerLabel = population.label;
      metricLabel = "Prevalence";
      tr.dataset.metric = "prevalence";
      tr.dataset.populationId = item.owner.populationId;
    }

    tr.append(
      cell(document, ownerLabel, "rtichoke-summary-metrics__owner"),
      cell(document, metricLabel, "rtichoke-summary-metrics__metric"),
    );

    const estimateCell = cell(
      document,
      formatEstimate(item.estimate),
      "rtichoke-summary-metrics__estimate",
    );
    if (item.estimate === null) {
      estimateCell.dataset.unavailable = "true";
    } else {
      estimateCell.dataset.estimate = String(item.estimate);
    }
    tr.append(estimateCell);

    body.append(tr);
  }

  table.append(body);
  root.append(table);
  return root;
}
