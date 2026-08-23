import { describe, expect, it } from "vitest";
import { resolveV2RenderOptions } from "../src/render/v2.js";

describe("v2 renderer options", () => {
  it("uses stable default dimensions and colors", () => {
    expect(resolveV2RenderOptions(["model-a", "model-b"])).toMatchObject({
      theme: { width: 600, height: 600 },
      groups: ["model-a", "model-b"],
      colors: ["#1b9e77", "#d95f02"],
      showLegend: true,
    });
  });

  it("accepts consumer-supplied dimensions and colors", () => {
    expect(
      resolveV2RenderOptions(2, {
        width: 720,
        height: 480,
        colors: ["#111111", "#222222"],
      }),
    ).toMatchObject({
      theme: { width: 720, height: 480 },
      colors: ["#111111", "#222222"],
    });
  });

  it("resolves reusable Plotly-like presentation tokens", () => {
    const resolved = resolveV2RenderOptions(["b", "a"], {
      theme: {
        margins: { left: 80 },
        line: { width: 3 },
        marker: { radius: 7 },
        reference: { dash: "2,3" },
        tip: { digits: 2 },
      },
    });
    expect(resolved.theme).toMatchObject({
      margins: { top: 28, left: 80 },
      line: { width: 3 },
      marker: { radius: 7 },
      reference: { color: "#BEBEBE", dash: "2,3" },
      tip: { digits: 2 },
    });
    expect([...resolved.colorByGroup]).toEqual([
      ["b", "#1b9e77"],
      ["a", "#d95f02"],
    ]);
  });

  it("keeps a single display group black", () => {
    expect(resolveV2RenderOptions(1, { colors: ["#123456"] }).colors).toEqual([
      "#000000",
    ]);
  });

  it("rejects invalid dimensions and incomplete palettes", () => {
    expect(() => resolveV2RenderOptions(1, { width: 0 })).toThrow(
      "Renderer width and height must be positive finite numbers",
    );
    expect(() => resolveV2RenderOptions(2, { colors: ["#111111"] })).toThrow(
      "Renderer colors must contain at least one color per display group",
    );
  });
});

