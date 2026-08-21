import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/precision-recall-shared-display-group.json" with { type: "json" };
import type { PrecisionRecallV2Spec } from "../src/spec/v2/precision_recall.js";
import { seriesRenderData } from "../src/render/v2.js";

describe("v2 renderer series identity", () => {
  it("preserves distinct geometric series that share one display group", () => {
    const spec = fixture as PrecisionRecallV2Spec;
    const data = seriesRenderData(spec, spec.data);

    expect(new Set(data.map((datum) => datum.seriesId))).toEqual(
      new Set(["series-a", "series-b"]),
    );
    expect(new Set(data.map((datum) => datum.group))).toEqual(
      new Set(["Shared aesthetic"]),
    );
    expect(new Set(data.map((datum) => datum.label))).toEqual(
      new Set(["Curve A", "Curve B"]),
    );
    expect(data.filter((datum) => datum.seriesId === "series-a")).toHaveLength(2);
    expect(data.filter((datum) => datum.seriesId === "series-b")).toHaveLength(2);
  });
});
