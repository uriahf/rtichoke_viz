import {
  renderCalibrationV2,
  renderGainsV2,
  renderPrecisionRecallV2,
  renderRocV2,
} from "./index.js";
import type {
  CalibrationV2Spec,
  GainsV2Spec,
  PrecisionRecallV2Spec,
  RocV2Spec,
} from "./index.js";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import gainsFixture from "../fixtures/v2/gains-shared-population.json" with { type: "json" };
import precisionRecallFixture from "../fixtures/v2/precision-recall-shared-population.json" with { type: "json" };
import rocFixture from "../fixtures/v2/roc.json" with { type: "json" };

const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");
const gainsHost = document.querySelector<HTMLElement>("#gains-chart");
const precisionRecallHost = document.querySelector<HTMLElement>("#precision-recall-chart");

if (!rocHost || !calibrationHost || !precisionRecallHost || !gainsHost) {
  throw new Error("Demo chart containers are missing");
}

rocHost.append(renderRocV2(rocFixture as RocV2Spec));
calibrationHost.append(renderCalibrationV2(calibrationFixture as CalibrationV2Spec));
precisionRecallHost.append(
  renderPrecisionRecallV2(precisionRecallFixture as PrecisionRecallV2Spec),
);
gainsHost.append(renderGainsV2(gainsFixture as GainsV2Spec));
