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
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");
const gainsHost = document.querySelector<HTMLElement>("#gains-chart");
const gainsTimeHost = document.querySelector<HTMLElement>("#gains-time-chart");
const liftHost = document.querySelector<HTMLElement>("#lift-chart");
const liftTimeHost = document.querySelector<HTMLElement>("#lift-time-chart");
const precisionRecallHost = document.querySelector<HTMLElement>("#precision-recall-chart");
const dcOpHost = document.querySelector<HTMLElement>("#dc-op-chart");
const iaOpHost = document.querySelector<HTMLElement>("#ia-op-chart");

if (
  !reportHost ||
  !rocHost ||
  !rocOpHost ||
  !calibrationHost ||
  !precisionRecallHost ||
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
  ...(rocFixture as RocV2Spec),
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
calibrationHost.append(renderCalibrationV2(calibrationFixture as CalibrationV2Spec));
precisionRecallHost.append(renderPrecisionRecallV2(prPpcrOpSpec));
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
