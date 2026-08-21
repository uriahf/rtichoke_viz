import { readFileSync } from "node:fs";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import sharedDisplayGroup from "../fixtures/v2/roc-shared-display-group.json" with { type: "json" };
import { RocV2SpecSchema, type RocV2Spec } from "../src/spec/v2/roc.js";
import { assertV2ReferentialIntegrity } from "../src/spec/v2/validate.js";

describe("v2 renderer series identity", () => {
  it("characterizes distinct series sharing one display group", () => {
    expect(Value.Check(RocV2SpecSchema, sharedDisplayGroup)).toBe(true);
    expect(() =>
      assertV2ReferentialIntegrity(sharedDisplayGroup as RocV2Spec),
    ).not.toThrow();
    expect(sharedDisplayGroup.series.map((series) => series.id)).toEqual([
      "series-model-a",
      "series-model-b",
    ]);
    expect(new Set(sharedDisplayGroup.series.map((series) => series.display.group))).toEqual(
      new Set(["shared-aesthetic-group"]),
    );
    expect(new Set(sharedDisplayGroup.data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-model-a", "series-model-b"]),
    );
  });

  it("uses seriesId as the browser line grouping channel while color remains display-group driven", () => {
    const source = readFileSync(new URL("../src/render/v2.ts", import.meta.url), "utf8");
    expect(source.match(/z: "seriesId"/g)).toHaveLength(3);
    expect(source.match(/stroke: "group"/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
