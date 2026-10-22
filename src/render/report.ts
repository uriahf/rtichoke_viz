import { Value } from "@sinclair/typebox/value";
import type {
  ReportComponentV1_1,
  ReportGroup,
  ReportSpec,
  ReportSpecV1_0,
  ReportSpecV1_1,
  StandaloneCanonicalSpec,
} from "../spec/report.js";
import {
  ReportSpecV1_0Schema,
  ReportSpecV1_1Schema,
} from "../spec/report.js";
import { assertReportReferentialIntegrity } from "../spec/validate-report.js";
import type { HeuristicPairKey } from "../spec/v2/heuristics.js";
import type { OutcomeDistributionSpec } from "../spec/v2/outcome-distribution.js";
import { renderDecisionCurveV2 } from "./decision-curve.js";
import { renderInterventionsAvoidedV2 } from "./interventions-avoided.js";
import { renderOutcomeDistribution } from "./outcome-distribution.js";
import { renderPerformanceTable } from "./performance-table.js";
import { renderPredictionDistribution } from "./prediction-distribution.js";
import { renderSummaryMetrics } from "./summary-metrics.js";
import {
  renderCalibrationForReport,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderRocV2,
} from "./v2.js";

let reportInstanceCounter = 0;

export const CENSORING_HEURISTIC_LABELS: Record<string, string> = {
  excluded: "Excluded",
  adjusted: "Adjusted",
};

export const COMPETING_HEURISTIC_LABELS: Record<string, string> = {
  excluded: "Excluded",
  adjusted_as_censored: "Adjusted as censored",
  adjusted_as_negative: "Adjusted as negative",
  adjusted_as_composite: "Adjusted as composite",
};

export const CENSORING_OPTIONS = ["excluded", "adjusted"] as const;
export const COMPETING_OPTIONS = [
  "excluded",
  "adjusted_as_censored",
  "adjusted_as_negative",
  "adjusted_as_composite",
] as const;

export type ComponentHeuristicStatus = "aware" | "independent" | "unavailable";

export function getComponentHeuristicStatus(
  spec: StandaloneCanonicalSpec,
): ComponentHeuristicStatus {
  if (spec.type === "outcome_distribution") {
    if (spec.variants) {
      return "aware";
    }
    return "unavailable";
  }
  // Currently other components do not have precomputed variants in PR 2.
  return "unavailable";
}

export function parseHeuristicPairKey(
  key: HeuristicPairKey,
): { censoring: string; competing: string } {
  const parts = key.split(":");
  return {
    censoring: parts[0],
    competing: parts[1],
  };
}

export function makeHeuristicPairKey(
  censoring: string,
  competing: string,
): HeuristicPairKey {
  return `${censoring}:${competing}` as HeuristicPairKey;
}

export function resolveNearestCompatiblePair(
  targetCensoring: string,
  targetCompeting: string,
  available: HeuristicPairKey[],
  initialActive?: HeuristicPairKey,
): HeuristicPairKey {
  const candidateKey = makeHeuristicPairKey(targetCensoring, targetCompeting);
  if (available.includes(candidateKey)) {
    return candidateKey;
  }

  // 1. Primary priority: Find a pair matching targetCensoring
  const matchingCensoringPairs = available.filter(
    (k) => parseHeuristicPairKey(k).censoring === targetCensoring,
  );

  if (matchingCensoringPairs.length > 0) {
    // Prefer initial active competing option if present in matchingCensoringPairs
    if (initialActive) {
      const initComp = parseHeuristicPairKey(initialActive).competing;
      const matchInitComp = matchingCensoringPairs.find(
        (k) => parseHeuristicPairKey(k).competing === initComp,
      );
      if (matchInitComp) {
        return matchInitComp;
      }
    }
    // Otherwise return first option matching targetCensoring
    return matchingCensoringPairs[0];
  }

  // 2. Secondary priority: Find a pair matching targetCompeting
  const matchingCompetingPairs = available.filter(
    (k) => parseHeuristicPairKey(k).competing === targetCompeting,
  );

  if (matchingCompetingPairs.length > 0) {
    // Prefer initial active censoring option if present
    if (initialActive) {
      const initCens = parseHeuristicPairKey(initialActive).censoring;
      const matchInitCens = matchingCompetingPairs.find(
        (k) => parseHeuristicPairKey(k).censoring === initCens,
      );
      if (matchInitCens) {
        return matchInitCens;
      }
    }
    return matchingCompetingPairs[0];
  }

  // 3. Fallback to first available
  return available[0];
}

export function renderUnavailablePlaceholder(
  selectedPair: HeuristicPairKey,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "rtichoke-report__unavailable";

  const icon = document.createElement("div");
  icon.className = "rtichoke-report__unavailable-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "i";

  const message = document.createElement("p");
  message.className = "rtichoke-report__unavailable-message";
  message.textContent =
    "This visualization is unavailable for the selected censoring and competing-event heuristics.";

  const detail = document.createElement("p");
  detail.className = "rtichoke-report__unavailable-detail";
  const parsed = parseHeuristicPairKey(selectedPair);
  const censLabel = CENSORING_HEURISTIC_LABELS[parsed.censoring] ?? parsed.censoring;
  const compLabel = COMPETING_HEURISTIC_LABELS[parsed.competing] ?? parsed.competing;
  detail.textContent = `Selected heuristics: Censoring = ${censLabel}, Competing events = ${compLabel}`;

  container.append(icon, message, detail);
  return container;
}

function resolveActiveSpecForComponent(
  spec: StandaloneCanonicalSpec,
  activeHeuristic: HeuristicPairKey,
  selectedHorizon?: number,
): { resolvedSpec?: StandaloneCanonicalSpec; isUnavailable: boolean } {
  const status = getComponentHeuristicStatus(spec);

  if (status === "independent") {
    return { resolvedSpec: spec, isUnavailable: false };
  }

  if (status === "aware" && spec.type === "outcome_distribution") {
    const variant = spec.variants?.[activeHeuristic];
    if (!variant || variant.status === "unsupported") {
      return { isUnavailable: true };
    }
    if (variant.status === "available") {
      const activeSpec: OutcomeDistributionSpec = {
        ...spec,
        stateDistributions: variant.stateDistributions,
      };
      return { resolvedSpec: activeSpec, isUnavailable: false };
    }
  }

  return { isUnavailable: true };
}

function renderStandaloneComponentContent(
  spec: StandaloneCanonicalSpec,
): Element {
  switch (spec.type) {
    case "summary_metrics":
      return renderSummaryMetrics(spec);
    case "performance_table":
      return renderPerformanceTable(spec);
    case "prediction_distribution":
      return renderPredictionDistribution(spec);
    case "outcome_distribution":
      return renderOutcomeDistribution(spec);
    case "roc":
      return renderRocV2(spec);
    case "calibration":
      return renderCalibrationForReport(spec);
    case "precision_recall":
      return renderPrecisionRecallV2(spec);
    case "gains":
      return renderGainsV2(spec);
    case "lift":
      return renderLiftV2(spec);
    case "decision_curve":
      return renderDecisionCurveV2(spec);
    case "interventions_avoided":
      return renderInterventionsAvoidedV2(spec);
  }
}

function generateUniqueDomId(rawId: string, used: Set<string>): string {
  let base =
    rawId
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "id";
  if (!/^[a-z]/i.test(base)) {
    base = `id-${base}`;
  }
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  used.add(candidate);
  return candidate;
}

function wireTabInteraction(
  tabs: HTMLButtonElement[],
  panels: HTMLElement[],
): void {
  const activateTab = (index: number, setFocus = true) => {
    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
      tab.tabIndex = isSelected ? 0 : -1;
      panels[tabIndex].hidden = !isSelected;
    });
    if (setFocus) {
      tabs[index].focus();
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateTab(index, false);
    });

    tab.addEventListener("keydown", (event: KeyboardEvent) => {
      let targetIndex: number | null = null;
      if (event.key === "ArrowRight") {
        targetIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex !== null) {
        event.preventDefault();
        activateTab(targetIndex, true);
      }
    });
  });
}

function renderReportV1_0(spec: ReportSpecV1_0): HTMLDivElement {
  if (!Value.Check(ReportSpecV1_0Schema, spec)) {
    throw new Error("Invalid ReportSpec");
  }
  assertReportReferentialIntegrity(spec);

  const root = document.createElement("div");
  root.className = "rtichoke-report";
  if (spec.title) {
    const title = document.createElement("h1");
    title.className = "rtichoke-report__title";
    title.textContent = spec.title;
    root.append(title);
  }
  for (const component of spec.components) {
    const container = document.createElement("section");
    container.className = "rtichoke-report__component";
    container.dataset.componentId = component.id;
    if (component.title) {
      const title = document.createElement("h2");
      title.className = "rtichoke-report__component-title";
      title.textContent = component.title;
      container.append(title);
    }
    const content = document.createElement("div");
    content.className = "rtichoke-report__component-content";
    content.append(renderStandaloneComponentContent(component.spec));
    container.append(content);
    root.append(container);
  }
  return root;
}

function renderReportV1_1(
  spec: ReportSpecV1_1,
  options: Required<ReportRenderOptions>,
): HTMLElement {
  if (!Value.Check(ReportSpecV1_1Schema, spec)) {
    throw new Error("Invalid ReportSpec");
  }
  assertReportReferentialIntegrity(spec);

  const instanceId = ++reportInstanceCounter;
  const hasTitle = Boolean(spec.title);
  const usedDomIds = new Set<string>();

  let activeHeuristicPair: HeuristicPairKey | undefined =
    spec.heuristics?.active;
  const availableHeuristics: HeuristicPairKey[] =
    spec.heuristics?.available ?? [];
  const initialActiveHeuristic = spec.heuristics?.active;

  const root = document.createElement("article");
  root.className = "rtichoke-report";

  if (spec.title) {
    const header = document.createElement("header");
    header.className = "rtichoke-report__header";
    const title = document.createElement("h1");
    title.className = "rtichoke-report__title";
    title.textContent = spec.title;
    header.append(title);
    root.append(header);
  }

  // Pre-calculate DOM IDs for sections and groups to generate navigation
  interface NavGroup {
    rawId: string;
    title: string;
    domId: string;
  }
  interface NavSection {
    rawId: string;
    title: string;
    domId: string;
    groups: NavGroup[];
  }

  const navSections: NavSection[] = [];
  let totalNavigableTargets = 0;

  for (const section of spec.sections) {
    const secDomId = generateUniqueDomId(section.id, usedDomIds);
    totalNavigableTargets++;
    const navGroups: NavGroup[] = [];

    for (const item of section.items) {
      if (item.type === "group") {
        const grpDomId = generateUniqueDomId(item.id, usedDomIds);
        totalNavigableTargets++;
        navGroups.push({
          rawId: item.id,
          title: item.title,
          domId: grpDomId,
        });
      }
    }

    navSections.push({
      rawId: section.id,
      title: section.title,
      domId: secDomId,
      groups: navGroups,
    });
  }

  // Render navigation if there is more than 1 navigable target
  if (totalNavigableTargets > 1) {
    const nav = document.createElement("nav");
    nav.className = "rtichoke-report__nav";
    nav.setAttribute("aria-label", "Report sections");

    const navList = document.createElement("ul");
    navList.className = "rtichoke-report__nav-list";

    for (const sec of navSections) {
      const navItem = document.createElement("li");
      navItem.className = "rtichoke-report__nav-item";

      const navLink = document.createElement("a");
      navLink.className = "rtichoke-report__nav-link";
      navLink.href = `#${sec.domId}`;
      navLink.textContent = sec.title;
      navItem.append(navLink);

      if (sec.groups.length > 0) {
        const subList = document.createElement("ul");
        subList.className = "rtichoke-report__nav-sublist";

        for (const grp of sec.groups) {
          const subItem = document.createElement("li");
          subItem.className = "rtichoke-report__nav-subitem";

          const subLink = document.createElement("a");
          subLink.className = "rtichoke-report__nav-link";
          subLink.href = `#${grp.domId}`;
          subLink.textContent = grp.title;
          subItem.append(subLink);

          subList.append(subItem);
        }
        navItem.append(subList);
      }

      navList.append(navItem);
    }

    nav.append(navList);
    root.append(nav);
  }

  // Map of component DOM elements for scoped updates when heuristics change
  const componentRegistry = new Map<
    string,
    {
      spec: StandaloneCanonicalSpec;
      contentEl: HTMLElement;
    }
  >();

  // Function to render / re-render content for a component given current active heuristic
  const updateComponentContent = (
    spec: StandaloneCanonicalSpec,
    contentEl: HTMLElement,
  ) => {
    // Audit existing rendered component DOM before replacing to preserve slider/horizon selection if present
    let currentHorizonVal: number | undefined;
    const existingSlider = contentEl.querySelector<HTMLInputElement>(
      ".rtichoke-operating-point-slider",
    );
    if (existingSlider) {
      const parsedVal = Number(existingSlider.value);
      if (Number.isFinite(parsedVal)) {
        currentHorizonVal = parsedVal;
      }
    }

    contentEl.replaceChildren();

    if (!activeHeuristicPair) {
      contentEl.append(renderStandaloneComponentContent(spec));
      return;
    }

    const { resolvedSpec, isUnavailable } = resolveActiveSpecForComponent(
      spec,
      activeHeuristicPair,
    );

    if (isUnavailable || !resolvedSpec) {
      contentEl.append(renderUnavailablePlaceholder(activeHeuristicPair));
    } else {
      const renderedNode = renderStandaloneComponentContent(resolvedSpec);
      // If a horizon/step slider exists in the newly rendered node and we had a previous slider position, re-apply it
      if (currentHorizonVal !== undefined) {
        const newSlider = renderedNode.querySelector<HTMLInputElement>(
          ".rtichoke-operating-point-slider",
        );
        if (newSlider) {
          const maxVal = Number(newSlider.max) || 0;
          const targetVal = Math.min(Math.max(0, currentHorizonVal), maxVal);
          if (String(targetVal) !== newSlider.value) {
            newSlider.value = String(targetVal);
            newSlider.dispatchEvent(new Event("input"));
          }
        }
      }
      contentEl.append(renderedNode);
    }
  };

  // Render Heuristic Radio Controls if heuristics are defined
  let syncRadioControlsUI: (() => void) | undefined;

  if (spec.heuristics && activeHeuristicPair) {
    const controlsContainer = document.createElement("section");
    controlsContainer.className = "rtichoke-report__heuristics-controls";
    controlsContainer.setAttribute(
      "aria-label",
      "Analysis Heuristic Controls",
    );

    const titleEl = document.createElement("div");
    titleEl.className = "rtichoke-report__heuristics-title";
    titleEl.textContent = "Analysis Heuristic Controls";

    const groupsRow = document.createElement("div");
    groupsRow.className = "rtichoke-report__heuristics-row";

    // Censoring Fieldset
    const censFieldset = document.createElement("fieldset");
    censFieldset.className = "rtichoke-report__heuristics-fieldset";
    const censLegend = document.createElement("legend");
    censLegend.className = "rtichoke-report__heuristics-legend";
    censLegend.textContent = "Censoring:";
    censFieldset.append(censLegend);

    const censOptionsDiv = document.createElement("div");
    censOptionsDiv.className = "rtichoke-report__heuristics-options";
    censFieldset.append(censOptionsDiv);

    // Competing Events Fieldset
    const compFieldset = document.createElement("fieldset");
    compFieldset.className = "rtichoke-report__heuristics-fieldset";
    const compLegend = document.createElement("legend");
    compLegend.className = "rtichoke-report__heuristics-legend";
    compLegend.textContent = "Competing events:";
    compFieldset.append(compLegend);

    const compOptionsDiv = document.createElement("div");
    compOptionsDiv.className = "rtichoke-report__heuristics-options";
    compFieldset.append(compOptionsDiv);

    groupsRow.append(censFieldset, compFieldset);
    controlsContainer.append(titleEl, groupsRow);
    root.append(controlsContainer);

    // Dynamic UI Synchronization function
    syncRadioControlsUI = () => {
      if (!activeHeuristicPair) return;
      const currentParsed = parseHeuristicPairKey(activeHeuristicPair);

      // 1. Build Censoring Radio Options
      censOptionsDiv.replaceChildren();
      for (const censVal of CENSORING_OPTIONS) {
        // Check if censVal is compatible with AT LEAST ONE available competing option
        const isCensAvailable = availableHeuristics.some(
          (k) => parseHeuristicPairKey(k).censoring === censVal,
        );

        const label = document.createElement("label");
        label.className = "rtichoke-report__heuristics-option";
        if (!isCensAvailable) {
          label.classList.add("rtichoke-report__heuristics-option--disabled");
        }

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `rtichoke-report-${instanceId}-censoring`;
        radio.value = censVal;
        radio.checked = currentParsed.censoring === censVal;
        radio.disabled = !isCensAvailable;

        radio.addEventListener("change", () => {
          if (radio.checked) {
            onHeuristicSelectionChange(censVal, currentParsed.competing);
          }
        });

        const span = document.createElement("span");
        span.textContent = CENSORING_HEURISTIC_LABELS[censVal] ?? censVal;

        label.append(radio, span);
        censOptionsDiv.append(label);
      }

      // 2. Build Competing Events Radio Options
      compOptionsDiv.replaceChildren();
      for (const compVal of COMPETING_OPTIONS) {
        // Check if compVal is compatible with CURRENT selected censoring
        const candidateKey = makeHeuristicPairKey(
          currentParsed.censoring,
          compVal,
        );
        const isCompAvailable = availableHeuristics.includes(candidateKey);

        const label = document.createElement("label");
        label.className = "rtichoke-report__heuristics-option";
        if (!isCompAvailable) {
          label.classList.add("rtichoke-report__heuristics-option--disabled");
        }

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `rtichoke-report-${instanceId}-competing`;
        radio.value = compVal;
        radio.checked = currentParsed.competing === compVal;
        radio.disabled = !isCompAvailable;

        radio.addEventListener("change", () => {
          if (radio.checked) {
            onHeuristicSelectionChange(currentParsed.censoring, compVal);
          }
        });

        const span = document.createElement("span");
        span.textContent = COMPETING_HEURISTIC_LABELS[compVal] ?? compVal;

        label.append(radio, span);
        compOptionsDiv.append(label);
      }
    };

    const onHeuristicSelectionChange = (
      targetCensoring: string,
      targetCompeting: string,
    ) => {
      const resolvedPair = resolveNearestCompatiblePair(
        targetCensoring,
        targetCompeting,
        availableHeuristics,
        initialActiveHeuristic,
      );

      if (resolvedPair === activeHeuristicPair) {
        syncRadioControlsUI?.();
        return;
      }

      activeHeuristicPair = resolvedPair;
      syncRadioControlsUI?.();

      // Scoped component updates
      for (const { spec: compSpec, contentEl } of componentRegistry.values()) {
        updateComponentContent(compSpec, contentEl);
      }
    };

    syncRadioControlsUI();
  }

  // Heading depth resolution
  const sectionHeadingTag = hasTitle ? "h2" : "h1";
  const groupHeadingTag = hasTitle ? "h3" : "h2";
  const directCompHeadingTag = hasTitle ? "h3" : "h2";
  const groupCompHeadingTag = hasTitle ? "h4" : "h3";

  const renderComponent = (
    comp: ReportComponentV1_1,
    headingTag: string,
  ): HTMLElement => {
    const container = document.createElement("section");
    container.className = "rtichoke-report__component";
    container.dataset.componentId = comp.id;

    if (comp.title) {
      const compHeadingDomId = generateUniqueDomId(
        `heading-${comp.id}`,
        usedDomIds,
      );
      const titleEl = document.createElement(headingTag);
      titleEl.className = "rtichoke-report__component-title";
      titleEl.id = compHeadingDomId;
      titleEl.textContent = comp.title;
      container.setAttribute("aria-labelledby", compHeadingDomId);
      container.append(titleEl);
    }

    const content = document.createElement("div");
    content.className = "rtichoke-report__component-content";
    componentRegistry.set(comp.id, { spec: comp.spec, contentEl: content });
    updateComponentContent(comp.spec, content);

    container.append(content);
    return container;
  };

  const renderGroup = (
    item: ReportGroup,
    grpNav: NavGroup,
    sectionPanelTabId?: string,
  ): HTMLElement => {
    const grpSection = document.createElement("section");
    grpSection.className = "rtichoke-report__group";
    grpSection.id = grpNav.domId;
    grpSection.dataset.groupId = item.id;

    const grpHeadingDomId = generateUniqueDomId(
      `heading-${item.id}`,
      usedDomIds,
    );
    const grpHeading = document.createElement(groupHeadingTag);
    grpHeading.className = "rtichoke-report__group-title";
    if (sectionPanelTabId) {
      grpHeading.classList.add("rtichoke-report__group-title--tab-panel");
    }
    grpHeading.id = grpHeadingDomId;
    grpHeading.textContent = item.title;
    grpSection.setAttribute(
      "aria-labelledby",
      sectionPanelTabId ?? grpHeadingDomId,
    );
    grpSection.append(grpHeading);

    if (options.groupPresentation === "tabs") {
      const tablist = document.createElement("div");
      tablist.className = "rtichoke-report__tablist";
      tablist.setAttribute("role", "tablist");
      tablist.setAttribute("aria-labelledby", grpHeadingDomId);

      const tabs: HTMLButtonElement[] = [];
      const panels: HTMLElement[] = [];

      item.components.forEach((comp, compIdx) => {
        const tabDomId = generateUniqueDomId(
          `tab-${item.id}-${comp.id}`,
          usedDomIds,
        );
        const panelDomId = generateUniqueDomId(
          `panel-${item.id}-${comp.id}`,
          usedDomIds,
        );

        const tab = document.createElement("button");
        tab.className = "rtichoke-report__tab";
        tab.type = "button";
        tab.id = tabDomId;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panelDomId);
        tab.setAttribute("aria-selected", compIdx === 0 ? "true" : "false");
        tab.tabIndex = compIdx === 0 ? 0 : -1;
        tab.textContent = comp.title || comp.id;

        const panel = document.createElement("section");
        panel.className =
          "rtichoke-report__component rtichoke-report__tabpanel";
        panel.id = panelDomId;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tabDomId);
        panel.tabIndex = 0;
        panel.dataset.componentId = comp.id;
        panel.hidden = compIdx !== 0;

        const content = document.createElement("div");
        content.className = "rtichoke-report__component-content";
        componentRegistry.set(comp.id, { spec: comp.spec, contentEl: content });
        updateComponentContent(comp.spec, content);

        panel.append(content);

        tabs.push(tab);
        panels.push(panel);
        tablist.append(tab);
      });

      wireTabInteraction(tabs, panels);
      grpSection.append(tablist, ...panels);
    } else {
      for (const comp of item.components) {
        grpSection.append(renderComponent(comp, groupCompHeadingTag));
      }
    }

    return grpSection;
  };

  for (let i = 0; i < spec.sections.length; i++) {
    const sectionSpec = spec.sections[i];
    const secNav = navSections[i];

    const secSection = document.createElement("section");
    secSection.className = "rtichoke-report__section";
    secSection.id = secNav.domId;
    secSection.dataset.sectionId = sectionSpec.id;

    const secHeadingDomId = generateUniqueDomId(
      `heading-${sectionSpec.id}`,
      usedDomIds,
    );
    const secHeading = document.createElement(sectionHeadingTag);
    secHeading.className = "rtichoke-report__section-title";
    secHeading.id = secHeadingDomId;
    secHeading.textContent = sectionSpec.title;
    secSection.setAttribute("aria-labelledby", secHeadingDomId);
    secSection.append(secHeading);

    const groups = sectionSpec.items.filter(
      (item): item is ReportGroup => item.type === "group",
    );
    const useSectionGroupTabs =
      options.sectionGroupPresentation === "tabs" && groups.length > 1;
    let groupIndex = 0;
    let renderedSectionGroupTabs = false;
    let itemIndex = 0;
    while (itemIndex < sectionSpec.items.length) {
      const item = sectionSpec.items[itemIndex];

      if (item.type === "component") {
        let runEnd = itemIndex;
        while (
          runEnd < sectionSpec.items.length &&
          sectionSpec.items[runEnd].type === "component"
        ) {
          runEnd++;
        }
        const compRun = sectionSpec.items.slice(
          itemIndex,
          runEnd,
        ) as ReportComponentV1_1[];
        const useComponentTabs =
          options.sectionComponentPresentation === "tabs" && compRun.length > 1;

        if (useComponentTabs) {
          const tablist = document.createElement("div");
          tablist.className = "rtichoke-report__tablist";
          tablist.setAttribute("role", "tablist");
          tablist.setAttribute("aria-labelledby", secHeadingDomId);

          const tabs: HTMLButtonElement[] = [];
          const panels: HTMLElement[] = [];

          compRun.forEach((comp, compIdx) => {
            const tabDomId = generateUniqueDomId(
              `tab-${sectionSpec.id}-${comp.id}`,
              usedDomIds,
            );
            const panelDomId = generateUniqueDomId(
              `panel-${sectionSpec.id}-${comp.id}`,
              usedDomIds,
            );

            const tab = document.createElement("button");
            tab.className = "rtichoke-report__tab";
            tab.type = "button";
            tab.id = tabDomId;
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-controls", panelDomId);
            tab.setAttribute("aria-selected", compIdx === 0 ? "true" : "false");
            tab.tabIndex = compIdx === 0 ? 0 : -1;
            tab.textContent = comp.title || comp.id;

            const panel = document.createElement("section");
            panel.className =
              "rtichoke-report__component rtichoke-report__tabpanel";
            panel.id = panelDomId;
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", tabDomId);
            panel.tabIndex = 0;
            panel.dataset.componentId = comp.id;
            panel.hidden = compIdx !== 0;

            const content = document.createElement("div");
            content.className = "rtichoke-report__component-content";
            componentRegistry.set(comp.id, { spec: comp.spec, contentEl: content });
            updateComponentContent(comp.spec, content);

            panel.append(content);

            tabs.push(tab);
            panels.push(panel);
            tablist.append(tab);
          });

          wireTabInteraction(tabs, panels);
          secSection.append(tablist, ...panels);
          itemIndex = runEnd;
        } else {
          secSection.append(renderComponent(item, directCompHeadingTag));
          itemIndex++;
        }
      } else if (item.type === "group") {
        if (useSectionGroupTabs) {
          if (!renderedSectionGroupTabs) {
            renderedSectionGroupTabs = true;
            const tablist = document.createElement("div");
            tablist.className =
              "rtichoke-report__tablist rtichoke-report__section-group-tablist";
            tablist.setAttribute("role", "tablist");
            tablist.setAttribute("aria-labelledby", secHeadingDomId);

            const tabs: HTMLButtonElement[] = [];
            const panels: HTMLElement[] = [];
            groups.forEach((group, tabIndex) => {
              const groupNav = secNav.groups[tabIndex];
              const tabDomId = generateUniqueDomId(
                `section-group-tab-${sectionSpec.id}-${group.id}`,
                usedDomIds,
              );

              const tab = document.createElement("button");
              tab.className = "rtichoke-report__tab";
              tab.type = "button";
              tab.id = tabDomId;
              tab.setAttribute("role", "tab");
              tab.setAttribute("aria-controls", groupNav.domId);
              tab.setAttribute("aria-selected", tabIndex === 0 ? "true" : "false");
              tab.tabIndex = tabIndex === 0 ? 0 : -1;
              tab.textContent = group.title;

              const panel = renderGroup(group, groupNav, tabDomId);
              panel.classList.add("rtichoke-report__tabpanel");
              panel.setAttribute("role", "tabpanel");
              panel.setAttribute("aria-labelledby", tabDomId);
              panel.tabIndex = 0;
              panel.hidden = tabIndex !== 0;

              tabs.push(tab);
              panels.push(panel);
              tablist.append(tab);
            });

            wireTabInteraction(tabs, panels);
            secSection.append(tablist, ...panels);
          }
        } else {
          secSection.append(renderGroup(item, secNav.groups[groupIndex++]));
        }
        itemIndex++;
      }
    }

    root.append(secSection);
  }

  return root;
}

export interface ReportRenderOptions {
  groupPresentation?: "stacked" | "tabs";
  sectionGroupPresentation?: "stacked" | "tabs";
  sectionComponentPresentation?: "stacked" | "tabs";
}

/** Render a ReportSpec document (v1.0 flat or v1.1 structured). */
export function renderReport(
  spec: ReportSpec,
  options?: ReportRenderOptions,
): HTMLElement {
  if (!spec || typeof spec !== "object") {
    throw new Error("Invalid ReportSpec");
  }

  const groupPresentation = options?.groupPresentation ?? "stacked";
  const sectionGroupPresentation =
    options?.sectionGroupPresentation ?? "stacked";
  const sectionComponentPresentation =
    options?.sectionComponentPresentation ?? "stacked";
  if (
    options !== undefined &&
    (typeof options !== "object" ||
      options === null ||
      (options.groupPresentation !== undefined &&
        options.groupPresentation !== "stacked" &&
        options.groupPresentation !== "tabs"))
  ) {
    throw new Error(
      "Invalid render options: groupPresentation must be 'stacked' or 'tabs'",
    );
  }
  if (
    options !== undefined &&
    options.sectionGroupPresentation !== undefined &&
    options.sectionGroupPresentation !== "stacked" &&
    options.sectionGroupPresentation !== "tabs"
  ) {
    throw new Error(
      "Invalid render options: sectionGroupPresentation must be 'stacked' or 'tabs'",
    );
  }
  if (
    options !== undefined &&
    options.sectionComponentPresentation !== undefined &&
    options.sectionComponentPresentation !== "stacked" &&
    options.sectionComponentPresentation !== "tabs"
  ) {
    throw new Error(
      "Invalid render options: sectionComponentPresentation must be 'stacked' or 'tabs'",
    );
  }

  if (spec.schemaVersion === "1.0") {
    return renderReportV1_0(spec);
  }
  if (spec.schemaVersion === "1.1") {
    return renderReportV1_1(spec, {
      groupPresentation,
      sectionGroupPresentation,
      sectionComponentPresentation,
    });
  }
  throw new Error("Invalid ReportSpec");
}
