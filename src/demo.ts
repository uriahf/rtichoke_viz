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
import type { ReportSpecV1_1 } from "./spec/report.js";

// Demo report specifications
import report1Fixture from "../fixtures/v2/demo/report-1-one-model-one-pop.json" with { type: "json" };
import report2Fixture from "../fixtures/v2/demo/report-2-multi-models-one-pop.json" with { type: "json" };
import report3Fixture from "../fixtures/v2/demo/report-3-one-model-multi-pops.json" with { type: "json" };

// Standalone realistic demo specs
import rocModelATest from "../fixtures/v2/demo/model-a-test-roc.json" with { type: "json" };
import rocModelsABTest from "../fixtures/v2/demo/models-a-b-test-roc.json" with { type: "json" };
import calibModelATest from "../fixtures/v2/demo/model-a-test-calibration.json" with { type: "json" };
import calibMultiPop from "../fixtures/v2/demo/model-a-train-test-val-calibration.json" with { type: "json" };
import prModelsABTest from "../fixtures/v2/demo/models-a-b-test-precision-recall.json" with { type: "json" };
import gainsModelsABTest from "../fixtures/v2/demo/models-a-b-test-gains.json" with { type: "json" };
import liftModelsABTest from "../fixtures/v2/demo/models-a-b-test-lift.json" with { type: "json" };
import predDistVisualFixture from "../fixtures/v2/prediction-distribution-visual.json" with { type: "json" };

// Standalone proofs for contract tests
import decisionCurveFixture from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import interventionsAvoidedFixture from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import gainsTimeFixture from "../fixtures/v2/gains-time.json" with { type: "json" };
import liftTimeFixture from "../fixtures/v2/lift-time.json" with { type: "json" };

const reportHost1 = document.querySelector<HTMLElement>("#report-demo-1");
const reportHost2 = document.querySelector<HTMLElement>("#report-demo-2");
const reportHost3 = document.querySelector<HTMLElement>("#report-demo-3");

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
  !reportHost1 ||
  !reportHost2 ||
  !reportHost3 ||
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

// 1. Render the three distinct Summary Reports
reportHost1.append(
  renderReport(report1Fixture as ReportSpecV1_1, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

reportHost2.append(
  renderReport(report2Fixture as ReportSpecV1_1, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

reportHost3.append(
  renderReport(report3Fixture as ReportSpecV1_1, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

// Tab switching logic for demo page
const setupDemoTabs = () => {
  const tabs = [
    { btnId: "#tab-btn-report-1", wrapperId: "#report-demo-1-wrapper" },
    { btnId: "#tab-btn-report-2", wrapperId: "#report-demo-2-wrapper" },
    { btnId: "#tab-btn-report-3", wrapperId: "#report-demo-3-wrapper" },
  ];

  tabs.forEach((tab) => {
    const btn = document.querySelector<HTMLButtonElement>(tab.btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      tabs.forEach((t) => {
        const b = document.querySelector<HTMLButtonElement>(t.btnId);
        const w = document.querySelector<HTMLElement>(t.wrapperId);
        if (b && w) {
          const isActive = t.btnId === tab.btnId;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
          w.style.display = isActive ? "block" : "none";
        }
      });
    });
  });
};

setupDemoTabs();

// 2. Render standalone comparison charts using realistic demo specifications
const singleRocOpSpec: RocV2Spec = {
  ...(rocModelATest as unknown as RocV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const multiRocOpSpec: RocV2Spec = {
  ...(rocModelsABTest as unknown as RocV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const rocPpcrOpSpec: RocV2Spec = {
  ...(rocModelsABTest as unknown as RocV2Spec),
  operatingPoint: { dimension: "ppcr" },
};

const prThreshOpSpec: PrecisionRecallV2Spec = {
  ...(prModelsABTest as unknown as PrecisionRecallV2Spec),
  operatingPoint: { dimension: "probability_threshold" },
};

const prPpcrOpSpec: PrecisionRecallV2Spec = {
  ...(prModelsABTest as unknown as PrecisionRecallV2Spec),
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

rocHost.append(renderRocV2(singleRocOpSpec));
rocOpHost.append(renderRocV2(multiRocOpSpec));
rocPpcrHost.append(renderRocV2(rocPpcrOpSpec));
calibrationHost.append(renderCalibrationV2(calibModelATest as unknown as CalibrationV2Spec));
calibrationPopulationsHost.append(renderCalibrationV2(calibMultiPop as unknown as CalibrationV2Spec));
precisionRecallHost.append(renderPrecisionRecallV2(prThreshOpSpec));
prPpcrHost.append(renderPrecisionRecallV2(prPpcrOpSpec));
gainsHost.append(
  renderGainsV2({
    ...(gainsModelsABTest as unknown as GainsV2Spec),
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
    ...(liftModelsABTest as unknown as LiftV2Spec),
    operatingPoint: { dimension: "ppcr" },
  }),
);
liftTimeHost.append(renderLiftV2(liftTimeFixture as LiftV2Spec));
dcOpHost.append(renderDecisionCurveV2(dcOpSpec));
iaOpHost.append(renderInterventionsAvoidedV2(iaOpSpec));
predDistVisualHost.append(renderPredictionDistribution(predDistVisualFixture as PredictionDistributionSpec));
