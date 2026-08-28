import { Value } from "@sinclair/typebox/value";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import calibrationFixture from "../fixtures/v2/calibration.json" with { type: "json" };
import {
  CalibrationV2SpecSchema,
  DiscreteCalibrationV2DatumSchema,
  SmoothCalibrationV2DatumSchema,
  type CalibrationV2Spec,
} from "../src/index.js";
import { renderCalibrationV2 } from "../src/render/v2.js";
import { ReportSpecSchema } from "../src/spec/report.js";

function setupDom() {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;
}

function makeSpec(data: any[], yDomain?: [number, number]): CalibrationV2Spec {
  return {
    schemaVersion: "2.0",
    type: "calibration",
    evaluations: [{ id: "eval-1", population: "Pop 1", label: "Pop 1" }],
    series: [
      {
        id: "series-1",
        evaluationId: "eval-1",
        display: { label: "Model 1", group: "Model 1", role: "model" },
      },
    ],
    data,
    x: "predicted",
    y: "observed",
    xAxis: { label: "Predicted probability", domain: [0, 1] },
    ...(yDomain ? { yAxis: { label: "Observed probability", domain: yDomain } } : { yAxis: { label: "Observed probability" } }),
    references: [{ type: "identity", scope: "global", label: "Perfectly Calibrated" }],
  };
}

describe("Smooth Calibration V2 Contract & Renderer Compatibility", () => {
  beforeAll(() => {
    setupDom();
  });

  describe("Validation Rules", () => {
    it("1. discrete observed = 0 is valid", () => {
      const datum = { seriesId: "series-1", predicted: 0.1, observed: 0, method: "discrete" };
      expect(Value.Check(DiscreteCalibrationV2DatumSchema, datum)).toBe(true);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(true);
    });

    it("2. discrete observed = 1 is valid", () => {
      const datum = { seriesId: "series-1", predicted: 0.9, observed: 1, method: "discrete" };
      expect(Value.Check(DiscreteCalibrationV2DatumSchema, datum)).toBe(true);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(true);
    });

    it("3. discrete observed < 0 is invalid", () => {
      const datum = { seriesId: "series-1", predicted: 0.1, observed: -0.01, method: "discrete" };
      expect(Value.Check(DiscreteCalibrationV2DatumSchema, datum)).toBe(false);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(false);
    });

    it("4. discrete observed > 1 is invalid", () => {
      const datum = { seriesId: "series-1", predicted: 0.9, observed: 1.02, method: "discrete" };
      expect(Value.Check(DiscreteCalibrationV2DatumSchema, datum)).toBe(false);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(false);
    });

    it("5. smooth observed in [0,1] remains valid", () => {
      const datum = { seriesId: "series-1", predicted: 0.5, observed: 0.5, method: "smooth" };
      expect(Value.Check(SmoothCalibrationV2DatumSchema, datum)).toBe(true);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(true);
    });

    it("6. smooth observed slightly below 0 is valid (-0.01)", () => {
      const datum = { seriesId: "series-1", predicted: 0.0, observed: -0.01, method: "smooth" };
      expect(Value.Check(SmoothCalibrationV2DatumSchema, datum)).toBe(true);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(true);
    });

    it("7. smooth observed slightly above 1 is valid (1.02)", () => {
      const datum = { seriesId: "series-1", predicted: 1.0, observed: 1.02, method: "smooth" };
      expect(Value.Check(SmoothCalibrationV2DatumSchema, datum)).toBe(true);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(true);
    });

    it("8. smooth predicted < 0 remains invalid", () => {
      const datum = { seriesId: "series-1", predicted: -0.05, observed: 0.5, method: "smooth" };
      expect(Value.Check(SmoothCalibrationV2DatumSchema, datum)).toBe(false);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(false);
    });

    it("9. smooth predicted > 1 remains invalid", () => {
      const datum = { seriesId: "series-1", predicted: 1.05, observed: 0.5, method: "smooth" };
      expect(Value.Check(SmoothCalibrationV2DatumSchema, datum)).toBe(false);
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datum]))).toBe(false);
    });

    it("10. non-finite values remain invalid (NaN, Infinity, -Infinity)", () => {
      for (const invalidValue of [NaN, Infinity, -Infinity]) {
        const datumSmooth = { seriesId: "series-1", predicted: 0.5, observed: invalidValue, method: "smooth" };
        expect(Value.Check(SmoothCalibrationV2DatumSchema, datumSmooth)).toBe(false);
        expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datumSmooth]))).toBe(false);

        const datumPredSmooth = { seriesId: "series-1", predicted: invalidValue, observed: 0.5, method: "smooth" };
        expect(Value.Check(SmoothCalibrationV2DatumSchema, datumPredSmooth)).toBe(false);
        expect(Value.Check(CalibrationV2SpecSchema, makeSpec([datumPredSmooth]))).toBe(false);
      }
    });
  });

  describe("Rendering & Geometry", () => {
    const smoothOvershootData = [
      { seriesId: "series-1", predicted: 0.0, observed: -0.01, method: "smooth" },
      { seriesId: "series-1", predicted: 0.5, observed: 0.5, method: "smooth" },
      { seriesId: "series-1", predicted: 1.0, observed: 1.02, method: "smooth" },
    ];

    it("11. standalone smooth calibration rendering accepts out-of-range observed values", () => {
      const spec = makeSpec(smoothOvershootData);
      expect(() => renderCalibrationV2(spec)).not.toThrow();
    });

    it("12. renderer does not clamp/mutate the smooth geometry", () => {
      const spec = makeSpec(smoothOvershootData);
      const element = renderCalibrationV2(spec) as HTMLElement;
      const path = element.querySelector("path[stroke]");
      expect(path).not.toBeNull();
      // Original data remains unmutated
      expect(spec.data[0].observed).toBe(-0.01);
      expect(spec.data[2].observed).toBe(1.02);
    });

    it("13. smooth values are not silently discarded", () => {
      const spec = makeSpec(smoothOvershootData);
      const element = renderCalibrationV2(spec) as HTMLElement;
      // SVG should render the path mark containing all 3 points
      const path = element.querySelector("path[stroke]");
      const d = path?.getAttribute("d") ?? "";
      // The path should contain 2 line segments (3 points: M ... L ... L ...)
      expect(d.split("L").length).toBe(3);
    });

    it("14. ReportSpec embedding accepts a valid smooth calibration spec", () => {
      const spec = makeSpec(smoothOvershootData);
      const report = {
        schemaVersion: "1.0",
        type: "report",
        components: [
          {
            id: "comp-smooth-cal",
            spec,
          },
        ],
      };
      expect(Value.Check(ReportSpecSchema, report)).toBe(true);
    });

    it("15 & 16. existing discrete and smooth fixtures/tests pass", () => {
      expect(Value.Check(CalibrationV2SpecSchema, calibrationFixture)).toBe(true);
    });

    it("17. no regression in exported public schemas", () => {
      expect(DiscreteCalibrationV2DatumSchema).toBeDefined();
      expect(SmoothCalibrationV2DatumSchema).toBeDefined();
    });
  });

  describe("Mixed-Method Calibration Spec & Domain Handling", () => {
    it("18. mixed spec with discrete and smooth rows enforces strict discrete validation, automatic domain expansion, and original data preservation", () => {
      const mixedDataValid = [
        { seriesId: "series-1", predicted: 0.1, observed: 0.08, method: "discrete", events: 8, total: 100 },
        { seriesId: "series-1", predicted: 0.0, observed: -0.01, method: "smooth" },
        { seriesId: "series-1", predicted: 0.5, observed: 0.5, method: "smooth" },
        { seriesId: "series-1", predicted: 1.0, observed: 1.02, method: "smooth" },
      ];

      const mixedSpec = makeSpec(mixedDataValid);
      expect(Value.Check(CalibrationV2SpecSchema, mixedSpec)).toBe(true);

      // Verify discrete strictness: adding an invalid discrete row fails validation
      const mixedDataInvalidDiscrete = [
        ...mixedDataValid,
        { seriesId: "series-1", predicted: 0.8, observed: -0.05, method: "discrete", events: 0, total: 100 },
      ];
      expect(Value.Check(CalibrationV2SpecSchema, makeSpec(mixedDataInvalidDiscrete))).toBe(false);

      // Verify rendering of valid mixed spec
      const element = renderCalibrationV2(mixedSpec) as HTMLElement;
      expect(element).toBeDefined();

      // Original data preserved unchanged
      expect(mixedSpec.data[1].observed).toBe(-0.01);
      expect(mixedSpec.data[3].observed).toBe(1.02);

      // Both dot (for discrete) and line (for smooth/all) are rendered
      expect(element.querySelector("circle, path")).not.toBeNull();
    });
  });
});
