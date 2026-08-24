import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/v2/performance-table.json" with { type: "json" };
import { renderPerformanceTable } from "../src/render/performance-table.js";
import type { PerformanceTableSpec } from "../src/spec/v2/performance-table.js";

function spec(): PerformanceTableSpec {
  return structuredClone(fixture) as PerformanceTableSpec;
}

function render(value: PerformanceTableSpec = spec()): HTMLDivElement {
  const document = new JSDOM().window.document;
  return renderPerformanceTable(value, document);
}

describe("performance table browser renderer", () => {
  it("renders evaluation identity, operating points, metrics, and deterministic order", () => {
    const root = render();
    expect([...root.querySelectorAll("th")].map((node) => node.textContent)).toEqual([
      "Model", "Population", "Evaluation", "Operating point", "Horizon", "Context",
      "Sensitivity", "Specificity", "PPV", "Net Benefit",
    ]);
    const rows = [...root.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);
    expect(rows[0].getAttribute("data-evaluation-id")).toBe("eval-model-a-pop-a");
    expect(rows[0].textContent).toContain("Model A / Population A");
    expect(rows[0].textContent).toContain("Threshold 0.25");
    expect(rows[1].textContent).toContain("PPCR 0.2");
  });

  it("preserves shared-population, multiple-population, and model-unknown semantics", () => {
    const rows = [...render().querySelectorAll("tbody tr")];
    expect(rows[0].querySelector(".rtichoke-performance-table__population")?.textContent).toBe("pop-a");
    expect(rows[1].querySelector(".rtichoke-performance-table__population")?.textContent).toBe("pop-a");
    expect(rows[2].querySelector(".rtichoke-performance-table__population")?.textContent).toBe("pop-b");
    expect(rows[3].querySelector(".rtichoke-performance-table__model")?.textContent).toBe("—");
  });

  it("keeps zero distinct from null and omitted metrics", () => {
    const rows = [...render().querySelectorAll("tbody tr")];
    expect(rows[0].querySelector('[data-metric-id="net_benefit"]')?.textContent).toBe("0");
    expect(rows[1].querySelector('[data-metric-id="ppv"]')?.textContent).toBe("—");
    expect(rows[1].querySelector('[data-metric-id="net_benefit"]')?.textContent).toBe("—");
  });

  it("displays optional uncertainty without changing the estimate", () => {
    const value = spec();
    value.rows[0].values[0].lower = 0.76;
    value.rows[0].values[0].upper = 0.87;
    expect(render(value).querySelector('[data-metric-id="sensitivity"]')?.textContent).toBe("0.82 [0.76, 0.87]");
  });

  it("displays horizons and time-dependent context", () => {
    const rows = [...render().querySelectorAll("tbody tr")];
    expect(rows[3].textContent).toContain("365");
    expect(rows[4].textContent).toContain("730");
    expect(rows[3].textContent).toContain("censoring: adjusted");
    expect(rows[3].textContent).toContain("competing event: adjusted_as_negative");
  });

  it("rejects referential-integrity failures before rendering", () => {
    const value = spec();
    value.rows[0].evaluationId = "missing-evaluation";
    expect(() => render(value)).toThrow("unknown evaluation id: missing-evaluation");
  });
});
