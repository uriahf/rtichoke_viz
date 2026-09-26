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

import { demoReport1, demoReport2, demoReport3 } from "./demo-reports.js";

// Standalone realistic demo specs
import rocModelATestData from "../fixtures/v2/demo/model-a-test-roc.json" with { type: "json" };
import rocModelsABTestData from "../fixtures/v2/demo/models-a-b-test-roc.json" with { type: "json" };
import calibModelATestData from "../fixtures/v2/demo/model-a-test-calibration.json" with { type: "json" };
import calibMultiPopData from "../fixtures/v2/demo/model-a-train-test-val-calibration.json" with { type: "json" };
import prModelsABTestData from "../fixtures/v2/demo/models-a-b-test-precision-recall.json" with { type: "json" };
import gainsModelsABTestData from "../fixtures/v2/demo/models-a-b-test-gains.json" with { type: "json" };
import liftModelsABTestData from "../fixtures/v2/demo/models-a-b-test-lift.json" with { type: "json" };
import predDistVisualData from "../fixtures/v2/prediction-distribution-visual.json" with { type: "json" };

// Standalone proofs for contract tests
import decisionCurveData from "../fixtures/v2/decision-curve-single.json" with { type: "json" };
import interventionsAvoidedData from "../fixtures/v2/interventions-avoided-single.json" with { type: "json" };
import gainsTimeData from "../fixtures/v2/gains-time.json" with { type: "json" };
import liftTimeData from "../fixtures/v2/lift-time.json" with { type: "json" };

const rocModelATest = rocModelATestData as RocV2Spec;
const rocModelsABTest = rocModelsABTestData as RocV2Spec;
const calibModelATest = calibModelATestData as CalibrationV2Spec;
const calibMultiPop = calibMultiPopData as CalibrationV2Spec;
const prModelsABTest = prModelsABTestData as PrecisionRecallV2Spec;
const gainsModelsABTest = gainsModelsABTestData as GainsV2Spec;
const liftModelsABTest = liftModelsABTestData as LiftV2Spec;
const predDistVisualFixture = predDistVisualData as PredictionDistributionSpec;

const decisionCurveFixture = decisionCurveData as DecisionCurveV2Spec;
const interventionsAvoidedFixture = interventionsAvoidedData as InterventionsAvoidedV2Spec;
const gainsTimeFixture = gainsTimeData as GainsV2Spec;
const liftTimeFixture = liftTimeData as LiftV2Spec;

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
  renderReport(demoReport1, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

reportHost2.append(
  renderReport(demoReport2, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

reportHost3.append(
  renderReport(demoReport3, {
    sectionGroupPresentation: "tabs",
    groupPresentation: "tabs",
  }),
);

// Tab switching logic for demo page
export const setupDemoTabs = () => {
  const tabs = [
    { btnId: "#tab-btn-report-1", wrapperId: "#report-demo-1-wrapper" },
    { btnId: "#tab-btn-report-2", wrapperId: "#report-demo-2-wrapper" },
    { btnId: "#tab-btn-report-3", wrapperId: "#report-demo-3-wrapper" },
  ];

  const buttons = tabs.map((t) => document.querySelector<HTMLButtonElement>(t.btnId));

  const selectTab = (index: number) => {
    tabs.forEach((t, i) => {
      const b = buttons[i];
      const w = document.querySelector<HTMLElement>(t.wrapperId);
      if (!b || !w) return;

      const isActive = i === index;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
      b.setAttribute("tabindex", isActive ? "0" : "-1");

      if (isActive) {
        w.removeAttribute("hidden");
        b.focus();
      } else {
        w.setAttribute("hidden", "");
      }
    });
  };

  buttons.forEach((btn, index) => {
    if (!btn) return;

    btn.addEventListener("click", () => selectTab(index));

    btn.addEventListener("keydown", (e: KeyboardEvent) => {
      let targetIndex: number | null = null;
      if (e.key === "ArrowRight") {
        targetIndex = (index + 1) % buttons.length;
      } else if (e.key === "ArrowLeft") {
        targetIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (e.key === "Home") {
        targetIndex = 0;
      } else if (e.key === "End") {
        targetIndex = buttons.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        selectTab(targetIndex);
      }
    });
  });
};

setupDemoTabs();

// 2. Render standalone comparison charts using realistic demo specifications
const singleRocOpSpec: RocV2Spec = {
  ...rocModelATest,
  operatingPoint: { dimension: "probability_threshold" },
};

const multiRocOpSpec: RocV2Spec = {
  ...rocModelsABTest,
  operatingPoint: { dimension: "probability_threshold" },
};

const rocPpcrOpSpec: RocV2Spec = {
  ...rocModelsABTest,
  operatingPoint: { dimension: "ppcr" },
};

const prThreshOpSpec: PrecisionRecallV2Spec = {
  ...prModelsABTest,
  operatingPoint: { dimension: "probability_threshold" },
};

const prPpcrOpSpec: PrecisionRecallV2Spec = {
  ...prModelsABTest,
  operatingPoint: { dimension: "ppcr" },
};

const dcOpSpec: DecisionCurveV2Spec = {
  ...decisionCurveFixture,
  operatingPoint: { dimension: "probability_threshold" },
};

const iaOpSpec: InterventionsAvoidedV2Spec = {
  ...interventionsAvoidedFixture,
  operatingPoint: { dimension: "probability_threshold" },
};

rocHost.append(renderRocV2(singleRocOpSpec));
rocOpHost.append(renderRocV2(multiRocOpSpec));
rocPpcrHost.append(renderRocV2(rocPpcrOpSpec));
calibrationHost.append(renderCalibrationV2(calibModelATest));
calibrationPopulationsHost.append(renderCalibrationV2(calibMultiPop));
precisionRecallHost.append(renderPrecisionRecallV2(prThreshOpSpec));
prPpcrHost.append(renderPrecisionRecallV2(prPpcrOpSpec));
gainsHost.append(
  renderGainsV2({
    ...gainsModelsABTest,
    operatingPoint: { dimension: "ppcr" },
  }),
);
gainsTimeHost.append(
  renderGainsV2({
    ...gainsTimeFixture,
    operatingPoint: { dimension: "probability_threshold" },
  }),
);
liftHost.append(
  renderLiftV2({
    ...liftModelsABTest,
    operatingPoint: { dimension: "ppcr" },
  }),
);
liftTimeHost.append(renderLiftV2(liftTimeFixture));
dcOpHost.append(renderDecisionCurveV2(dcOpSpec));
iaOpHost.append(renderInterventionsAvoidedV2(iaOpSpec));
predDistVisualHost.append(renderPredictionDistribution(predDistVisualFixture));
