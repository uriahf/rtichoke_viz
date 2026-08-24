import {
  renderCalibrationV2,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderReport,
  renderRocV2,
} from "./index.js";
import type {
  CalibrationV2Spec,
  GainsV2Spec,
  LiftV2Spec,
  PrecisionRecallV2Spec,
  ReportSpec,
  RocV2Spec,
} from "./index.js";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import gainsFixture from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import gainsTimeFixture from "../fixtures/v2/gains-time.json" with { type: "json" };
import liftFixture from "../fixtures/v2/lift-shared-population.json" with { type: "json" };
import liftTimeFixture from "../fixtures/v2/lift-time.json" with { type: "json" };
import performanceTableFixture from "../fixtures/v2/performance-table.json" with { type: "json" };
import precisionRecallFixture from "../fixtures/v2/precision-recall-shared-population.json" with { type: "json" };
import rocFixture from "../fixtures/v2/roc.json" with { type: "json" };

const reportHost = document.querySelector<HTMLElement>("#report-demo");
const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");
const gainsHost = document.querySelector<HTMLElement>("#gains-chart");
const gainsTimeHost = document.querySelector<HTMLElement>("#gains-time-chart");
const liftHost = document.querySelector<HTMLElement>("#lift-chart");
const liftTimeHost = document.querySelector<HTMLElement>("#lift-time-chart");
const precisionRecallHost = document.querySelector<HTMLElement>("#precision-recall-chart");

if (
  !reportHost ||
  !rocHost ||
  !calibrationHost ||
  !precisionRecallHost ||
  !gainsHost ||
  !gainsTimeHost ||
  !liftHost ||
  !liftTimeHost
) {
  throw new Error("Demo chart containers are missing");
}

const report: ReportSpec = {
  schemaVersion: "1.0",
  type: "report",
  title: "Canonical model performance report",
  components: [
    {
      id: "performance",
      title: "Performance table",
      spec: structuredClone(performanceTableFixture),
    },
    { id: "roc", title: "ROC", spec: structuredClone(rocFixture) },
    {
      id: "calibration",
      title: "Calibration",
      spec: structuredClone(calibrationFixture),
    },
    {
      id: "precision-recall",
      title: "Precision-recall",
      spec: structuredClone(precisionRecallFixture),
    },
    { id: "gains", title: "Gains", spec: structuredClone(gainsFixture) },
    { id: "lift", title: "Lift", spec: structuredClone(liftFixture) },
  ],
} as ReportSpec;

reportHost.append(renderReport(report));
rocHost.append(renderRocV2(rocFixture as RocV2Spec));
calibrationHost.append(renderCalibrationV2(calibrationFixture as CalibrationV2Spec));
precisionRecallHost.append(
  renderPrecisionRecallV2(precisionRecallFixture as PrecisionRecallV2Spec),
);
gainsHost.append(renderGainsV2(gainsFixture as GainsV2Spec));
gainsTimeHost.append(renderGainsV2(gainsTimeFixture as GainsV2Spec));
liftHost.append(renderLiftV2(liftFixture as LiftV2Spec));
liftTimeHost.append(renderLiftV2(liftTimeFixture as LiftV2Spec));
