import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import rRows from "../fixtures/integration/roc-rtichoke-r.json" with { type: "json" };
import pythonRows from "../fixtures/integration/roc-rtichoke-python.json" with { type: "json" };
import {
  rocSpecFromRtichokePython,
  rocSpecFromRtichokeR,
  type RtichokePythonRocRow,
  type RtichokeRRocRow,
} from "../src/adapters/roc.js";
import { RocSpecSchema } from "../src/spec/roc.js";

describe("real rtichoke ROC output compatibility", () => {
  it("maps representative R and Python performance-data rows to the same canonical spec", () => {
    const fromR = rocSpecFromRtichokeR(rRows as RtichokeRRocRow[]);
    const fromPython = rocSpecFromRtichokePython(
      pythonRows as RtichokePythonRocRow[],
    );

    expect(Value.Check(RocSpecSchema, fromR)).toBe(true);
    expect(Value.Check(RocSpecSchema, fromPython)).toBe(true);
    expect(fromR).toEqual(fromPython);
  });
});
