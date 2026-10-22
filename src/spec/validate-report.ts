import type {
  ReportComponent,
  ReportComponentV1_1,
  ReportSpec,
} from "./report.js";
import type { HeuristicPairKey } from "./v2/heuristics.js";

const VALID_HEURISTIC_PAIR_KEYS = new Set<HeuristicPairKey>([
  "excluded:excluded",
  "excluded:adjusted_as_censored",
  "excluded:adjusted_as_negative",
  "excluded:adjusted_as_composite",
  "adjusted:excluded",
  "adjusted:adjusted_as_censored",
  "adjusted:adjusted_as_negative",
  "adjusted:adjusted_as_composite",
]);

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

  // Validate report-level heuristics if present
  let reportAvailableHeuristics: Set<string> | undefined;
  if (spec.heuristics) {
    const { active, available } = spec.heuristics;
    if (!available || available.length === 0) {
      throw new Error("heuristics.available must be non-empty");
    }

    const availableSet = new Set<string>();
    for (const key of available) {
      if (!VALID_HEURISTIC_PAIR_KEYS.has(key as HeuristicPairKey)) {
        throw new Error(`invalid heuristic pair key: '${key}'`);
      }
      if (availableSet.has(key)) {
        throw new Error(`duplicate heuristic pair key in available: '${key}'`);
      }
      availableSet.add(key);
    }

    if (!VALID_HEURISTIC_PAIR_KEYS.has(active as HeuristicPairKey)) {
      throw new Error(`invalid active heuristic pair key: '${active}'`);
    }

    if (!availableSet.has(active)) {
      throw new Error(
        `active heuristic '${active}' must be present in available heuristics`,
      );
    }

    reportAvailableHeuristics = availableSet;
  }

  const validateComponentVariants = (
    component: ReportComponent | ReportComponentV1_1,
  ): void => {
    assertUniqueComponent(component);
    if (
      reportAvailableHeuristics &&
      component.spec.type === "outcome_distribution" &&
      component.spec.variants
    ) {
      for (const variantKey of Object.keys(component.spec.variants)) {
        if (!reportAvailableHeuristics.has(variantKey)) {
          throw new Error(
            `component '${component.id}' variant '${variantKey}' is not declared in report heuristics.available`,
          );
        }
      }
    }
  };

  const sectionIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const section of spec.sections) {
    if (sectionIds.has(section.id)) {
      throw new Error(`duplicate section id: ${section.id}`);
    }
    sectionIds.add(section.id);

    for (const item of section.items) {
      if (item.type === "component") {
        validateComponentVariants(item);
        continue;
      }
      if (groupIds.has(item.id)) {
        throw new Error(`duplicate group id: ${item.id}`);
      }
      groupIds.add(item.id);
      for (const component of item.components) {
        validateComponentVariants(component);
      }
    }
  }
}
