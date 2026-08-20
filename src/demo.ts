import { renderCalibration, renderRoc } from "./index.js";
import type { CalibrationSpec, RocSpec } from "./index.js";
import calibrationFixture from "../fixtures/calibration.json" with { type: "json" };
import rocFixture from "../fixtures/roc.json" with { type: "json" };

const rocHost = document.querySelector<HTMLElement>("#roc-chart");
const calibrationHost = document.querySelector<HTMLElement>("#calibration-chart");

if (!rocHost || !calibrationHost) {
  throw new Error("Demo chart containers are missing");
}

rocHost.append(renderRoc(rocFixture as RocSpec));
calibrationHost.append(renderCalibration(calibrationFixture as CalibrationSpec));
