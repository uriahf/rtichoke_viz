// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import calibration from "../fixtures/v2/calibration.json" with { type: "json" };
import { structuredReportFixture } from "../fixtures/v2/structured-report-v1_1.js";
import decisionCurveTime from "../fixtures/v2/decision-curve-time-multi.json" with { type: "json" };
import gains from "../fixtures/v2/gains-single.json" with { type: "json" };
import lift from "../fixtures/v2/lift-single.json" with { type: "json" };
import performanceTable from "../fixtures/v2/performance-table.json" with { type: "json" };
import precisionRecall from "../fixtures/v2/precision-recall-single.json" with { type: "json" };
import roc from "../fixtures/v2/roc.json" with { type: "json" };
import type {
  ReportSpecV1_0,
  ReportSpecV1_1,
  StandaloneCanonicalSpec,
} from "../src/spec/report.js";
import { renderReport } from "../src/render/report.js";

function report(
  components: ReportSpecV1_0["components"],
  title?: string,
): ReportSpecV1_0 {
  return { schemaVersion: "1.0", type: "report", title, components };
}

function component(id: string, spec: object, title?: string) {
  return {
    id,
    title,
    spec: structuredClone(spec),
  } as ReportSpecV1_0["components"][number];
}

describe("renderReport", () => {
  it("renders a minimal ReportSpec v1.1 structured report", () => {
    const structured: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      title: "Structured Summary",
      sections: [
        {
          id: "discrimination",
          title: "Discrimination",
          items: [
            {
              type: "component",
              id: "roc-threshold",
              title: "ROC Curve",
              spec: structuredClone(roc) as StandaloneCanonicalSpec,
            },
          ],
        },
      ],
    };

    const root = renderReport(structured);
    expect(root.tagName).toBe("ARTICLE");
    expect(root.querySelector(".rtichoke-report__title")?.textContent).toBe(
      "Structured Summary",
    );
    expect(
      root.querySelector(
        'section[data-section-id="discrimination"] .rtichoke-report__section-title',
      )?.textContent,
    ).toBe("Discrimination");
    expect(
      root.querySelector(
        'section[data-component-id="roc-threshold"] .rtichoke-report__component-title',
      )?.textContent,
    ).toBe("ROC Curve");
    expect(
      root.querySelector('[data-component-id="roc-threshold"] svg'),
    ).not.toBeNull();
  });

  it("renders the optional report title", () => {
    const root = renderReport(report([component("roc", roc)], "Model report"));
    expect(root.querySelector(".rtichoke-report__title")?.textContent).toBe(
      "Model report",
    );
  });

  it("renders components in array order with stable component identity", () => {
    const root = renderReport(
      report([
        component("table", performanceTable),
        component("roc", roc),
        component("calibration", calibration),
      ]),
    );
    const containers = [
      ...root.querySelectorAll<HTMLElement>(".rtichoke-report__component"),
    ];
    expect(containers.map((item) => item.dataset.componentId)).toEqual([
      "table",
      "roc",
      "calibration",
    ]);
    expect(new Set(containers.map((item) => item.dataset.componentId)).size).toBe(
      containers.length,
    );
  });

  it("renders optional component titles", () => {
    const root = renderReport(
      report([
        component("roc", roc, "Discrimination"),
        component("table", performanceTable, "Operating points"),
      ]),
    );
    expect(
      [...root.querySelectorAll(".rtichoke-report__component-title")].map(
        (item) => item.textContent,
      ),
    ).toEqual(["Discrimination", "Operating points"]);
  });

  it("composes a chart and PerformanceTable as siblings", () => {
    const root = renderReport(
      report([component("roc", roc), component("table", performanceTable)]),
    );
    expect(root.querySelector('[data-component-id="roc"] svg')).not.toBeNull();
    expect(
      root.querySelector(
        '[data-component-id="table"] .rtichoke-performance-table',
      ),
    ).not.toBeNull();
  });

  it.each([
    ["roc", roc],
    ["calibration", calibration],
    ["precision-recall", precisionRecall],
    ["gains", gains],
    ["lift", lift],
  ])("dispatches the %s component to its existing chart renderer", (id, spec) => {
    const root = renderReport(report([component(id, spec)]));
    expect(root.querySelector(`[data-component-id="${id}"] svg`)).not.toBeNull();
  });

  it("dispatches PerformanceTable to the existing table renderer", () => {
    const root = renderReport(report([component("performance", performanceTable)]));
    expect(
      root.querySelector(
        '[data-component-id="performance"] .rtichoke-performance-table__table',
      ),
    ).not.toBeNull();
  });

  it("rejects an invalid ReportSpec before rendering components", () => {
    const invalid = report([]);
    expect(() => renderReport(invalid)).toThrow("Invalid ReportSpec");
  });

  it("rejects duplicate report component ids before rendering", () => {
    const invalid = report([
      component("duplicate", roc),
      component("duplicate", performanceTable),
    ]);
    expect(() => renderReport(invalid)).toThrow(
      "duplicate component id: duplicate",
    );
  });

  it("keeps equal evaluation ids component-local", () => {
    const first = structuredClone(roc);
    const second = structuredClone(roc);
    first.evaluations[0].id = "evaluation-1";
    first.series[0].evaluationId = "evaluation-1";
    second.evaluations[0].id = "evaluation-1";
    second.series[0].evaluationId = "evaluation-1";

    const root = renderReport(
      report([component("roc-a", first), component("roc-b", second)]),
    );
    expect(root.querySelector('[data-component-id="roc-a"] svg')).not.toBeNull();
    expect(root.querySelector('[data-component-id="roc-b"] svg')).not.toBeNull();
    expect(root.querySelectorAll(".rtichoke-report__component")).toHaveLength(2);
  });

  it("delegates time-dependent Decision Curves to independent local horizon controls", () => {
    const root = renderReport(
      report([
        component("decision-a", decisionCurveTime),
        component("decision-b", decisionCurveTime),
      ]),
    );
    const first = root.querySelector<HTMLElement>('[data-component-id="decision-a"]')!;
    const second = root.querySelector<HTMLElement>('[data-component-id="decision-b"]')!;
    expect(first.querySelector('select[aria-label="Fixed Time Horizon"]')).not.toBeNull();
    expect(second.querySelector('select[aria-label="Fixed Time Horizon"]')).not.toBeNull();
    expect(root.querySelectorAll('select[aria-label="Fixed Time Horizon"]')).toHaveLength(2);
  });

  describe("ReportSpec v1.1 structured rendering", () => {
    const createV1_1Report = (overrides?: Partial<ReportSpecV1_1>): ReportSpecV1_1 => ({
      schemaVersion: "1.1",
      type: "report",
      title: "Model Summary Report",
      sections: [
        {
          id: "calibration",
          title: "Calibration",
          items: [
            {
              type: "component",
              id: "cal-discrete",
              title: "Discrete Calibration",
              spec: structuredClone(calibration) as StandaloneCanonicalSpec,
            },
          ],
        },
        {
          id: "discrimination",
          title: "Discrimination",
          items: [
            {
              type: "group",
              id: "by-threshold",
              title: "By Probability Threshold",
              components: [
                {
                  type: "component",
                  id: "roc-thresh",
                  title: "ROC",
                  spec: structuredClone(roc) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "pr-thresh",
                  title: "Precision-Recall",
                  spec: structuredClone(precisionRecall) as StandaloneCanonicalSpec,
                },
              ],
            },
            {
              type: "group",
              id: "by-ppcr",
              title: "By PPCR",
              components: [
                {
                  type: "component",
                  id: "gains-ppcr",
                  title: "Gains",
                  spec: structuredClone(gains) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "lift-ppcr",
                  title: "Lift",
                  spec: structuredClone(lift) as StandaloneCanonicalSpec,
                },
              ],
            },
          ],
        },
        {
          id: "utility",
          title: "Utility",
          items: [
            {
              type: "component",
              id: "dca",
              title: "Decision Curve",
              spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "ia",
              title: "Interventions Avoided",
              spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec,
            },
          ],
        },
      ],
      ...overrides,
    });

    it("preserves section, group, and component ordering", () => {
      const root = renderReport(createV1_1Report());

      const sectionIds = [
        ...root.querySelectorAll<HTMLElement>(".rtichoke-report__section"),
      ].map((el) => el.dataset.sectionId);
      expect(sectionIds).toEqual(["calibration", "discrimination", "utility"]);

      const discGroups = [
        ...root.querySelectorAll<HTMLElement>(
          '.rtichoke-report__section[data-section-id="discrimination"] .rtichoke-report__group',
        ),
      ].map((el) => el.dataset.groupId);
      expect(discGroups).toEqual(["by-threshold", "by-ppcr"]);

      const compIds = [
        ...root.querySelectorAll<HTMLElement>(".rtichoke-report__component"),
      ].map((el) => el.dataset.componentId);
      expect(compIds).toEqual([
        "cal-discrete",
        "roc-thresh",
        "pr-thresh",
        "gains-ppcr",
        "lift-ppcr",
        "dca",
        "ia",
      ]);
    });

    it("applies correct heading depths for titled report (h1, h2, h3, h4)", () => {
      const root = renderReport(createV1_1Report({ title: "Summary Report" }));

      expect(root.querySelector(".rtichoke-report__title")?.tagName).toBe("H1");

      const sectionTitle = root.querySelector(
        '.rtichoke-report__section[data-section-id="discrimination"] > .rtichoke-report__section-title',
      );
      expect(sectionTitle?.tagName).toBe("H2");

      const groupTitle = root.querySelector(
        '.rtichoke-report__group[data-group-id="by-threshold"] > .rtichoke-report__group-title',
      );
      expect(groupTitle?.tagName).toBe("H3");

      const groupedCompTitle = root.querySelector(
        '.rtichoke-report__component[data-component-id="roc-thresh"] > .rtichoke-report__component-title',
      );
      expect(groupedCompTitle?.tagName).toBe("H4");

      const directCompTitle = root.querySelector(
        '.rtichoke-report__component[data-component-id="cal-discrete"] > .rtichoke-report__component-title',
      );
      expect(directCompTitle?.tagName).toBe("H3");
    });

    it("applies correct heading depths for untitled report (shifted up: h1, h2, h3)", () => {
      const spec = createV1_1Report();
      delete spec.title;
      const root = renderReport(spec);

      expect(root.querySelector(".rtichoke-report__title")).toBeNull();

      const sectionTitle = root.querySelector(
        '.rtichoke-report__section[data-section-id="discrimination"] > .rtichoke-report__section-title',
      );
      expect(sectionTitle?.tagName).toBe("H1");

      const groupTitle = root.querySelector(
        '.rtichoke-report__group[data-group-id="by-threshold"] > .rtichoke-report__group-title',
      );
      expect(groupTitle?.tagName).toBe("H2");

      const groupedCompTitle = root.querySelector(
        '.rtichoke-report__component[data-component-id="roc-thresh"] > .rtichoke-report__component-title',
      );
      expect(groupedCompTitle?.tagName).toBe("H3");

      const directCompTitle = root.querySelector(
        '.rtichoke-report__component[data-component-id="cal-discrete"] > .rtichoke-report__component-title',
      );
      expect(directCompTitle?.tagName).toBe("H2");
    });

    it("omits component title element entirely when component title is missing", () => {
      const spec = createV1_1Report({
        sections: [
          {
            id: "sec",
            title: "Section",
            items: [
              {
                type: "component",
                id: "untitled-comp",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
        ],
      });
      const root = renderReport(spec);
      const comp = root.querySelector('[data-component-id="untitled-comp"]')!;
      expect(comp.querySelector(".rtichoke-report__component-title")).toBeNull();
    });

    it("derives table of contents navigation from section and group structure", () => {
      const root = renderReport(createV1_1Report());

      const nav = root.querySelector(".rtichoke-report__nav");
      expect(nav).not.toBeNull();
      expect(nav?.getAttribute("aria-label")).toBe("Report sections");

      const navLinks = [...root.querySelectorAll<HTMLAnchorElement>(".rtichoke-report__nav-link")];
      const navTextsAndHrefs = navLinks.map((a) => ({ text: a.textContent, href: a.getAttribute("href") }));

      expect(navTextsAndHrefs).toEqual([
        { text: "Calibration", href: "#calibration" },
        { text: "Discrimination", href: "#discrimination" },
        { text: "By Probability Threshold", href: "#by-threshold" },
        { text: "By PPCR", href: "#by-ppcr" },
        { text: "Utility", href: "#utility" },
      ]);
    });

    it("omits navigation when there is only 1 navigable section/group target", () => {
      const singleTarget: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [
          {
            id: "sec-only",
            title: "Single Section",
            items: [
              {
                type: "component",
                id: "comp1",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
        ],
      };
      const root = renderReport(singleTarget);
      expect(root.querySelector(".rtichoke-report__nav")).toBeNull();
    });

    it("resolves navigation links to safe deterministic DOM IDs and handles sanitization collisions", () => {
      const collisionSpec: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        title: "Collision Test",
        sections: [
          {
            id: "my section",
            title: "Section 1",
            items: [
              {
                type: "component",
                id: "c1",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
          {
            id: "my-section",
            title: "Section 2",
            items: [
              {
                type: "component",
                id: "c2",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
        ],
      };

      const root = renderReport(collisionSpec);
      const sections = root.querySelectorAll(".rtichoke-report__section");
      expect(sections[0].id).toBe("my-section");
      expect(sections[1].id).toBe("my-section-1");

      const navLinks = root.querySelectorAll<HTMLAnchorElement>(".rtichoke-report__nav-link");
      expect(navLinks[0].getAttribute("href")).toBe("#my-section");
      expect(navLinks[1].getAttribute("href")).toBe("#my-section-1");
    });

    it("retains raw canonical IDs intact in data attributes", () => {
      const spec = createV1_1Report();
      const root = renderReport(spec);

      expect(root.querySelector('[data-section-id="discrimination"]')).not.toBeNull();
      expect(root.querySelector('[data-group-id="by-threshold"]')).not.toBeNull();
      expect(root.querySelector('[data-component-id="roc-thresh"]')).not.toBeNull();
    });

    it("renders Utility section containing Decision Curve and Interventions Avoided", () => {
      const root = renderReport(createV1_1Report());

      const utilitySec = root.querySelector('[data-section-id="utility"]');
      expect(utilitySec).not.toBeNull();
      expect(utilitySec?.querySelector('[data-component-id="dca"]')).not.toBeNull();
      expect(utilitySec?.querySelector('[data-component-id="ia"]')).not.toBeNull();
    });

    it("supports horizon-aware components in structured report with independent local selectors", () => {
      const root = renderReport(createV1_1Report());

      const dcaComp = root.querySelector('[data-component-id="dca"]')!;
      const iaComp = root.querySelector('[data-component-id="ia"]')!;

      const dcaSelect = dcaComp.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]');
      const iaSelect = iaComp.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]');

      expect(dcaSelect).not.toBeNull();
      expect(iaSelect).not.toBeNull();
      expect(dcaSelect).not.toBe(iaSelect);
    });

    it("renders the realistic acceptance fixture report completely without runtime errors", () => {
      const root = renderReport(structuredReportFixture);
      expect(root).not.toBeNull();
      expect(root.querySelector(".rtichoke-report__nav")).not.toBeNull();
      expect(root.querySelectorAll(".rtichoke-report__section")).toHaveLength(4);
      expect(root.querySelectorAll(".rtichoke-report__group")).toHaveLength(4);
      expect(root.querySelectorAll(".rtichoke-report__component")).toHaveLength(13);
    });

    it("fails early before partial DOM rendering on duplicate section or group IDs", () => {
      const invalidSection: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [
          {
            id: "dup",
            title: "Sec 1",
            items: [
              {
                type: "component",
                id: "c1",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
          {
            id: "dup",
            title: "Sec 2",
            items: [
              {
                type: "component",
                id: "c2",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
        ],
      };

      expect(() => renderReport(invalidSection)).toThrow("duplicate section id: dup");
    });
  });

  describe("ReportSpec v1.1 tabbed group presentation", () => {
    const createTabbedReportSpec = (): ReportSpecV1_1 => ({
      schemaVersion: "1.1",
      type: "report",
      title: "Tabbed Summary Report",
      sections: [
        {
          id: "discrimination",
          title: "Discrimination",
          items: [
            {
              type: "group",
              id: "by-threshold",
              title: "By Probability Threshold",
              components: [
                {
                  type: "component",
                  id: "roc-thresh",
                  title: "ROC",
                  spec: structuredClone(roc) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "pr-thresh",
                  title: "Precision-Recall",
                  spec: structuredClone(precisionRecall) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "gains-thresh",
                  title: "Gains",
                  spec: structuredClone(gains) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "lift-thresh",
                  title: "Lift",
                  spec: structuredClone(lift) as StandaloneCanonicalSpec,
                },
              ],
            },
            {
              type: "group",
              id: "by-ppcr",
              title: "By PPCR",
              components: [
                {
                  type: "component",
                  id: "roc-ppcr",
                  title: "ROC",
                  spec: structuredClone(roc) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "dca-ppcr",
                  title: "Horizon DCA",
                  spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec,
                },
                {
                  type: "component",
                  id: "perf-ppcr",
                  title: "Performance Table",
                  spec: structuredClone(performanceTable) as StandaloneCanonicalSpec,
                },
              ],
            },
          ],
        },
      ],
    });

    it("1. Default structured report remains stacked", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec);
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(root.querySelectorAll(".rtichoke-report__component-title").length).toBeGreaterThan(0);
    });

    it("2. v1.0 report rendering unchanged with tab options", () => {
      const v1Spec = report([component("roc", roc, "ROC Title")]);
      const root = renderReport(v1Spec, { groupPresentation: "tabs" });
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(root.querySelector(".rtichoke-report__component-title")?.textContent).toBe("ROC Title");
    });

    it("3. Optional tab mode renders a valid tablist", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const tablists = root.querySelectorAll('[role="tablist"]');
      expect(tablists.length).toBe(2);
    });

    it("4. Correct number/order of tabs", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      expect(tabs).toHaveLength(4);
      expect([...tabs].map((t) => t.textContent)).toEqual([
        "ROC",
        "Precision-Recall",
        "Gains",
        "Lift",
      ]);
    });

    it("5. First tab active deterministically", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(tabs[0].tabIndex).toBe(0);
      expect(tabs[1].getAttribute("aria-selected")).toBe("false");
      expect(tabs[1].tabIndex).toBe(-1);
    });

    it("6. Inactive panels hidden correctly", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const panels = group1.querySelectorAll<HTMLElement>('[role="tabpanel"]');
      expect(panels[0].hidden).toBe(false);
      expect(panels[1].hidden).toBe(true);
      expect(panels[2].hidden).toBe(true);
      expect(panels[3].hidden).toBe(true);
    });

    it("7. ARIA relationships valid", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const panels = group1.querySelectorAll<HTMLElement>('[role="tabpanel"]');

      tabs.forEach((tab, i) => {
        const controls = tab.getAttribute("aria-controls");
        const panel = panels[i];
        expect(controls).toBe(panel.id);
        expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
      });
    });

    it("8. Left/Right keyboard behavior", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const panels = group1.querySelectorAll<HTMLElement>('[role="tabpanel"]');

      tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(panels[1].hidden).toBe(false);
      expect(panels[0].hidden).toBe(true);

      tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(panels[0].hidden).toBe(false);
    });

    it("9. Home/End keyboard behavior", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const panels = group1.querySelectorAll<HTMLElement>('[role="tabpanel"]');

      tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
      expect(tabs[3].getAttribute("aria-selected")).toBe("true");
      expect(panels[3].hidden).toBe(false);

      tabs[3].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(panels[0].hidden).toBe(false);
    });

    it("10. Focus follows active tab", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      document.body.append(root);

      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const tabs = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');

      tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(document.activeElement).toBe(tabs[1]);

      root.remove();
    });

    it("11. No duplicate DOM IDs", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const allElementsWithId = [...root.querySelectorAll("[id]")];
      const ids = allElementsWithId.map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("12. Original canonical IDs remain in data attributes", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      expect(root.querySelector('[data-section-id="discrimination"]')).not.toBeNull();
      expect(root.querySelector('[data-group-id="by-threshold"]')).not.toBeNull();
      expect(root.querySelector('[data-component-id="roc-thresh"]')).not.toBeNull();
      expect(root.querySelector('[data-component-id="pr-thresh"]')).not.toBeNull();
    });

    it("13. Navigation still resolves", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const navLinks = root.querySelectorAll<HTMLAnchorElement>(".rtichoke-report__nav-link");
      navLinks.forEach((link) => {
        const targetId = link.getAttribute("href")?.slice(1);
        expect(root.querySelector(`#${targetId}`)).not.toBeNull();
      });
    });

    it("14. Static chart renders in tab panel", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const rocPanel = root.querySelector('[data-component-id="roc-thresh"]')!;
      expect(rocPanel.querySelector("svg")).not.toBeNull();
    });

    it("15. Performance table renders in tab panel", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const tablePanel = root.querySelector('[data-component-id="perf-ppcr"]')!;
      expect(tablePanel.querySelector(".rtichoke-performance-table")).not.toBeNull();
    });

    it("16. Horizon-aware chart renders in tab panel", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const dcaPanel = root.querySelector('[data-component-id="dca-ppcr"]')!;
      expect(dcaPanel.querySelector('select[aria-label="Fixed Time Horizon"]')).not.toBeNull();
    });

    it("17. Horizon selector remains functional after tab switches", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group2 = root.querySelector('[data-group-id="by-ppcr"]')!;
      const tabs = group2.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const dcaPanel = group2.querySelector<HTMLElement>('[data-component-id="dca-ppcr"]')!;

      // Switch to DCA tab (index 1)
      tabs[1].click();
      expect(dcaPanel.hidden).toBe(false);

      const select = dcaPanel.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]')!;
      select.value = "10";
      select.dispatchEvent(new Event("change"));
      expect(select.value).toBe("10");

      // Switch to Performance Table tab (index 2) and back to DCA tab (index 1)
      tabs[2].click();
      expect(dcaPanel.hidden).toBe(true);

      tabs[1].click();
      expect(dcaPanel.hidden).toBe(false);
      expect(select.value).toBe("10");
    });

    it("18. Multiple independent tablists do not interfere with each other", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const group1 = root.querySelector('[data-group-id="by-threshold"]')!;
      const group2 = root.querySelector('[data-group-id="by-ppcr"]')!;

      const tabs1 = group1.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const tabs2 = group2.querySelectorAll<HTMLButtonElement>('[role="tab"]');

      tabs1[2].click();
      expect(tabs1[2].getAttribute("aria-selected")).toBe("true");
      expect(tabs2[0].getAttribute("aria-selected")).toBe("true");
    });

    it("19. No nested tabs introduced", () => {
      const spec = createTabbedReportSpec();
      const root = renderReport(spec, { groupPresentation: "tabs" });
      const tablists = root.querySelectorAll('[role="tablist"]');
      tablists.forEach((tablist) => {
        expect(tablist.querySelector('[role="tablist"]')).toBeNull();
      });
    });

    it("20. Invalid render option fails clearly if applicable", () => {
      const spec = createTabbedReportSpec();
      expect(() =>
        renderReport(spec, { groupPresentation: "invalid" as any }),
      ).toThrow(
        "Invalid render options: groupPresentation must be 'stacked' or 'tabs'",
      );
    });

    it("renders acceptance fixture with tabbed presentation without errors", () => {
      const root = renderReport(structuredReportFixture, { groupPresentation: "tabs" });
      expect(root).not.toBeNull();
      expect(root.querySelectorAll('[role="tablist"]').length).toBe(4);
    });
  });

  describe("ReportSpec v1.1 section group presentation", () => {
    const renderFixture = () =>
      renderReport(structuredReportFixture, {
        sectionGroupPresentation: "tabs",
      });

    it("creates section-level tabs from sibling group titles", () => {
      const root = renderFixture();
      const discrimination = root.querySelector(
        '[data-section-id="discrimination"]',
      )!;
      const tablist = discrimination.querySelector(
        ":scope > .rtichoke-report__section-group-tablist",
      )!;
      const tabs = tablist.querySelectorAll<HTMLButtonElement>(
        ':scope > [role="tab"]',
      );

      expect([...tabs].map((tab) => tab.textContent)).toEqual([
        "By Probability Threshold",
        "By PPCR",
      ]);
      expect(discrimination.querySelectorAll('[role="tablist"]')).toHaveLength(1);
      expect(
        discrimination.querySelectorAll(".rtichoke-report__component-title"),
      ).toHaveLength(8);
    });

    it("keeps exactly one group panel active with valid ARIA relationships", () => {
      const root = renderFixture();
      const section = root.querySelector('[data-section-id="discrimination"]')!;
      const tabs = section.querySelectorAll<HTMLButtonElement>(
        ':scope > [role="tablist"] > [role="tab"]',
      );
      const panels = section.querySelectorAll<HTMLElement>(
        ':scope > [role="tabpanel"]',
      );

      expect([...tabs].filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
      expect([...panels].filter((panel) => !panel.hidden)).toHaveLength(1);
      tabs.forEach((tab, index) => {
        expect(tab.getAttribute("aria-controls")).toBe(panels[index].id);
        expect(panels[index].getAttribute("aria-labelledby")).toBe(tab.id);
      });
    });

    it("preserves group component order and mounted DOM across switches", () => {
      const root = renderFixture();
      const section = root.querySelector('[data-section-id="discrimination"]')!;
      const tabs = section.querySelectorAll<HTMLButtonElement>(
        ':scope > [role="tablist"] > [role="tab"]',
      );
      const ppcr = section.querySelector<HTMLElement>('[data-group-id="ppcr"]')!;
      const roc = ppcr.querySelector('[data-component-id="roc-ppcr"]')!;

      expect(
        [...ppcr.querySelectorAll<HTMLElement>(".rtichoke-report__component")].map(
          (component) => component.dataset.componentId,
        ),
      ).toEqual(["roc-ppcr", "pr-ppcr", "gains-ppcr", "lift-ppcr"]);
      tabs[1].click();
      tabs[0].click();
      tabs[1].click();
      expect(ppcr.querySelector('[data-component-id="roc-ppcr"]')).toBe(roc);
    });

    it("supports roving Left/Right/Home/End keyboard focus", () => {
      const root = renderFixture();
      document.body.append(root);
      const tabs = root.querySelectorAll<HTMLButtonElement>(
        '[data-section-id="discrimination"] > [role="tablist"] > [role="tab"]',
      );

      tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(document.activeElement).toBe(tabs[1]);
      tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      expect(document.activeElement).toBe(tabs[0]);
      tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
      expect(document.activeElement).toBe(tabs[1]);
      tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      expect(document.activeElement).toBe(tabs[0]);
      root.remove();
    });

    it("keeps direct components visible outside the group tabset", () => {
      const mixed: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [
          {
            id: "mixed",
            title: "Mixed",
            items: [
              { type: "component", id: "before", spec: structuredClone(roc) as StandaloneCanonicalSpec },
              { type: "group", id: "a", title: "A", components: [{ type: "component", id: "a-roc", spec: structuredClone(roc) as StandaloneCanonicalSpec }] },
              { type: "component", id: "between", spec: structuredClone(roc) as StandaloneCanonicalSpec },
              { type: "group", id: "b", title: "B", components: [{ type: "component", id: "b-roc", spec: structuredClone(roc) as StandaloneCanonicalSpec }] },
            ],
          },
        ],
      };
      const root = renderReport(mixed, { sectionGroupPresentation: "tabs" });
      const before = root.querySelector<HTMLElement>('[data-component-id="before"]')!;
      const between = root.querySelector<HTMLElement>('[data-component-id="between"]')!;

      expect(before.closest('[role="tabpanel"]')).toBeNull();
      expect(between.closest('[role="tabpanel"]')).toBeNull();
      expect(before.hidden).toBe(false);
      expect(between.hidden).toBe(false);
    });

    it("does not create a tablist for a section with one group", () => {
      const oneGroup: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [{
          id: "one",
          title: "One",
          items: [{ type: "group", id: "only", title: "Only", components: [{ type: "component", id: "roc-only", spec: structuredClone(roc) as StandaloneCanonicalSpec }] }],
        }],
      };
      const root = renderReport(oneGroup, { sectionGroupPresentation: "tabs" });
      expect(root.querySelector('[role="tablist"]')).toBeNull();
    });

    it("preserves component-local horizon state between group switches", () => {
      const horizonReport: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [{
          id: "time",
          title: "Time",
          items: [
            { type: "group", id: "time-a", title: "Time A", components: [{ type: "component", id: "time-dca", spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec }] },
            { type: "group", id: "time-b", title: "Time B", components: [{ type: "component", id: "time-roc", spec: structuredClone(roc) as StandaloneCanonicalSpec }] },
          ],
        }],
      };
      const root = renderReport(horizonReport, { sectionGroupPresentation: "tabs" });
      const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const select = root.querySelector<HTMLSelectElement>('select[aria-label="Fixed Time Horizon"]')!;
      select.value = "10";
      select.dispatchEvent(new Event("change"));
      tabs[1].click();
      tabs[0].click();
      expect(select.value).toBe("10");
      expect(root.querySelectorAll('select[aria-label="Fixed Time Horizon"]')).toHaveLength(1);
    });

    it("creates independent tabsets for multiple eligible sections", () => {
      const root = renderFixture();
      const tablists = root.querySelectorAll(
        ".rtichoke-report__section-group-tablist",
      );
      expect(tablists).toHaveLength(2);
      expect(root.querySelector('[data-section-id="utility"] [role="tablist"]')).toBeNull();
      expect(root.querySelector('[data-component-id="decision-curve-time"]')).not.toBeNull();
      expect(root.querySelector('[data-component-id="interventions-avoided"]')).not.toBeNull();
    });

    it("uses unique DOM ids and retains hidden semantic group headings", () => {
      const root = renderFixture();
      const ids = [...root.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(
        root.querySelectorAll(".rtichoke-report__group-title--tab-panel"),
      ).toHaveLength(4);
    });

    it("keeps existing groupPresentation behavior orthogonal", () => {
      const root = renderReport(structuredReportFixture, {
        groupPresentation: "tabs",
      });
      expect(root.querySelectorAll(".rtichoke-report__section-group-tablist")).toHaveLength(0);
      expect(root.querySelectorAll('[role="tablist"]')).toHaveLength(4);
    });

    it("supports explicitly requested nested presentation", () => {
      const root = renderReport(structuredReportFixture, {
        groupPresentation: "tabs",
        sectionGroupPresentation: "tabs",
      });
      expect(root.querySelectorAll(".rtichoke-report__section-group-tablist")).toHaveLength(2);
      expect(root.querySelectorAll('[role="tablist"]')).toHaveLength(6);
    });

    it("leaves v1.0 rendering unchanged and rejects invalid new options", () => {
      const v1Root = renderReport(report([component("roc", roc)]), {
        sectionGroupPresentation: "tabs",
      });
      expect(v1Root.querySelector('[role="tablist"]')).toBeNull();
      expect(() =>
        renderReport(structuredReportFixture, {
          sectionGroupPresentation: "invalid" as any,
        }),
      ).toThrow(
        "Invalid render options: sectionGroupPresentation must be 'stacked' or 'tabs'",
      );
    });
  });

  describe("ReportSpec v1.1 section component presentation", () => {
    const createSectionComponentReportSpec = (): ReportSpecV1_1 => ({
      schemaVersion: "1.1",
      type: "report",
      title: "Section Component Tabs Report",
      sections: [
        {
          id: "calibration",
          title: "Calibration",
          items: [
            {
              type: "component",
              id: "cal-smooth",
              title: "Smooth",
              spec: structuredClone(calibration) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "cal-discrete",
              title: "Discrete",
              spec: structuredClone(calibration) as StandaloneCanonicalSpec,
            },
          ],
        },
        {
          id: "utility",
          title: "Utility",
          items: [
            {
              type: "component",
              id: "dca",
              title: "Decision Curve",
              spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec,
            },
            {
              type: "component",
              id: "ia",
              title: "Interventions Avoided",
              spec: structuredClone(decisionCurveTime) as StandaloneCanonicalSpec,
            },
          ],
        },
      ],
    });

    it("preserves default stacked rendering without sectionComponentPresentation", () => {
      const spec = createSectionComponentReportSpec();
      const root = renderReport(spec);
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(
        root.querySelectorAll(".rtichoke-report__component"),
      ).toHaveLength(4);
    });

    it("renders direct component tabs when sectionComponentPresentation is 'tabs'", () => {
      const spec = createSectionComponentReportSpec();
      const root = renderReport(spec, {
        sectionComponentPresentation: "tabs",
      });
      const calSec = root.querySelector('[data-section-id="calibration"]')!;
      const tablist = calSec.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();

      const tabs = tablist!.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      expect([...tabs].map((t) => t.textContent)).toEqual(["Smooth", "Discrete"]);

      const panels = calSec.querySelectorAll<HTMLElement>('[role="tabpanel"]');
      expect(panels).toHaveLength(2);

      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(tabs[0].tabIndex).toBe(0);
      expect(panels[0].hidden).toBe(false);

      expect(tabs[1].getAttribute("aria-selected")).toBe("false");
      expect(tabs[1].tabIndex).toBe(-1);
      expect(panels[1].hidden).toBe(true);

      tabs.forEach((tab, index) => {
        expect(tab.getAttribute("aria-controls")).toBe(panels[index].id);
        expect(panels[index].getAttribute("aria-labelledby")).toBe(tab.id);
      });
    });

    it("supports click and roving keyboard navigation for direct component tabs", () => {
      const spec = createSectionComponentReportSpec();
      const root = renderReport(spec, {
        sectionComponentPresentation: "tabs",
      });
      document.body.append(root);

      const calSec = root.querySelector('[data-section-id="calibration"]')!;
      const tabs = calSec.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const panels = calSec.querySelectorAll<HTMLElement>('[role="tabpanel"]');

      tabs[1].click();
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(panels[1].hidden).toBe(false);
      expect(panels[0].hidden).toBe(true);

      tabs[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
      expect(document.activeElement).toBe(tabs[0]);
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(panels[0].hidden).toBe(false);

      tabs[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(document.activeElement).toBe(tabs[1]);

      tabs[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
      expect(document.activeElement).toBe(tabs[0]);

      tabs[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
      expect(document.activeElement).toBe(tabs[1]);

      root.remove();
    });

    it("does not create a tab interface for a section with only one direct component", () => {
      const singleCompSpec: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [
          {
            id: "single",
            title: "Single Component",
            items: [
              {
                type: "component",
                id: "roc-single",
                title: "ROC",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
            ],
          },
        ],
      };
      const root = renderReport(singleCompSpec, {
        sectionComponentPresentation: "tabs",
      });
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(
        root.querySelector('[data-component-id="roc-single"]'),
      ).not.toBeNull();
    });

    it("handles mixed section composition correctly without interference", () => {
      const mixedSpec: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        title: "Mixed Report",
        sections: [
          {
            id: "discrimination",
            title: "Discrimination",
            items: [
              {
                type: "component",
                id: "auroc",
                title: "AUROC",
                spec: structuredClone(roc) as StandaloneCanonicalSpec,
              },
              {
                type: "group",
                id: "grp-1",
                title: "Threshold Group",
                components: [
                  {
                    type: "component",
                    id: "roc-1",
                    title: "ROC 1",
                    spec: structuredClone(roc) as StandaloneCanonicalSpec,
                  },
                ],
              },
              {
                type: "group",
                id: "grp-2",
                title: "PPCR Group",
                components: [
                  {
                    type: "component",
                    id: "roc-2",
                    title: "ROC 2",
                    spec: structuredClone(roc) as StandaloneCanonicalSpec,
                  },
                ],
              },
            ],
          },
        ],
      };

      const root = renderReport(mixedSpec, {
        sectionComponentPresentation: "tabs",
        sectionGroupPresentation: "tabs",
      });

      const discSec = root.querySelector('[data-section-id="discrimination"]')!;

      const aurocComp = discSec.querySelector('[data-component-id="auroc"]')!;
      expect(aurocComp.closest('[role="tabpanel"]')).toBeNull();

      const groupTablist = discSec.querySelector(
        ".rtichoke-report__section-group-tablist",
      )!;
      expect(groupTablist).not.toBeNull();
      const groupTabs = groupTablist.querySelectorAll('[role="tab"]');
      expect([...groupTabs].map((t) => t.textContent)).toEqual([
        "Threshold Group",
        "PPCR Group",
      ]);
    });

    it("verifies groupPresentation: 'tabs' still functions for group components", () => {
      const spec: ReportSpecV1_1 = {
        schemaVersion: "1.1",
        type: "report",
        sections: [
          {
            id: "sec",
            title: "Section",
            items: [
              {
                type: "group",
                id: "grp",
                title: "Group",
                components: [
                  {
                    type: "component",
                    id: "c1",
                    title: "Comp 1",
                    spec: structuredClone(roc) as StandaloneCanonicalSpec,
                  },
                  {
                    type: "component",
                    id: "c2",
                    title: "Comp 2",
                    spec: structuredClone(roc) as StandaloneCanonicalSpec,
                  },
                ],
              },
            ],
          },
        ],
      };

      const root = renderReport(spec, {
        groupPresentation: "tabs",
        sectionComponentPresentation: "tabs",
      });

      const grp = root.querySelector('[data-group-id="grp"]')!;
      const tabs = grp.querySelectorAll('[role="tab"]');
      expect([...tabs].map((t) => t.textContent)).toEqual(["Comp 1", "Comp 2"]);
    });

    it("rejects invalid sectionComponentPresentation option", () => {
      expect(() =>
        renderReport(createSectionComponentReportSpec(), {
          sectionComponentPresentation: "invalid" as any,
        }),
      ).toThrow(
        "Invalid render options: sectionComponentPresentation must be 'stacked' or 'tabs'",
      );
    });
  });
});
