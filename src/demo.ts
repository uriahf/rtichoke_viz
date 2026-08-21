import { renderCalibrationV2, renderRocV2 } from "./index.js";
import type { CalibrationV2Spec, RocV2Spec } from "./index.js";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import rocFixture from "../fixtures/v2/roc.json" with { type: "json" };

const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");

if (!rocHost || !calibrationHost) {
  throw new Error("Demo chart containers are missing");
}

rocHost.append(renderRocV2(rocFixture as RocV2Spec));
calibrationHost.append(renderCalibrationV2(calibrationFixture as CalibrationV2Spec));
