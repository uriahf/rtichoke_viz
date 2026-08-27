import type {
  ReportComponent,
  ReportComponentV1_1,
  ReportSpec,
} from "./report.js";

/** Report-specific integrity checks beyond structural schema validation. */
export function assertReportReferentialIntegrity(spec: ReportSpec): void {
  const componentIds = new Set<string>();

  const assertUniqueComponent = (
    component: ReportComponent | ReportComponentV1_1,
  ): void => {
    if (componentIds.has(component.id)) {
      throw new Error(`duplicate component id: ${component.id}`);
    }
    componentIds.add(component.id);
  };

  if (spec.schemaVersion === "1.0") {
    for (const component of spec.components) assertUniqueComponent(component);
    return;
  }

  const sectionIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const section of spec.sections) {
    if (sectionIds.has(section.id)) {
      throw new Error(`duplicate section id: ${section.id}`);
    }
    sectionIds.add(section.id);

    for (const item of section.items) {
      if (item.type === "component") {
        assertUniqueComponent(item);
        continue;
      }
      if (groupIds.has(item.id)) {
        throw new Error(`duplicate group id: ${item.id}`);
      }
      groupIds.add(item.id);
      for (const component of item.components) {
        assertUniqueComponent(component);
      }
    }
  }
}
