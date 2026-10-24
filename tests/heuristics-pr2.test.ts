// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderReport } from "../src/render/report.js";
import type { ReportSpecV1_1 } from "../src/spec/report.js";
import {
  resolveNearestCompatiblePair,
  parseHeuristicPairKey,
  makeHeuristicPairKey,
} from "../src/render/report.js";
import type { HeuristicPairKey } from "../src/spec/v2/heuristics.js";

describe("PR 2 — Interactive Heuristic Controls & Coordinated Variant Switching", () => {
  const fixturePath = join(
    process.cwd(),
    "fixtures/v2/fixture-a-heuristics-report.json",
  );
  const fixtureJson = readFileSync(fixturePath, "utf-8");
  const fixtureReport = JSON.parse(fixtureJson) as ReportSpecV1_1;

  it("1. Legacy reports render without heuristic controls", () => {
    const legacyReport: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      sections: [
        {
          id: "sec-1",
          title: "Legacy Section",
          items: [
            {
              type: "component",
              id: "legacy-comp",
              title: "Legacy Outcome Distribution",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                evaluations: [{ id: "e1", population: "Pop 1" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    horizon: 5,
                    estimator: "raw",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const el = renderReport(legacyReport);
    document.body.append(el);

    const controls = el.querySelector(".rtichoke-report__heuristics-controls");
    expect(controls).toBeNull();

    const compContent = el.querySelector("[data-component-id='legacy-comp']");
    expect(compContent).not.toBeNull();
    expect(compContent?.querySelector(".rtichoke-outcome-distribution")).not.toBeNull();
    el.remove();
  });

  it("2. Interactive reports initialize at heuristics.active", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const controls = el.querySelector(".rtichoke-report__heuristics-controls");
    expect(controls).not.toBeNull();

    // Fixture A active is "adjusted:adjusted_as_censored"
    const censRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='adjusted']",
    );
    const compRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='adjusted_as_censored']",
    );

    expect(censRadio?.checked).toBe(true);
    expect(compRadio?.checked).toBe(true);

    // Verify initial readout corresponds to horizon 10 value: 0.34375 (34.4%)
    const readoutText = el.querySelector(
      ".rtichoke-outcome-distribution__readout",
    )?.textContent;
    expect(readoutText).toContain("34.4%");
  });

  it("3. Both radio groups support selection and interaction", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const exclCensRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    );
    expect(exclCensRadio).not.toBeNull();

    exclCensRadio!.checked = true;
    exclCensRadio!.dispatchEvent(new Event("change"));

    // Active key should now be "excluded:adjusted_as_censored"
    const readoutText = el.querySelector(
      ".rtichoke-outcome-distribution__readout",
    )?.textContent;
    // Horizon 10 value for excluded:adjusted_as_censored is 0.375 (37.5%)
    expect(readoutText).toContain("37.5%");
  });

  it("4 & 5. All eight Fixture A combinations can be selected and update displayed precomputed probabilities", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const expectedHorizon10PrimaryEstimates: Record<HeuristicPairKey, string> = {
      "excluded:excluded": "50.0%",
      "excluded:adjusted_as_censored": "37.5%",
      "excluded:adjusted_as_negative": "33.3%",
      "excluded:adjusted_as_composite": "66.7%",
      "adjusted:excluded": "44.4%",
      "adjusted:adjusted_as_censored": "34.4%",
      "adjusted:adjusted_as_negative": "31.3%",
      "adjusted:adjusted_as_composite": "62.5%",
    };

    for (const [pairKey, expectedText] of Object.entries(
      expectedHorizon10PrimaryEstimates,
    )) {
      const { censoring, competing } = parseHeuristicPairKey(
        pairKey as HeuristicPairKey,
      );

      const censRadio = el.querySelector<HTMLInputElement>(
        `input[name$='-censoring'][value='${censoring}']`,
      );
      censRadio!.checked = true;
      censRadio!.dispatchEvent(new Event("change"));

      const compRadio = el.querySelector<HTMLInputElement>(
        `input[name$='-competing'][value='${competing}']`,
      );
      compRadio!.checked = true;
      compRadio!.dispatchEvent(new Event("change"));

      const readoutText = el.querySelector(
        ".rtichoke-outcome-distribution__readout",
      )?.textContent;
      expect(readoutText).toContain(expectedText);
    }
  });

  it("7. Selected horizon is preserved when switching heuristics", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    // Move horizon slider to horizon 5 (index 0)
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    expect(slider).not.toBeNull();

    // Available steps: [0, 5, 10]. Index 0 = Time 0, Index 1 = Time 5, Index 2 = Time 10.
    // Changing value to "1" selects horizon 5 (Time 5)
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));

    // Verify horizon 5 active readout text
    let readoutHeader = el.querySelector(
      ".rtichoke-outcome-distribution__readout-header",
    )?.textContent;
    expect(readoutHeader).toContain("Time = 5.000");

    // Change censoring heuristic to excluded
    const exclCensRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    exclCensRadio.checked = true;
    exclCensRadio.dispatchEvent(new Event("change"));

    // Readout header should still be for Horizon 5 (Time = 5.000)
    readoutHeader = el.querySelector(
      ".rtichoke-outcome-distribution__readout-header",
    )?.textContent;
    expect(readoutHeader).toContain("Time = 5.000");
  });

  it("8 & 9. Unsupported or missing variants show explicit unavailable placeholder without fallback", () => {
    const reportWithUnsupported = JSON.parse(JSON.stringify(fixtureReport));
    // Set "excluded:excluded" as unsupported in OutcomeDistribution spec
    reportWithUnsupported.sections[0].items[0].spec.variants[
      "excluded:excluded"
    ] = { status: "unsupported" };

    const el = renderReport(reportWithUnsupported);
    document.body.append(el);

    // Switch to excluded:excluded
    const censRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    censRadio.checked = true;
    censRadio.dispatchEvent(new Event("change"));

    const compRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='excluded']",
    )!;
    compRadio.checked = true;
    compRadio.dispatchEvent(new Event("change"));

    const placeholder = el.querySelector(".rtichoke-report__unavailable");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain(
      "This visualization is unavailable for the selected censoring and competing-event heuristics.",
    );
    expect(placeholder?.textContent).toContain("Censoring = Excluded");
    expect(placeholder?.textContent).toContain("Competing events = Excluded");
  });

  it("10. Statistically heuristic-dependent components without variants show explicit unavailable placeholder", () => {
    const rocSpec = JSON.parse(readFileSync(join(process.cwd(), "fixtures/v2/roc.json"), "utf-8"));
    const reportWithRoc = JSON.parse(JSON.stringify(fixtureReport));
    reportWithRoc.sections[0].items.push({
      type: "component",
      id: "roc-comp",
      title: "Dependent ROC",
      spec: rocSpec,
    });

    const el = renderReport(reportWithRoc);
    document.body.append(el);

    const rocContainer = el.querySelector("[data-component-id='roc-comp']");
    expect(rocContainer).not.toBeNull();

    const placeholder = rocContainer?.querySelector(".rtichoke-report__unavailable");
    expect(placeholder).not.toBeNull();
  });

  it("11. Multiple report instances do not share or leak radio state", () => {
    const rep1 = renderReport(fixtureReport);
    const rep2 = renderReport(fixtureReport);

    document.body.append(rep1, rep2);

    const rep1CensName = rep1
      .querySelector("input[value='excluded']")
      ?.getAttribute("name");
    const rep2CensName = rep2
      .querySelector("input[value='excluded']")
      ?.getAttribute("name");

    expect(rep1CensName).not.toEqual(rep2CensName);

    // Interacting with rep1 radio does not alter rep2
    const rep1Excl = rep1.querySelector<HTMLInputElement>(
      `input[name='${rep1CensName}'][value='excluded']`,
    )!;
    rep1Excl.checked = true;
    rep1Excl.dispatchEvent(new Event("change"));

    const rep2Adj = rep2.querySelector<HTMLInputElement>(
      `input[name='${rep2CensName}'][value='adjusted']`,
    )!;
    expect(rep2Adj.checked).toBe(true);
  });

  it("13. Switching between two-state and three-state distributions preserves 3-state composition", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    // Select "adjusted:adjusted_as_negative"
    const compRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='adjusted_as_negative']",
    )!;
    compRadio.checked = true;
    compRadio.dispatchEvent(new Event("change"));

    const readoutText = el.querySelector(
      ".rtichoke-outcome-distribution__readout",
    )?.textContent;

    // Horizon 10 states: Primary = 31.3% (5/16), Competing = 31.3% (5/16), Event-free = 37.5% (3/8)
    expect(readoutText).toContain("Primary Event");
    expect(readoutText).toContain("31.3%");
    expect(readoutText).toContain("Competing Event");
    expect(readoutText).toContain("Event Free");
    expect(readoutText).toContain("37.5%");
  });

  it("14. Repeated switching does not duplicate controls or leak content", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const censRadioExcl = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    const censRadioAdj = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='adjusted']",
    )!;

    for (let i = 0; i < 5; i++) {
      censRadioExcl.checked = true;
      censRadioExcl.dispatchEvent(new Event("change"));
      censRadioAdj.checked = true;
      censRadioAdj.dispatchEvent(new Event("change"));
    }

    const controls = el.querySelectorAll(".rtichoke-report__heuristics-controls");
    expect(controls.length).toBe(1);
  });

  it("15. Sparse availability matrices disable unavailable radio options and perform deterministic nearest pair resolution", () => {
    const available: HeuristicPairKey[] = [
      "excluded:excluded",
      "adjusted:adjusted_as_censored",
    ];

    // Testing nearest compatible pair logic
    // 1. Changing censoring to 'adjusted' when active is 'excluded:excluded' -> nearest is 'adjusted:adjusted_as_censored'
    const pair1 = resolveNearestCompatiblePair(
      "adjusted",
      "excluded",
      available,
      "excluded:excluded",
    );
    expect(pair1).toBe("adjusted:adjusted_as_censored");

    // 2. Rendering DOM with sparse matrix
    const sparseReport: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      heuristics: {
        active: "excluded:excluded",
        available,
      },
      sections: [
        {
          id: "sec-1",
          title: "Sparse Section",
          items: [
            {
              type: "component",
              id: "comp-1",
              title: "Outcome Distribution",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                evaluations: [{ id: "e1", population: "Pop" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    estimator: "raw",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                ],
                variants: {
                  "excluded:excluded": {
                    status: "available",
                    stateDistributions: [
                      {
                        evaluationId: "e1",
                        estimator: "raw",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                    ],
                    exclusions: [],
                  },
                  "adjusted:adjusted_as_censored": {
                    status: "available",
                    stateDistributions: [
                      {
                        evaluationId: "e1",
                        estimator: "raw",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                    ],
                    exclusions: [],
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const el = renderReport(sparseReport);
    document.body.append(el);

    // When active is 'excluded:excluded', competing options 'adjusted_as_censored', 'adjusted_as_negative', 'adjusted_as_composite' are unavailable/disabled for 'excluded' censoring
    const disabledComp = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='adjusted_as_censored']",
    );
    expect(disabledComp?.disabled).toBe(true);

    // Changing censoring to 'adjusted' should auto-select 'adjusted_as_censored'
    const adjCensRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='adjusted']",
    )!;
    adjCensRadio.checked = true;
    adjCensRadio.dispatchEvent(new Event("change"));

    const checkedComp = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='adjusted_as_censored']",
    );
    expect(checkedComp?.checked).toBe(true);
  });

  it("16. Supports grouped components inside tab panels", () => {
    const tabbedReport: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      heuristics: fixtureReport.heuristics,
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "group",
              id: "grp-1",
              title: "Group 1",
              components: [
                fixtureReport.sections[0].items[0] as any,
              ],
            },
          ],
        },
      ],
    };

    const el = renderReport(tabbedReport, { groupPresentation: "tabs" });
    document.body.append(el);

    const compInGroup = el.querySelector("[data-component-id='fixture-a-outcome-distribution']");
    expect(compInGroup).not.toBeNull();

    // Changing radio heuristic should update grouped component inside tab panel
    const censRadio = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    censRadio.checked = true;
    censRadio.dispatchEvent(new Event("change"));

    const readoutText = compInGroup?.querySelector(
      ".rtichoke-outcome-distribution__readout",
    )?.textContent;
    expect(readoutText).toContain("37.5%");
  });

  it("17. Review Feedback 1 — Radio inputs preserve DOM identity and keyboard focus after repeated switching", () => {
    const el = renderReport(fixtureReport);
    document.body.append(el);

    const censRadioExcl = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    expect(censRadioExcl).not.toBeNull();

    // Focus the radio button and activate it
    censRadioExcl.focus();
    expect(document.activeElement).toBe(censRadioExcl);

    censRadioExcl.checked = true;
    censRadioExcl.dispatchEvent(new Event("change"));

    // Verify focus remains on censRadioExcl after heuristic selection update
    expect(document.activeElement).toBe(censRadioExcl);

    const compRadioExcl = el.querySelector<HTMLInputElement>(
      "input[name$='-competing'][value='excluded']",
    )!;
    compRadioExcl.focus();
    expect(document.activeElement).toBe(compRadioExcl);

    compRadioExcl.checked = true;
    compRadioExcl.dispatchEvent(new Event("change"));

    expect(document.activeElement).toBe(compRadioExcl);
    el.remove();
  });

  it("18. Review Feedback 2 — Preserves numeric horizon across variant switching with differing horizon grids", () => {
    const multiGridReport: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      heuristics: {
        active: "adjusted:adjusted_as_censored",
        available: [
          "adjusted:adjusted_as_censored",
          "excluded:excluded",
          "adjusted:excluded",
        ],
      },
      sections: [
        {
          id: "sec-1",
          title: "Grid Section",
          items: [
            {
              type: "component",
              id: "comp-grid",
              title: "Multi Grid Outcome Distribution",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                evaluations: [{ id: "e1", population: "Pop" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    horizon: 5,
                    estimator: "raw",
                    estimateOrigin: "fixed_time_horizon",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                  {
                    evaluationId: "e1",
                    horizon: 10,
                    estimator: "raw",
                    estimateOrigin: "fixed_time_horizon",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                  {
                    evaluationId: "e1",
                    horizon: 20,
                    estimator: "raw",
                    estimateOrigin: "fixed_time_horizon",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                ],
                variants: {
                  "adjusted:adjusted_as_censored": {
                    status: "available",
                    stateDistributions: [
                      {
                        evaluationId: "e1",
                        horizon: 5,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                      {
                        evaluationId: "e1",
                        horizon: 10,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                      {
                        evaluationId: "e1",
                        horizon: 20,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                    ],
                    exclusions: [],
                  },
                  // Variant with horizons 10 and 30
                  "excluded:excluded": {
                    status: "available",
                    stateDistributions: [
                      {
                        evaluationId: "e1",
                        horizon: 10,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                      {
                        evaluationId: "e1",
                        horizon: 30,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                    ],
                    exclusions: [],
                  },
                  // Variant with horizons 15 and 25 (does NOT contain 10, should pick nearest horizon = 15)
                  "adjusted:excluded": {
                    status: "available",
                    stateDistributions: [
                      {
                        evaluationId: "e1",
                        horizon: 15,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                      {
                        evaluationId: "e1",
                        horizon: 25,
                        estimator: "raw",
                        estimateOrigin: "fixed_time_horizon",
                        states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                      },
                    ],
                    exclusions: [],
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const el = renderReport(multiGridReport);
    document.body.append(el);

    // Initial slider in variant 1 has availableSteps [0, 5, 10, 20]
    const slider = el.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    )!;
    // Set slider value to index 2 -> numeric horizon = 10
    slider.value = "2";
    slider.dispatchEvent(new Event("input"));

    let readoutHeader = el.querySelector(
      ".rtichoke-outcome-distribution__readout-header",
    )?.textContent;
    expect(readoutHeader).toContain("Time = 10.000");

    // Switch to 'excluded:excluded' (horizons [10, 30])
    const censRadioExcl = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    censRadioExcl.checked = true;
    censRadioExcl.dispatchEvent(new Event("change"));

    // Numeric horizon 10 should be preserved!
    readoutHeader = el.querySelector(
      ".rtichoke-outcome-distribution__readout-header",
    )?.textContent;
    expect(readoutHeader).toContain("Time = 10.000");

    // Switch to 'adjusted:excluded' (horizons [15, 25]) - numeric 10 missing, nearest is 15
    const censRadioAdj = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='adjusted']",
    )!;
    censRadioAdj.checked = true;
    censRadioAdj.dispatchEvent(new Event("change"));

    readoutHeader = el.querySelector(
      ".rtichoke-outcome-distribution__readout-header",
    )?.textContent;
    expect(readoutHeader).toContain("Time = 15.000");
    el.remove();
  });

  it("19. Review Feedback 3 & 4 — Unaffected and independent components are not re-rendered when heuristics switch", () => {
    const reportWithIndependent: ReportSpecV1_1 = {
      schemaVersion: "1.1",
      type: "report",
      heuristics: fixtureReport.heuristics,
      sections: [
        {
          id: "sec-1",
          title: "Section 1",
          items: [
            {
              type: "component",
              id: "aware-comp",
              title: "Aware Outcome Distribution",
              spec: (fixtureReport.sections[0].items[0] as any).spec,
            },
            {
              type: "component",
              id: "indep-comp",
              title: "Independent Component",
              spec: {
                schemaVersion: "2.0",
                type: "outcome_distribution",
                heuristicPolicy: "independent",
                evaluations: [{ id: "e1", population: "Pop" }],
                stateDistributions: [
                  {
                    evaluationId: "e1",
                    horizon: 5,
                    estimator: "raw",
                    states: [{ stateId: "s1", count: 10, estimate: 1.0 }],
                  },
                ],
              } as any,
            },
          ],
        },
      ],
    };

    const el = renderReport(reportWithIndependent);
    document.body.append(el);

    const indepContainer = el.querySelector("[data-component-id='indep-comp'] .rtichoke-report__component-content")!;
    expect(indepContainer).not.toBeNull();
    const initialIndepChild = indepContainer.firstElementChild;

    // Switch heuristic
    const censRadioExcl = el.querySelector<HTMLInputElement>(
      "input[name$='-censoring'][value='excluded']",
    )!;
    censRadioExcl.checked = true;
    censRadioExcl.dispatchEvent(new Event("change"));

    // Independent component DOM child must remain identical (not re-rendered)
    expect(indepContainer.firstElementChild).toBe(initialIndepChild);
    el.remove();
  });
});
