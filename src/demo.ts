import {
  renderCalibrationV2,
  renderDecisionCurveV2,
  renderGainsV2,
  renderInterventionsAvoidedV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderPredictionDistribution,
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
  PredictionDistributionSpec,
  RocV2Spec,
} from "./index.js";
import { demoStructuredReportFixture } from "../fixtures/v2/demo/structured-report.js";
import calibrationFixture from "../fixtures/v2/demo/calibration.json" with { type: "json" };
import calibrationPopulationsFixture from "../fixtures/v2/demo/calibration-populations.json" with { type: "json" };
import decisionCurveFixture from "../fixtures/v2/demo/decision-curve-single.json" with { type: "json" };
import gainsFixture from "../fixtures/v2/demo/gains-shared-population.json" with { type: "json" };
import gainsTimeFixture from "../fixtures/v2/gains-time.json" with { type: "json" };
import interventionsAvoidedFixture from "../fixtures/v2/demo/interventions-avoided-single.json" with { type: "json" };
import liftFixture from "../fixtures/v2/demo/lift-shared-population.json" with { type: "json" };
import liftTimeFixture from "../fixtures/v2/lift-time.json" with { type: "json" };
import precisionRecallFixture from "../fixtures/v2/demo/precision-recall-shared-population.json" with { type: "json" };
import rocFixture from "../fixtures/v2/demo/roc.json" with { type: "json" };
import predDistVisualFixture from "../fixtures/v2/prediction-distribution-visual.json" with { type: "json" };

const reportHost = document.querySelector<HTMLElement>("#report-demo");
const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const rocOpHost = document.querySelector<HTMLElement>("#roc-op-chart");
const rocPpcrHost = document.querySelector<HTMLElement>("#roc-ppcr-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");
const calibrationPopulationsHost = document.querySelector<HTMLElement>("#calibration-populations-chart");
const gainsHost = document.querySelector<HTMLElement>("#gains-chart");
const gainsTimeHost = document.querySelector<HTMLElement>("#gains-time-chart");
const liftHost = document.querySelector<HTMLElement>("#lift-chart");
const liftTimeHost = document.querySelector<HTMLElement>("#lift-time-chart");
const precisionRecallHost = document.querySelector<HTMLElement>("#precision-recall-chart");
const prPpcrHost = document.querySelector<HTMLElement>("#pr-ppcr-chart");
const dcOpHost = document.querySelector<HTMLElement>("#dc-op-chart");
const iaOpHost = document.querySelector<HTMLElement>("#ia-op-chart");
const predDistVisualHost = document.querySelector<HTMLElement>("#pred-dist-visual-chart");

if (
  !reportHost ||
  !rocHost ||
  !rocOpHost ||
  !rocPpcrHost ||
  !calibrationHost ||
  !calibrationPopulationsHost ||
  !precisionRecallHost ||
  !prPpcrHost ||
  !gainsHost ||
  !gainsTimeHost ||
  !liftHost ||
  !liftTimeHost ||
  !dcOpHost ||
  !iaOpHost ||
  !predDistVisualHost
) {
  throw new Error("Demo chart containers are missing");
}

const singleRocOpSpec: RocV2Spec = {
  ...((rocFixture as unknown) as RocV2Spec),
  evaluations: [((rocFixture as unknown) as RocV2Spec).evaluations[0]],
  series: [((rocFixture as unknown) as RocV2Spec).series[0]],
  data: ((rocFixture as unknown) as RocV2Spec).data.filter(
    (datum) => datum.seriesId === ((rocFixture as unknown) as RocV2Spec).series[0].id,
  ),
  operatingPoint: { dimension: "probability_threshold" },
};

const multiRocOpSpec: RocV2Spec = {
  ...((rocFixture as unknown) as RocV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const rocPpcrOpSpec: RocV2Spec = {
  ...((rocFixture as unknown) as RocV2Spec),
  operatingPoint: { dimension: "ppcr" },
};

const prThreshOpSpec: PrecisionRecallV2Spec = {
  ...((precisionRecallFixture as unknown) as PrecisionRecallV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const prPpcrOpSpec: PrecisionRecallV2Spec = {
  ...((precisionRecallFixture as unknown) as PrecisionRecallV2Spec),
  operatingPoint: { dimension: "ppcr" },
};

const dcOpSpec: DecisionCurveV2Spec = {
  ...((decisionCurveFixture as unknown) as DecisionCurveV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const iaOpSpec: InterventionsAvoidedV2Spec = {
  ...((interventionsAvoidedFixture as unknown) as InterventionsAvoidedV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const reportWithOp = {
  ...demoStructuredReportFixture,
  sections: demoStructuredReportFixture.sections.map((section) => {
    const updatedItems = section.items.map((item) => {
      if (item.type !== "group" || section.id !== "discrimination") return item;
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
    });

    return {
      ...section,
      items: updatedItems,
    };
  }),
};

reportHost.append(
  renderReport(reportWithOp as typeof demoStructuredReportFixture, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);
rocHost.append(renderRocV2(singleRocOpSpec));
rocOpHost.append(renderRocV2(multiRocOpSpec));
rocPpcrHost.append(renderRocV2(rocPpcrOpSpec));
calibrationHost.append(renderCalibrationV2((calibrationFixture as unknown) as CalibrationV2Spec));
calibrationPopulationsHost.append(
  renderCalibrationV2((calibrationPopulationsFixture as unknown) as CalibrationV2Spec),
);
precisionRecallHost.append(renderPrecisionRecallV2(prThreshOpSpec));
prPpcrHost.append(renderPrecisionRecallV2(prPpcrOpSpec));
gainsHost.append(
  renderGainsV2({
    ...((gainsFixture as unknown) as GainsV2Spec),
    operatingPoint: { dimension: "ppcr" },
  }),
);
gainsTimeHost.append(
  renderGainsV2({
    ...(gainsTimeFixture as GainsV2Spec),
    operatingPoint: { dimension: "probability_threshold" },
  }),
);
liftHost.append(
  renderLiftV2({
    ...((liftFixture as unknown) as LiftV2Spec),
    operatingPoint: { dimension: "ppcr" },
  }),
);
liftTimeHost.append(renderLiftV2(liftTimeFixture as LiftV2Spec));
dcOpHost.append(renderDecisionCurveV2(dcOpSpec));
iaOpHost.append(renderInterventionsAvoidedV2(iaOpSpec));
predDistVisualHost.append(renderPredictionDistribution(predDistVisualFixture as PredictionDistributionSpec));
