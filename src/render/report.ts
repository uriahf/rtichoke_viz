import { Value } from "@sinclair/typebox/value";
import type { ReportSpec } from "../spec/report.js";
import { ReportSpecSchema } from "../spec/report.js";
import { assertReportReferentialIntegrity } from "../spec/validate-report.js";
import { renderDecisionCurveV2 } from "./decision-curve.js";
import { renderInterventionsAvoidedV2 } from "./interventions-avoided.js";
import { renderPerformanceTable } from "./performance-table.js";
import {
  renderCalibrationV2,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderRocV2,
} from "./v2.js";

/** Render a canonical ReportSpec by composing standalone browser renderers. */
export function renderReport(spec: ReportSpec): HTMLDivElement {
  if (!Value.Check(ReportSpecSchema, spec)) throw new Error("Invalid ReportSpec");
  assertReportReferentialIntegrity(spec);
  const root = document.createElement("div");
  root.className = "rtichoke-report";
  if (spec.title) {
    const title = document.createElement("h1");
    title.className = "rtichoke-report__title";
    title.textContent = spec.title;
    root.append(title);
  }
  for (const component of spec.components) {
    const container = document.createElement("section");
    container.className = "rtichoke-report__component";
    container.dataset.componentId = component.id;
    if (component.title) {
      const title = document.createElement("h2");
      title.className = "rtichoke-report__component-title";
      title.textContent = component.title;
      container.append(title);
    }
    const content = document.createElement("div");
    content.className = "rtichoke-report__component-content";
    switch (component.spec.type) {
      case "performance_table": content.append(renderPerformanceTable(component.spec)); break;
      case "roc": content.append(renderRocV2(component.spec)); break;
      case "calibration": content.append(renderCalibrationV2(component.spec)); break;
      case "precision_recall": content.append(renderPrecisionRecallV2(component.spec)); break;
      case "gains": content.append(renderGainsV2(component.spec)); break;
      case "lift": content.append(renderLiftV2(component.spec)); break;
      case "decision_curve": content.append(renderDecisionCurveV2(component.spec)); break;
      case "interventions_avoided": content.append(renderInterventionsAvoidedV2(component.spec)); break;
    }
    container.append(content);
    root.append(container);
  }
  return root;
}
