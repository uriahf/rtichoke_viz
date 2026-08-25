import type { RtichokeChartSpecV2 } from "./chart.js";
import type { DecisionCurveV2Reference, DecisionCurveV2Spec } from "./decision-curve.js";
import type { InterventionsAvoidedV2Reference, InterventionsAvoidedV2Spec } from "./interventions-avoided.js";

/** Validate cross-object identity references that JSON Schema cannot express. */
export function assertV2ReferentialIntegrity(spec: RtichokeChartSpecV2): void {
  const evaluationIds = new Set(spec.evaluations.map((evaluation) => evaluation.id));
  const seriesIds = new Set<string>();

  if (evaluationIds.size !== spec.evaluations.length) throw new Error("duplicate evaluation id");
  for (const series of spec.series) {
    if (seriesIds.has(series.id)) throw new Error(`duplicate series id: ${series.id}`);
    seriesIds.add(series.id);
    if (!evaluationIds.has(series.evaluationId)) throw new Error(`unknown evaluation id: ${series.evaluationId}`);
  }
  for (const datum of spec.data) {
    if (!seriesIds.has(datum.seriesId)) throw new Error(`unknown series id: ${datum.seriesId}`);
  }
  if (spec.type === "calibration") {
    for (const datum of spec.distribution ?? []) {
      if (!seriesIds.has(datum.seriesId)) throw new Error(`unknown distribution series id: ${datum.seriesId}`);
    }
  }

  const populations = new Set(spec.evaluations.map((evaluation) => evaluation.population));
  for (const reference of spec.references ?? []) {
    if ((reference.scope === "population" || reference.scope === "population_horizon") && !populations.has(reference.population)) {
      throw new Error(`unknown reference population: ${reference.population}`);
    }
  }

  if (spec.type === "decision_curve") {
    const decisionCurve = spec as DecisionCurveV2Spec;
    const references = decisionCurve.references as DecisionCurveV2Reference[];
    decisionCurve.evaluations.forEach((evaluation, index) => {
      const expectedId = `evaluation-${index + 1}`;
      if (evaluation.id !== expectedId) throw new Error(`decision curve evaluation ids must be ordinal: expected ${expectedId}`);
      const expectedDisplay = evaluation.model ?? evaluation.population;
      const expectedRole = evaluation.model === undefined ? "population" : "model";
      const series = decisionCurve.series[index];
      if (!series || series.id !== `series-${index + 1}` || series.evaluationId !== evaluation.id) {
        throw new Error("decision curve series must map one-to-one in evaluation order");
      }
      if (series.display.label !== expectedDisplay || series.display.group !== expectedDisplay || series.display.role !== expectedRole) {
        throw new Error("decision curve display must follow evaluation semantics");
      }
    });
    if (decisionCurve.series.length !== decisionCurve.evaluations.length) throw new Error("decision curve requires exactly one series per evaluation");

    const treatNone = references.filter((reference) => "benchmark" in reference && reference.benchmark === "treat_none");
    if (treatNone.length !== 1) throw new Error("decision curve requires exactly one Treat None reference");

    const treatAll = references.filter(
      (reference): reference is Extract<DecisionCurveV2Reference, { benchmark: "treat_all" }> =>
        "benchmark" in reference && reference.benchmark === "treat_all",
    );
    const treatAllPopulations = new Set<string>();
    for (const reference of treatAll) {
      if (treatAllPopulations.has(reference.population)) throw new Error(`duplicate Treat All population: ${reference.population}`);
      treatAllPopulations.add(reference.population);
    }
    if (treatAllPopulations.size !== populations.size || [...populations].some((population) => !treatAllPopulations.has(population))) {
      throw new Error("decision curve requires exactly one Treat All reference per population");
    }
  }

  if (spec.type === "interventions_avoided") {
    const interventionsAvoided = spec as InterventionsAvoidedV2Spec;
    const references = interventionsAvoided.references as InterventionsAvoidedV2Reference[];
    interventionsAvoided.evaluations.forEach((evaluation, index) => {
      const expectedId = `evaluation-${index + 1}`;
      if (evaluation.id !== expectedId) throw new Error(`interventions avoided evaluation ids must be ordinal: expected ${expectedId}`);
      const expectedDisplay = evaluation.model ?? evaluation.population;
      const expectedRole = evaluation.model === undefined ? "population" : "model";
      const series = interventionsAvoided.series[index];
      if (!series || series.id !== `series-${index + 1}` || series.evaluationId !== evaluation.id) {
        throw new Error("interventions avoided series must map one-to-one in evaluation order");
      }
      if (series.display.label !== expectedDisplay || series.display.group !== expectedDisplay || series.display.role !== expectedRole) {
        throw new Error("interventions avoided display must follow evaluation semantics");
      }
    });
    if (interventionsAvoided.series.length !== interventionsAvoided.evaluations.length) throw new Error("interventions avoided requires exactly one series per evaluation");

    const treatAll = references.filter((reference) => "benchmark" in reference && reference.benchmark === "treat_all");
    if (treatAll.length !== 1) throw new Error("interventions avoided requires exactly one Treat All reference");
    if (treatAll[0].scope !== "global" || treatAll[0].type !== "horizontal" || treatAll[0].value !== 0) {
      throw new Error("interventions avoided Treat All must be the global zero reference");
    }

    const treatNone = references.filter(
      (reference): reference is Extract<InterventionsAvoidedV2Reference, { benchmark: "treat_none" }> =>
        "benchmark" in reference && reference.benchmark === "treat_none",
    );
    const treatNonePopulations = new Set<string>();
    for (const reference of treatNone) {
      if (treatNonePopulations.has(reference.population)) throw new Error(`duplicate Treat None population: ${reference.population}`);
      treatNonePopulations.add(reference.population);
    }
    if (treatNonePopulations.size !== populations.size || [...populations].some((population) => !treatNonePopulations.has(population))) {
      throw new Error("interventions avoided requires exactly one Treat None reference per population");
    }
  }
}
