import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import type { CalibrationV2Spec } from "../src/spec/v2/calibration.js";
import type { RocV2Spec } from "../src/spec/v2/roc.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

function copy<T>(value: T): T {
  return structuredClone(value);
}

describe("v2 referential integrity", () => {
  it("rejects duplicate evaluation ids", () => {
    const spec = copy(roc) as RocV2Spec;
    spec.evaluations.push({ ...spec.evaluations[0] });

    expect(() => assertV2ReferentialIntegrity(spec)).toThrow(
      "duplicate evaluation id",
    );
  });

  it("rejects duplicate series ids", () => {
    const spec = copy(roc) as RocV2Spec;
    spec.series.push({ ...spec.series[0] });

    expect(() => assertV2ReferentialIntegrity(spec)).toThrow(
      "duplicate series id: series-model-a",
    );
  });

  it("rejects dangling series evaluation references", () => {
    const spec = copy(roc) as RocV2Spec;
    spec.series[0].evaluationId = "missing-evaluation";

    expect(() => assertV2ReferentialIntegrity(spec)).toThrow(
      "unknown evaluation id: missing-evaluation",
    );
  });

  it("rejects dangling data series references", () => {
    const spec = copy(roc) as RocV2Spec;
    spec.data[0].seriesId = "missing-series";

    expect(() => assertV2ReferentialIntegrity(spec)).toThrow(
      "unknown series id: missing-series",
    );
  });

  it("rejects dangling calibration distribution series references", () => {
    const spec = copy(calibration) as CalibrationV2Spec;
    spec.distribution![0].seriesId = "missing-series";

    expect(() => assertV2ReferentialIntegrity(spec)).toThrow(
      "unknown distribution series id: missing-series",
    );
  });
});
