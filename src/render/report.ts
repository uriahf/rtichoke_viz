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
import { renderDecisionCurveV2 } from "./decision-curve.js";
import { renderInterventionsAvoidedV2 } from "./interventions-avoided.js";
import { renderPerformanceTable } from "./performance-table.js";
import { renderSummaryMetrics } from "./summary-metrics.js";
import {
  renderCalibrationV2,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderRocV2,
} from "./v2.js";

function renderStandaloneComponentContent(
  spec: StandaloneCanonicalSpec,
  document: Document = globalThis.document,
): Element {
  switch (spec.type) {
    case "summary_metrics":
      return renderSummaryMetrics(spec, document);
    case "performance_table":
      return renderPerformanceTable(spec, document);
    case "roc":
      return renderRocV2(spec);
    case "calibration":
      return renderCalibrationV2(spec);
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

function renderReportV1_0(spec: ReportSpecV1_0, document: Document): HTMLDivElement {
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
    content.append(renderStandaloneComponentContent(component.spec, document));
    container.append(content);
    root.append(container);
  }
  return root;
}

function renderReportV1_1(
  spec: ReportSpecV1_1,
  options: Required<ReportRenderOptions>,
  document: Document,
): HTMLElement {
  if (!Value.Check(ReportSpecV1_1Schema, spec)) {
    throw new Error("Invalid ReportSpec");
  }
  assertReportReferentialIntegrity(spec);

  const hasTitle = Boolean(spec.title);
  const usedDomIds = new Set<string>();

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
    content.append(renderStandaloneComponentContent(comp.spec, document));
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
        content.append(renderStandaloneComponentContent(comp.spec, document));
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
            content.append(renderStandaloneComponentContent(comp.spec, document));
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
  document: Document = globalThis.document,
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
    return renderReportV1_0(spec, document);
  }
  if (spec.schemaVersion === "1.1") {
    return renderReportV1_1(spec, {
      groupPresentation,
      sectionGroupPresentation,
      sectionComponentPresentation,
    }, document);
  }
  throw new Error("Invalid ReportSpec");
}
