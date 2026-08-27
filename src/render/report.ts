import { Value } from "@sinclair/typebox/value";
import type {
  ReportComponentV1_1,
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
import {
  renderCalibrationV2,
  renderGainsV2,
  renderLiftV2,
  renderPrecisionRecallV2,
  renderRocV2,
} from "./v2.js";

function renderStandaloneComponentContent(
  spec: StandaloneCanonicalSpec,
): Element {
  switch (spec.type) {
    case "performance_table":
      return renderPerformanceTable(spec);
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

function renderReportV1_1(spec: ReportSpecV1_1): HTMLElement {
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
  // With title: section h2, group h3, component in group h4, direct component h3
  // Without title: section h1, group h2, component in group h3, direct component h2
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
    content.append(renderStandaloneComponentContent(comp.spec));
    container.append(content);

    return container;
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

    let groupIndex = 0;
    for (const item of sectionSpec.items) {
      if (item.type === "component") {
        secSection.append(renderComponent(item, directCompHeadingTag));
      } else if (item.type === "group") {
        const grpNav = secNav.groups[groupIndex++];
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
        grpHeading.id = grpHeadingDomId;
        grpHeading.textContent = item.title;
        grpSection.setAttribute("aria-labelledby", grpHeadingDomId);
        grpSection.append(grpHeading);

        for (const comp of item.components) {
          grpSection.append(renderComponent(comp, groupCompHeadingTag));
        }

        secSection.append(grpSection);
      }
    }

    root.append(secSection);
  }

  return root;
}

/** Render a ReportSpec document (v1.0 flat or v1.1 structured). */
export function renderReport(spec: ReportSpec): HTMLElement {
  if (!spec || typeof spec !== "object") {
    throw new Error("Invalid ReportSpec");
  }
  if (spec.schemaVersion === "1.0") {
    return renderReportV1_0(spec);
  }
  if (spec.schemaVersion === "1.1") {
    return renderReportV1_1(spec);
  }
  throw new Error("Invalid ReportSpec");
}
