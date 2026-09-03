import type {
  PerformanceEvaluationContext,
  PerformanceMetricId,
  PerformanceMetricValue,
  PerformanceTableSpec,
} from "../spec/v2/performance-table.js";
import { assertPerformanceTableReferentialIntegrity } from "../spec/v2/validate-performance-table.js";

const MISSING = "—";

const PRIMARY_METRIC_ORDER: { id: PerformanceMetricId; defaultLabel: string }[] = [
  { id: "sensitivity", defaultLabel: "Sensitivity" },
  { id: "specificity", defaultLabel: "Specificity" },
  { id: "ppv", defaultLabel: "PPV" },
  { id: "npv", defaultLabel: "NPV" },
  { id: "lift", defaultLabel: "Lift" },
  { id: "net_benefit", defaultLabel: "Net Benefit" },
];

function cell(document: Document, text: string, className?: string): HTMLTableCellElement {
  const element = document.createElement("td");
  const contentSpan = document.createElement("span");
  contentSpan.className = "rtichoke-performance-table__cell-text";
  contentSpan.textContent = text;
  element.append(contentSpan);
  if (className) element.className = className;
  return element;
}

function header(
  document: Document,
  text: string,
  options?: { colSpan?: number; rowSpan?: number; scope?: string; className?: string; ariaLabel?: string }
): HTMLTableCellElement {
  const element = document.createElement("th");
  element.scope = options?.scope ?? "col";
  if (options?.colSpan) element.colSpan = options.colSpan;
  if (options?.rowSpan) element.rowSpan = options.rowSpan;
  element.textContent = text;
  if (options?.className) element.className = options.className;
  if (options?.ariaLabel) element.setAttribute("aria-label", options.ariaLabel);
  return element;
}

interface ConfusionCounts {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

function extractConfusionCounts(rowValues: PerformanceMetricValue[]): ConfusionCounts | null {
  const map = new Map(rowValues.map((v) => [v.metricId, v.estimate]));
  const tp = map.get("true_positives");
  const tn = map.get("true_negatives");
  const fp = map.get("false_positives");
  const fn = map.get("false_negatives");

  if (
    tp === undefined || tp === null || isNaN(tp) ||
    tn === undefined || tn === null || isNaN(tn) ||
    fp === undefined || fp === null || isNaN(fp) ||
    fn === undefined || fn === null || isNaN(fn)
  ) {
    return null;
  }

  return { tp, tn, fp, fn };
}

function renderConfusionCell(
  document: Document,
  val: number,
  n: number,
  className: string
): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = className;

  const valSpan = document.createElement("span");
  valSpan.className = "rtichoke-performance-table__confusion-val";
  valSpan.textContent = formatCount(val);

  const pctSpan = document.createElement("span");
  pctSpan.className = "rtichoke-performance-table__confusion-pct";
  if (n > 0 && !isNaN(val) && !isNaN(n)) {
    const pct = (val / n) * 100;
    pctSpan.textContent = `${pct.toFixed(2)}%`;
  } else {
    pctSpan.textContent = MISSING;
  }

  td.append(valSpan, pctSpan);
  return td;
}

let tableInstanceCounter = 0;

export function humanizeContextValue(val: string): string {
  return val
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function formatCount(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val);
}

export function format2Decimals(val: number): string {
  return val.toFixed(2);
}

export function determineThresholdPrecision(values: number[]): number {
  if (values.length <= 1) return 2;
  let decimals = 2;
  while (decimals <= 6) {
    const formatted = values.map((v) => v.toFixed(decimals));
    const uniqueFormatted = new Set(formatted);
    if (uniqueFormatted.size === new Set(values).size) {
      return decimals;
    }
    decimals++;
  }
  return decimals;
}

function formatMetricValue(value: PerformanceMetricValue | undefined, formatter: (n: number) => string): string {
  if (!value || value.estimate === null || value.estimate === undefined || isNaN(value.estimate)) return MISSING;
  const est = formatter(value.estimate);
  if (value.lower === undefined && value.upper === undefined) return est;
  const lower = value.lower === undefined || value.lower === null || isNaN(value.lower) ? MISSING : formatter(value.lower);
  const upper = value.upper === undefined || value.upper === null || isNaN(value.upper) ? MISSING : formatter(value.upper);
  return `${est} [${lower}, ${upper}]`;
}

function appendInCellBar(
  td: HTMLTableCellElement,
  document: Document,
  percent: number,
  isDiverging: boolean = false,
  isNegative: boolean = false,
  barStyle: "positive" | "negative" | "neutral" = "positive",
): void {
  if (isNaN(percent) || !isFinite(percent)) return;
  const bar = document.createElement("div");
  bar.className = "rtichoke-performance-table__bar";

  const fill = document.createElement("div");
  fill.className = "rtichoke-performance-table__bar-fill";

  if (isDiverging) {
    const width = Math.min(Math.max(percent, 0), 50);
    fill.style.width = `${width}%`;
    if (isNegative) {
      fill.classList.add("rtichoke-performance-table__bar-fill--negative");
      fill.style.right = "50%";
      fill.style.left = "auto";
    } else {
      fill.classList.add("rtichoke-performance-table__bar-fill--positive");
      fill.style.left = "50%";
      fill.style.right = "auto";
    }
  } else {
    const width = Math.min(Math.max(percent, 0), 100);
    fill.style.width = `${width}%`;
    if (barStyle === "neutral") {
      fill.classList.add("rtichoke-performance-table__bar-fill--neutral");
    } else {
      fill.classList.add("rtichoke-performance-table__bar-fill--positive");
    }
  }

  bar.append(fill);
  td.append(bar);
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

  const scrollWrapper = document.createElement("div");
  scrollWrapper.className = "rtichoke-performance-table__scroll";

  const table = document.createElement("table");
  table.className = "rtichoke-performance-table__table";

  const evaluationsMap = new Map(spec.evaluations.map((ev) => [ev.id, ev]));

  // 1. Identity Columns Determination
  const distinctModels = new Set(spec.evaluations.map((e) => e.model).filter(Boolean));
  const distinctPopulations = new Set(spec.evaluations.map((e) => e.population).filter(Boolean));

  const showModel = distinctModels.size > 1;
  const showPopulation = distinctPopulations.size > 1;

  const renderModelCol = showModel;
  const renderPopulationCol = showPopulation || (!showModel && distinctModels.size === 0 && distinctPopulations.size > 1);

  const showEvaluationLabel = spec.evaluations.some((e) => {
    if (!e.label) return false;
    if (showModel && e.label !== e.model) return true;
    if (showPopulation && e.label !== e.population) return true;
    if (!showModel && !showPopulation && e.label !== e.model && e.label !== e.population) return true;
    return false;
  });

  // 2. Context & Horizon Columns Determination
  const hasHorizon = spec.rows.some((r) => r.horizon !== undefined);
  const hasCensoring = spec.rows.some((r) => r.context?.censoringHeuristic !== undefined);
  const hasCompetingEvent = spec.rows.some((r) => r.context?.competingEventHeuristic !== undefined);

  // 3. Operating Point & Composite Determination
  const operatingTypes = new Set(spec.rows.map((r) => r.operatingPoint.type));
  const isPureThreshold = operatingTypes.size === 1 && operatingTypes.has("probability_threshold");
  const isPurePpcr = operatingTypes.size === 1 && operatingTypes.has("ppcr");

  const specMetricIds = new Set(spec.metrics.map((m) => m.id));
  const hasPredictedPositivesMetric = specMetricIds.has("predicted_positives");
  const hasPpcrMetric = specMetricIds.has("ppcr");
  const canConstructComposite = hasPredictedPositivesMetric && (hasPpcrMetric || isPurePpcr);

  // Column policy:
  // - Probability Threshold tables: keep "Probability Threshold" column. If composite predicted_positives + ppcr available, additionally show "Predicted Positives" column.
  // - PPCR tables: show "Predicted Positives" column if composite can be constructed. Otherwise fall back to dedicated "PPCR" column.
  const renderThresholdCol = isPureThreshold || (!isPurePpcr && operatingTypes.has("probability_threshold"));
  const renderCompositePredPosCol = canConstructComposite;
  const renderPpcrFallbackCol = isPurePpcr && !canConstructComposite;
  const renderGenericOpCol = !isPureThreshold && !isPurePpcr && !canConstructComposite;

  // Determine Threshold Precision
  const thresholdValues = spec.rows
    .filter((r) => r.operatingPoint.type === "probability_threshold")
    .map((r) => r.operatingPoint.value);
  const thresholdPrecision = determineThresholdPrecision(thresholdValues);

  // 4. Primary Metrics Determination & Ordering
  const primaryMetricSpecs = PRIMARY_METRIC_ORDER
    .map((p) => {
      const match = spec.metrics.find((m) => m.id === p.id);
      return match ? { id: match.id, label: match.label || p.defaultLabel } : null;
    })
    .filter((m): m is { id: PerformanceMetricId; label: string } => m !== null);

  // Deduplicate synonyms if both 'ppv' and 'positive_predictive_value' exist
  const seenLabels = new Set<string>();
  const activePrimaryMetrics = primaryMetricSpecs.filter((m) => {
    if (seenLabels.has(m.label)) return false;
    seenLabels.add(m.label);
    return true;
  });

  // Calculate Max Lift and Max Net Benefit for scaling bars
  let maxLift = 0;
  let maxAbsNB = 0;
  for (const row of spec.rows) {
    for (const val of row.values) {
      if (val.metricId === "lift" && val.estimate !== null && val.estimate !== undefined && isFinite(val.estimate)) {
        if (val.estimate > maxLift) maxLift = val.estimate;
      }
      if (val.metricId === "net_benefit" && val.estimate !== null && val.estimate !== undefined && isFinite(val.estimate)) {
        const absVal = Math.abs(val.estimate);
        if (absVal > maxAbsNB) maxAbsNB = absVal;
      }
    }
  }

  const currentTableInstance = ++tableInstanceCounter;

  // Build 2-Tier Header
  const head = document.createElement("thead");
  head.className = "rtichoke-performance-table__header";

  const topRow = document.createElement("tr");
  const bottomRow = document.createElement("tr");

  // Always include the first disclosure column
  let nonMetricColCount = 1;
  bottomRow.append(header(document, "", { ariaLabel: "Row details", className: "rtichoke-performance-table__toggle-header" }));

  if (renderModelCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Model"));
  }
  if (renderPopulationCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Population"));
  }
  if (showEvaluationLabel) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Evaluation"));
  }

  if (renderThresholdCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Probability Threshold"));
  }
  if (renderCompositePredPosCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Predicted Positives"));
  }
  if (renderPpcrFallbackCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "PPCR"));
  }
  if (renderGenericOpCol) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Operating Point"));
  }

  if (hasHorizon) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Time Horizon"));
  }
  if (hasCensoring) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Censoring"));
  }
  if (hasCompetingEvent) {
    nonMetricColCount++;
    bottomRow.append(header(document, "Competing Event"));
  }

  if (activePrimaryMetrics.length > 0) {
    const emptySpanner = header(document, "", { colSpan: nonMetricColCount, className: "rtichoke-performance-table__spanner--empty" });
    topRow.append(emptySpanner);
  }

  if (activePrimaryMetrics.length > 0) {
    const metricsSpanner = header(document, "Performance Metrics", {
      colSpan: activePrimaryMetrics.length,
      className: "rtichoke-performance-table__spanner",
    });
    topRow.append(metricsSpanner);

    for (const metric of activePrimaryMetrics) {
      bottomRow.append(header(document, metric.label, { className: "rtichoke-performance-table__metric-header" }));
    }
  }

  head.append(topRow);
  head.append(bottomRow);
  table.append(head);

  // Calculate total columns for colSpan in detail row
  const totalColumns = nonMetricColCount + activePrimaryMetrics.length;

  // Build Body Rows
  const body = document.createElement("tbody");

  for (let rowIndex = 0; rowIndex < spec.rows.length; rowIndex++) {
    const row = spec.rows[rowIndex];
    const evaluation = evaluationsMap.get(row.evaluationId);
    const tr = document.createElement("tr");
    tr.dataset.evaluationId = row.evaluationId;

    const confusion = extractConfusionCounts(row.values);
    const detailId = `rtichoke-confusion-detail-${currentTableInstance}-${rowIndex}`;

    // Disclosure column
    const toggleTd = document.createElement("td");
    toggleTd.className = "rtichoke-performance-table__toggle-cell";

    let detailTr: HTMLTableRowElement | null = null;

    if (confusion) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "rtichoke-performance-table__toggle-btn";
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-controls", detailId);
      toggleBtn.setAttribute("aria-label", "Show confusion matrix detail");
      toggleBtn.textContent = "▸";

      toggleTd.append(toggleBtn);

      // Create subordinate detail row
      detailTr = document.createElement("tr");
      detailTr.className = "rtichoke-performance-table__detail-row";
      detailTr.hidden = true;

      const detailTd = document.createElement("td");
      detailTd.colSpan = totalColumns;
      detailTd.className = "rtichoke-performance-table__detail-cell";

      const detailContainer = document.createElement("div");
      detailContainer.id = detailId;
      detailContainer.className = "rtichoke-performance-table__confusion-container";

      // Semantic identity attributes
      if (row.evaluationId) {
        detailContainer.setAttribute("data-evaluation-id", row.evaluationId);
      }
      detailContainer.setAttribute("data-operating-point-type", row.operatingPoint.type);
      detailContainer.setAttribute("data-operating-point-value", row.operatingPoint.value.toString());

      // Header title & caption
      const isHorizon = row.horizon !== undefined;
      const titleDiv = document.createElement("div");
      titleDiv.className = "rtichoke-performance-table__confusion-title";
      titleDiv.textContent = isHorizon ? "Estimated Confusion Matrix" : "Confusion Matrix";
      detailContainer.append(titleDiv);

      if (isHorizon) {
        const captionDiv = document.createElement("div");
        captionDiv.className = "rtichoke-performance-table__confusion-caption";
        captionDiv.textContent = "Estimated classification quantities at the displayed time horizon.";
        detailContainer.append(captionDiv);
      }

      // Matrix table
      const matrixTable = document.createElement("table");
      matrixTable.className = "rtichoke-performance-table__confusion-table";

      const mHead = document.createElement("thead");
      const mTopRow = document.createElement("tr");
      mTopRow.append(
        header(document, "", { className: "rtichoke-performance-table__confusion-header-empty" }),
        header(document, "Predicted", { colSpan: 3, className: "rtichoke-performance-table__confusion-spanner" })
      );

      const mSubRow = document.createElement("tr");
      mSubRow.append(
        header(document, "", { className: "rtichoke-performance-table__confusion-header-empty" }),
        header(document, "Positive"),
        header(document, "Negative"),
        header(document, "Total")
      );

      mHead.append(mTopRow, mSubRow);
      matrixTable.append(mHead);

      const mBody = document.createElement("tbody");

      const n = confusion.tp + confusion.tn + confusion.fp + confusion.fn;
      const actualPosTotal = confusion.tp + confusion.fn;
      const actualNegTotal = confusion.fp + confusion.tn;
      const predPosTotal = confusion.tp + confusion.fp;
      const predNegTotal = confusion.tn + confusion.fn;

      // Actual Positive Row
      const rPos = document.createElement("tr");
      rPos.append(header(document, "Actual Positive", { scope: "row" }));
      rPos.append(renderConfusionCell(document, confusion.tp, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--favorable"));
      rPos.append(renderConfusionCell(document, confusion.fn, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--unfavorable"));
      rPos.append(renderConfusionCell(document, actualPosTotal, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--total"));
      mBody.append(rPos);

      // Actual Negative Row
      const rNeg = document.createElement("tr");
      rNeg.append(header(document, "Actual Negative", { scope: "row" }));
      rNeg.append(renderConfusionCell(document, confusion.fp, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--unfavorable"));
      rNeg.append(renderConfusionCell(document, confusion.tn, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--favorable"));
      rNeg.append(renderConfusionCell(document, actualNegTotal, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--total"));
      mBody.append(rNeg);

      // Total Row
      const rTot = document.createElement("tr");
      rTot.append(header(document, "Total", { scope: "row" }));
      rTot.append(renderConfusionCell(document, predPosTotal, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--total"));
      rTot.append(renderConfusionCell(document, predNegTotal, n, "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--total"));

      // Grand Total Cell
      const grandTotalTd = document.createElement("td");
      grandTotalTd.className = "rtichoke-performance-table__confusion-cell rtichoke-performance-table__confusion-cell--total";

      const grandValSpan = document.createElement("span");
      grandValSpan.className = "rtichoke-performance-table__confusion-val";
      grandValSpan.textContent = formatCount(n);

      const grandPctSpan = document.createElement("span");
      grandPctSpan.className = "rtichoke-performance-table__confusion-pct";
      grandPctSpan.textContent = n > 0 ? "100.00%" : MISSING;

      grandTotalTd.append(grandValSpan, grandPctSpan);
      rTot.append(grandTotalTd);

      mBody.append(rTot);
      matrixTable.append(mBody);

      detailContainer.append(matrixTable);
      detailTd.append(detailContainer);
      detailTr.append(detailTd);

      // Interaction Handler
      toggleBtn.addEventListener("click", () => {
        if (!detailTr) return;
        const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
        toggleBtn.setAttribute("aria-expanded", isExpanded ? "false" : "true");
        toggleBtn.setAttribute("aria-label", isExpanded ? "Show confusion matrix detail" : "Hide confusion matrix detail");
        toggleBtn.textContent = isExpanded ? "▸" : "▾";
        detailTr.hidden = isExpanded;
      });
    }

    tr.append(toggleTd);

    if (renderModelCol) {
      tr.append(cell(document, evaluation?.model ?? MISSING, "rtichoke-performance-table__model"));
    }
    if (renderPopulationCol) {
      tr.append(cell(document, evaluation?.population ?? MISSING, "rtichoke-performance-table__population"));
    }
    if (showEvaluationLabel) {
      tr.append(cell(document, evaluation?.label ?? evaluation?.id ?? MISSING, "rtichoke-performance-table__evaluation"));
    }

    const valueMap = new Map(row.values.map((v) => [v.metricId, v]));

    // Probability Threshold column
    if (renderThresholdCol) {
      const thVal = row.operatingPoint.type === "probability_threshold" ? row.operatingPoint.value : undefined;
      const formattedTh = thVal !== undefined ? thVal.toFixed(thresholdPrecision) : MISSING;
      tr.append(cell(document, formattedTh, "rtichoke-performance-table__op"));
    }

    // Composite Predicted Positives column
    if (renderCompositePredPosCol) {
      const predPosVal = valueMap.get("predicted_positives")?.estimate;
      const ppcrVal = valueMap.get("ppcr")?.estimate ?? (row.operatingPoint.type === "ppcr" ? row.operatingPoint.value : undefined);

      let text = MISSING;
      let ppcrPercent = NaN;

      if (predPosVal !== undefined && predPosVal !== null && ppcrVal !== undefined && ppcrVal !== null) {
        const formattedCount = formatCount(predPosVal);
        const formattedPct = (ppcrVal * 100).toFixed(2);
        text = `${formattedCount} (${formattedPct}%)`;
        ppcrPercent = ppcrVal * 100;
      } else if (ppcrVal !== undefined && ppcrVal !== null) {
        const formattedPct = (ppcrVal * 100).toFixed(2);
        text = `${formattedPct}%`;
        ppcrPercent = ppcrVal * 100;
      }

      const td = cell(document, text, "rtichoke-performance-table__op");
      if (!isNaN(ppcrPercent)) {
        appendInCellBar(td, document, ppcrPercent, false, false, "neutral");
      }
      tr.append(td);
    }

    // Dedicated PPCR Fallback column
    if (renderPpcrFallbackCol) {
      const ppcrVal = row.operatingPoint.type === "ppcr" ? row.operatingPoint.value : valueMap.get("ppcr")?.estimate;
      const text = ppcrVal !== undefined && ppcrVal !== null ? `PPCR ${ppcrVal.toFixed(2)}` : MISSING;
      const td = cell(document, text, "rtichoke-performance-table__op");
      if (ppcrVal !== undefined && ppcrVal !== null) {
        appendInCellBar(td, document, ppcrVal * 100, false, false, "neutral");
      }
      tr.append(td);
    }

    // Generic Operating Point column
    if (renderGenericOpCol) {
      const opText =
        row.operatingPoint.type === "ppcr"
          ? `PPCR ${row.operatingPoint.value.toFixed(2)}`
          : `Threshold ${row.operatingPoint.value.toFixed(thresholdPrecision)}`;
      tr.append(cell(document, opText, "rtichoke-performance-table__op"));
    }

    if (hasHorizon) {
      tr.append(cell(document, row.horizon !== undefined ? formatCount(row.horizon) : MISSING, "rtichoke-performance-table__horizon"));
    }
    if (hasCensoring) {
      const c = row.context?.censoringHeuristic;
      tr.append(cell(document, c ? humanizeContextValue(c) : MISSING, "rtichoke-performance-table__context"));
    }
    if (hasCompetingEvent) {
      const ce = row.context?.competingEventHeuristic;
      tr.append(cell(document, ce ? humanizeContextValue(ce) : MISSING, "rtichoke-performance-table__context"));
    }

    // Primary Metric Cells
    for (const metric of activePrimaryMetrics) {
      const val = valueMap.get(metric.id);
      const formattedText = formatMetricValue(val, format2Decimals);
      const td = cell(document, formattedText, "rtichoke-performance-table__metric");
      td.dataset.metricId = metric.id;

      if (val && val.estimate !== null && val.estimate !== undefined && isFinite(val.estimate)) {
        const est = val.estimate;
        if (["sensitivity", "specificity", "ppv", "npv"].includes(metric.id)) {
          appendInCellBar(td, document, est * 100);
        } else if (metric.id === "lift") {
          const pct = maxLift > 0 ? (est / maxLift) * 100 : 0;
          appendInCellBar(td, document, pct);
        } else if (metric.id === "net_benefit") {
          if (maxAbsNB > 0) {
            const isNeg = est < 0;
            const barWidth = (Math.abs(est) / maxAbsNB) * 50;
            appendInCellBar(td, document, barWidth, true, isNeg);
          }
        }
      }

      tr.append(td);
    }

    body.append(tr);
    if (detailTr) {
      body.append(detailTr);
    }
  }

  table.append(body);
  scrollWrapper.append(table);
  root.append(scrollWrapper);
  return root;
}
