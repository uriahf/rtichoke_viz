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
      expect(root.querySelectorAll(".rtichoke-report__group")).toHaveLength(2);
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
});
