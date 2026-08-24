import type {
  PerformanceMetricValue,
  PerformanceTableSpec,
} from "../spec/v2/performance-table.js";
import { assertPerformanceTableReferentialIntegrity } from "../spec/v2/validate-performance-table.js";

const MISSING = "—";

function cell(document: Document, text: string, className?: string): HTMLTableCellElement {
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(value);
}

function formatMetric(value: PerformanceMetricValue | undefined): string {
  if (!value || value.estimate === null) return MISSING;
  const estimate = formatNumber(value.estimate);
  if (value.lower === undefined && value.upper === undefined) return estimate;
  const lower = value.lower === undefined || value.lower === null ? MISSING : formatNumber(value.lower);
  const upper = value.upper === undefined || value.upper === null ? MISSING : formatNumber(value.upper);
  return `${estimate} [${lower}, ${upper}]`;
}

function formatOperatingPoint(type: string, value: number): string {
  return type === "ppcr" ? `PPCR ${formatNumber(value)}` : `Threshold ${formatNumber(value)}`;
}

function formatContext(context: PerformanceTableSpec["rows"][number]["context"]): string {
  if (!context) return MISSING;
  const parts: string[] = [];
  if (context.censoringHeuristic) parts.push(`censoring: ${context.censoringHeuristic}`);
  if (context.competingEventHeuristic) parts.push(`competing event: ${context.competingEventHeuristic}`);
  return parts.length ? parts.join("; ") : MISSING;
}

/** Render a canonical PerformanceTableSpec as a semantic HTML table. */
export function renderPerformanceTable(
  spec: PerformanceTableSpec,
  document: Document = globalThis.document,
): HTMLDivElement {
  assertPerformanceTableReferentialIntegrity(spec);

  const root = document.createElement("div");
  root.className = "rtichoke-performance-table";
  if (spec.title) {
    const title = document.createElement("div");
    title.className = "rtichoke-performance-table__title";
    title.textContent = spec.title;
    root.append(title);
  }

  const table = document.createElement("table");
  table.className = "rtichoke-performance-table__table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Model", "Population", "Evaluation", "Operating point", "Horizon", "Context"]) {
    headRow.append(header(document, label));
  }
  for (const metric of spec.metrics) headRow.append(header(document, metric.label));
  head.append(headRow);
  table.append(head);

  const evaluations = new Map(spec.evaluations.map((evaluation) => [evaluation.id, evaluation]));
  const body = document.createElement("tbody");
  for (const row of spec.rows) {
    const evaluation = evaluations.get(row.evaluationId)!;
    const tr = document.createElement("tr");
    tr.dataset.evaluationId = row.evaluationId;
    tr.append(cell(document, evaluation.model ?? MISSING, "rtichoke-performance-table__model"));
    tr.append(cell(document, evaluation.population, "rtichoke-performance-table__population"));
    tr.append(cell(document, evaluation.label ?? evaluation.id, "rtichoke-performance-table__evaluation"));
    tr.append(cell(document, formatOperatingPoint(row.operatingPoint.type, row.operatingPoint.value)));
    tr.append(cell(document, row.horizon === undefined ? MISSING : formatNumber(row.horizon)));
    tr.append(cell(document, formatContext(row.context)));

    const values = new Map(row.values.map((value) => [value.metricId, value]));
    for (const metric of spec.metrics) {
      const td = cell(document, formatMetric(values.get(metric.id)), "rtichoke-performance-table__metric");
      td.dataset.metricId = metric.id;
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  root.append(table);
  return root;
}
