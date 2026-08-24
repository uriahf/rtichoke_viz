import type { ReportSpec } from "./report.js";

/** Report-specific integrity checks beyond structural schema validation. */
export function assertReportReferentialIntegrity(spec: ReportSpec): void {
  const componentIds = new Set<string>();

  for (const component of spec.components) {
    if (componentIds.has(component.id)) {
      throw new Error(`duplicate component id: ${component.id}`);
    }
    componentIds.add(component.id);
  }
}
