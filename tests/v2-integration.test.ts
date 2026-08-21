import { describe, expect, it } from "vitest";
import {
  assertV2ReferentialIntegrity,
  calibrationV2SpecFromRtichokeRows,
  rocV2SpecFromRtichokePython,
  rocV2SpecFromRtichokeR,
} from "../src/index.js";

const rRoc = [
  { model: "Model A", probability_threshold: 0.5, sensitivity: 0.8, specificity: 0.7 },
];
const pyRoc = [
  { reference_group: "Population A", chosen_cutoff: 0.5, sensitivity: 0.8, specificity: 0.7 },
];

const calibration = [
  { reference_group: "Population A", x: 0.2, y: 0.18, n_reals: 18, n: 100 },
];

describe("v2 semantic integration", () => {
  it("maps R model groups into one explicit shared population", () => {
    const spec = rocV2SpecFromRtichokeR(rRoc, "test population");
    expect(spec.evaluations[0]).toMatchObject({ model: "Model A", population: "test population" });
    expect(spec.series[0].display.role).toBe("model");
    expect(() => assertV2ReferentialIntegrity(spec)).not.toThrow();
  });

  it("does not infer model identity from Python population groups", () => {
    const spec = rocV2SpecFromRtichokePython(pyRoc, { role: "population" });
    expect(spec.evaluations[0].model).toBeUndefined();
    expect(spec.evaluations[0].population).toBe("Population A");
    expect(spec.series[0].display.role).toBe("population");
  });

  it("maps calibration data and distribution through series identity", () => {
    const spec = calibrationV2SpecFromRtichokeRows(
      calibration,
      "discrete",
      { role: "population" },
      [{ reference_group: "Population A", mids: 0.2, counts: 12 }],
    );
    expect(spec.data[0].seriesId).toBe(spec.series[0].id);
    expect(spec.distribution?.[0].seriesId).toBe(spec.series[0].id);
    expect(() => assertV2ReferentialIntegrity(spec)).not.toThrow();
  });

  it("rejects dangling series references", () => {
    const spec = rocV2SpecFromRtichokeR(rRoc);
    spec.data[0].seriesId = "missing";
    expect(() => assertV2ReferentialIntegrity(spec)).toThrow("unknown series id");
  });
});
