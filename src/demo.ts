import {
  renderCalibrationV2,
  renderDecisionCurveV2,
  renderGainsV2,
  renderInterventionsAvoidedV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderReport,
  renderRocV2,
} from "./index.js";
import "./rtichoke-viz.css";
import type {
  CalibrationV2Spec,
  DecisionCurveV2Spec,
  GainsV2Spec,
  InterventionsAvoidedV2Spec,
  LiftV2Spec,
  PrecisionRecallV2Spec,
  RocV2Spec,
} from "./index.js";
import { structuredReportFixture } from "../fixtures/v2/structured-report-v1_1.js";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import decisionCurveFixture from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import gainsFixture from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import gainsTimeFixture from "../fixtures/v2/gains-time.json" with { type: "json" };
import interventionsAvoidedFixture from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import liftFixture from "../fixtures/v2/lift-shared-population.json" with { type: "json" };
import liftTimeFixture from "../fixtures/v2/lift-time.json" with { type: "json" };
import precisionRecallFixture from "../fixtures/v2/precision-recall-shared-population.json" with { type: "json" };
import rocFixture from "../fixtures/v2/roc.json" with { type: "json" };

const reportHost = document.querySelector<HTMLElement>("#report-demo");
const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const rocOpHost = document.querySelector<HTMLElement>("#roc-op-chart");
const rocPpcrHost = document.querySelector<HTMLElement>("#roc-ppcr-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");
const gainsHost = document.querySelector<HTMLElement>("#gains-chart");
const gainsTimeHost = document.querySelector<HTMLElement>("#gains-time-chart");
const liftHost = document.querySelector<HTMLElement>("#lift-chart");
const liftTimeHost = document.querySelector<HTMLElement>("#lift-time-chart");
const precisionRecallHost = document.querySelector<HTMLElement>("#precision-recall-chart");
const prPpcrHost = document.querySelector<HTMLElement>("#pr-ppcr-chart");
const dcOpHost = document.querySelector<HTMLElement>("#dc-op-chart");
const iaOpHost = document.querySelector<HTMLElement>("#ia-op-chart");

if (
  !reportHost ||
  !rocHost ||
  !rocOpHost ||
  !rocPpcrHost ||
  !calibrationHost ||
  !precisionRecallHost ||
  !prPpcrHost ||
  !gainsHost ||
  !gainsTimeHost ||
  !liftHost ||
  !liftTimeHost ||
  !dcOpHost ||
  !iaOpHost
) {
  throw new Error("Demo chart containers are missing");
}

const singleRocOpSpec: RocV2Spec = {
  ...(rocFixture as RocV2Spec),
  evaluations: [(rocFixture as RocV2Spec).evaluations[0]],
  series: [(rocFixture as RocV2Spec).series[0]],
  data: (rocFixture as RocV2Spec).data.filter(
    (datum) => datum.seriesId === (rocFixture as RocV2Spec).series[0].id,
  ),
  operatingPoint: { dimension: "probability_threshold" },
};

const multiRocOpSpec: RocV2Spec = {
  schemaVersion: "2.0",
  type: "roc",
  evaluations: [
    { id: "eval-1", model: "Model A", population: "Pop 1", label: "Model A" },
    { id: "eval-2", model: "Model B", population: "Pop 1", label: "Model B" },
  ],
  series: [
    { id: "series-1", evaluationId: "eval-1", display: { label: "Model A", group: "Model A", role: "model" } },
    { id: "series-2", evaluationId: "eval-2", display: { label: "Model B", group: "Model B", role: "model" } },
  ],
  data: [
    { seriesId: "series-1", cutoff: 0.2, sensitivity: 0.9, specificity: 0.35, ppcr: 0.8 },
    { seriesId: "series-1", cutoff: 0.5, sensitivity: 0.75, specificity: 0.7, ppcr: 0.5 },
    { seriesId: "series-1", cutoff: 0.8, sensitivity: 0.4, specificity: 0.9, ppcr: 0.2 },
    { seriesId: "series-2", cutoff: 0.2, sensitivity: 0.8, specificity: 0.45, ppcr: 0.75 },
    { seriesId: "series-2", cutoff: 0.5, sensitivity: 0.6, specificity: 0.8, ppcr: 0.45 },
    { seriesId: "series-2", cutoff: 0.8, sensitivity: 0.3, specificity: 0.92, ppcr: 0.15 },
  ],
  x: "false_positive_rate",
  y: "sensitivity",
  xAxis: { label: "1 - Specificity", domain: [0, 1] },
  yAxis: { label: "Sensitivity", domain: [0, 1] },
  references: [{ type: "identity", scope: "global", label: "Random Guess" }],
  operatingPoint: { dimension: "probability_threshold" },
};

const rocPpcrOpSpec: RocV2Spec = {
  ...multiRocOpSpec,
  operatingPoint: { dimension: "ppcr" },
};

const prThreshOpSpec: PrecisionRecallV2Spec = {
  ...(precisionRecallFixture as PrecisionRecallV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const prPpcrOpSpec: PrecisionRecallV2Spec = {
  ...(precisionRecallFixture as PrecisionRecallV2Spec),
  operatingPoint: { dimension: "ppcr" },
};

const dcOpSpec: DecisionCurveV2Spec = {
  ...(decisionCurveFixture as DecisionCurveV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const iaOpSpec: InterventionsAvoidedV2Spec = {
  ...(interventionsAvoidedFixture as InterventionsAvoidedV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const reportWithOp = {
  ...structuredReportFixture,
  sections: structuredReportFixture.sections.map((section) => {
    if (section.id !== "discrimination") return section;
    return {
      ...section,
      items: section.items.map((item) => {
        if (item.type !== "group") return item;
        if (item.id === "probability-threshold") {
          return {
            ...item,
            components: item.components.map((comp) => ({
              ...comp,
              spec: {
                ...comp.spec,
                operatingPoint: { dimension: "probability_threshold" as const },
              },
            })),
          };
        }
        if (item.id === "ppcr") {
          return {
            ...item,
            components: item.components.map((comp) => ({
              ...comp,
              spec: {
                ...comp.spec,
                operatingPoint: { dimension: "ppcr" as const },
              },
            })),
          };
        }
        return item;
      }),
    };
  }),
};

reportHost.append(
  renderReport(reportWithOp as typeof structuredReportFixture, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);
rocHost.append(renderRocV2(singleRocOpSpec));
rocOpHost.append(renderRocV2(multiRocOpSpec));
rocPpcrHost.append(renderRocV2(rocPpcrOpSpec));
calibrationHost.append(renderCalibrationV2(calibrationFixture as CalibrationV2Spec));
precisionRecallHost.append(renderPrecisionRecallV2(prThreshOpSpec));
prPpcrHost.append(renderPrecisionRecallV2(prPpcrOpSpec));
gainsHost.append(renderGainsV2(gainsFixture as GainsV2Spec));
gainsTimeHost.append(
  renderGainsV2({
    ...(gainsTimeFixture as GainsV2Spec),
    operatingPoint: { dimension: "probability_threshold" },
  }),
);
liftHost.append(renderLiftV2(liftFixture as LiftV2Spec));
liftTimeHost.append(renderLiftV2(liftTimeFixture as LiftV2Spec));
dcOpHost.append(renderDecisionCurveV2(dcOpSpec));
iaOpHost.append(renderInterventionsAvoidedV2(iaOpSpec));
