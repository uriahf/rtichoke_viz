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
    });

    const horizonCount = decisionCurve.series.filter((series) => series.horizon !== undefined).length;
    if (horizonCount !== 0 && horizonCount !== decisionCurve.series.length) {
      throw new Error("decision curve cannot mix static and horizon-qualified series");
    }
    const isTimeDependent = horizonCount > 0;
    const horizons = [...new Set(decisionCurve.series.map((series) => series.horizon).filter((horizon): horizon is number => horizon !== undefined))];
    const seriesCoverage = new Set<string>();
    decisionCurve.series.forEach((series, index) => {
      if (series.id !== `series-${index + 1}`) throw new Error(`decision curve series ids must be ordinal: expected series-${index + 1}`);
      const evaluation = decisionCurve.evaluations.find((candidate) => candidate.id === series.evaluationId)!;
      const expectedDisplay = evaluation.model ?? evaluation.population;
      const expectedRole = evaluation.model === undefined ? "population" : "model";
      if (series.display.label !== expectedDisplay || series.display.group !== expectedDisplay || series.display.role !== expectedRole) {
        throw new Error("decision curve display must follow evaluation semantics");
      }
      const coverageKey = `${series.evaluationId}\u0000${series.horizon ?? "static"}`;
      if (seriesCoverage.has(coverageKey)) throw new Error(`duplicate decision curve evaluation-horizon series: ${series.evaluationId}`);
      seriesCoverage.add(coverageKey);
    });
    if (isTimeDependent) {
      const complete = decisionCurve.evaluations.every((evaluation) =>
        horizons.every((horizon) => seriesCoverage.has(`${evaluation.id}\u0000${horizon}`)),
      );
      if (!complete || decisionCurve.series.length !== decisionCurve.evaluations.length * horizons.length) {
        throw new Error("decision curve requires exactly one series per evaluation and horizon");
      }
    } else if (decisionCurve.series.length !== decisionCurve.evaluations.length ||
      decisionCurve.evaluations.some((evaluation) => !seriesCoverage.has(`${evaluation.id}\u0000static`))) {
      throw new Error("decision curve requires exactly one series per evaluation");
    }

    const treatNone = references.filter((reference) => "benchmark" in reference && reference.benchmark === "treat_none");
    if (treatNone.length !== 1) throw new Error("decision curve requires exactly one Treat None reference");

    const treatAll = references.filter(
      (reference): reference is Extract<DecisionCurveV2Reference, { benchmark: "treat_all" }> =>
        "benchmark" in reference && reference.benchmark === "treat_all",
    );
    const treatAllOwners = new Set<string>();
    for (const reference of treatAll) {
      if (isTimeDependent && reference.scope !== "population_horizon") {
        throw new Error("time-dependent decision curve Treat All must use population_horizon scope");
      }
      if (!isTimeDependent && reference.scope !== "population") {
        throw new Error("static decision curve Treat All must use population scope");
      }
      const owner = reference.scope === "population_horizon"
        ? `${reference.population}\u0000${reference.horizon}`
        : reference.population;
      if (treatAllOwners.has(owner)) throw new Error(`duplicate Treat All owner: ${reference.population}`);
      treatAllOwners.add(owner);
    }
    const expectedTreatAllOwners = isTimeDependent
      ? [...populations].flatMap((population) => horizons.map((horizon) => `${population}\u0000${horizon}`))
      : [...populations];
    if (treatAllOwners.size !== expectedTreatAllOwners.length || expectedTreatAllOwners.some((owner) => !treatAllOwners.has(owner))) {
      throw new Error(isTimeDependent
        ? "decision curve requires exactly one Treat All reference per population and horizon"
        : "decision curve requires exactly one Treat All reference per population");
    }
  }

  if (spec.type === "interventions_avoided") {
    const interventionsAvoided = spec as InterventionsAvoidedV2Spec;
    const references = interventionsAvoided.references as InterventionsAvoidedV2Reference[];
    interventionsAvoided.evaluations.forEach((evaluation, index) => {
      const expectedId = `evaluation-${index + 1}`;
      if (evaluation.id !== expectedId) throw new Error(`interventions avoided evaluation ids must be ordinal: expected ${expectedId}`);
    });

    const horizonCount = interventionsAvoided.series.filter((series) => series.horizon !== undefined).length;
    if (horizonCount !== 0 && horizonCount !== interventionsAvoided.series.length) {
      throw new Error("interventions avoided cannot mix static and horizon-qualified series");
    }
    const isTimeDependent = horizonCount > 0;
    const horizons = [...new Set(interventionsAvoided.series.map((series) => series.horizon).filter((horizon): horizon is number => horizon !== undefined))];
    const seriesCoverage = new Set<string>();
    interventionsAvoided.series.forEach((series, index) => {
      if (series.id !== `series-${index + 1}`) throw new Error(`interventions avoided series ids must be ordinal: expected series-${index + 1}`);
      const evaluation = interventionsAvoided.evaluations.find((candidate) => candidate.id === series.evaluationId);
      if (!evaluation) throw new Error(`unknown evaluation id: ${series.evaluationId}`);
      const expectedDisplay = evaluation.model ?? evaluation.population;
      const expectedRole = evaluation.model === undefined ? "population" : "model";
      if (series.display.label !== expectedDisplay || series.display.group !== expectedDisplay || series.display.role !== expectedRole) {
        throw new Error("interventions avoided display must follow evaluation semantics");
      }
      const coverageKey = `${series.evaluationId}\u0000${series.horizon ?? "static"}`;
      if (seriesCoverage.has(coverageKey)) throw new Error(`duplicate interventions avoided evaluation-horizon series: ${series.evaluationId}`);
      seriesCoverage.add(coverageKey);
    });
    if (isTimeDependent) {
      const complete = interventionsAvoided.evaluations.every((evaluation) =>
        horizons.every((horizon) => seriesCoverage.has(`${evaluation.id}\u0000${horizon}`)),
      );
      if (!complete || interventionsAvoided.series.length !== interventionsAvoided.evaluations.length * horizons.length) {
        throw new Error("interventions avoided requires exactly one series per evaluation and horizon");
      }
    } else if (interventionsAvoided.series.length !== interventionsAvoided.evaluations.length ||
      interventionsAvoided.evaluations.some((evaluation) => !seriesCoverage.has(`${evaluation.id}\u0000static`))) {
      throw new Error("interventions avoided requires exactly one series per evaluation");
    }

    const treatAll = references.filter(
      (reference): reference is Extract<InterventionsAvoidedV2Reference, { benchmark: "treat_all" }> =>
        "benchmark" in reference && reference.benchmark === "treat_all",
    );
    if (treatAll.length !== 1) throw new Error("interventions avoided requires exactly one Treat All reference");
    if (treatAll[0].scope !== "global" || treatAll[0].type !== "horizontal" || treatAll[0].value !== 0) {
      throw new Error("interventions avoided Treat All must be the global zero reference");
    }

    const treatNone = references.filter(
      (reference): reference is Extract<InterventionsAvoidedV2Reference, { benchmark: "treat_none" }> =>
        "benchmark" in reference && reference.benchmark === "treat_none",
    );
    const treatNoneOwners = new Set<string>();
    for (const reference of treatNone) {
      if (isTimeDependent && reference.scope !== "population_horizon") {
        throw new Error("time-dependent interventions avoided Treat None must use population_horizon scope");
      }
      if (!isTimeDependent && reference.scope !== "population") {
        throw new Error("static interventions avoided Treat None must use population scope");
      }
      const owner = reference.scope === "population_horizon"
        ? `${reference.population}\u0000${reference.horizon}`
        : reference.population;
      if (treatNoneOwners.has(owner)) throw new Error(`duplicate Treat None owner: ${reference.population}`);
      treatNoneOwners.add(owner);
    }
    const expectedTreatNoneOwners = isTimeDependent
      ? [...populations].flatMap((population) => horizons.map((horizon) => `${population}\u0000${horizon}`))
      : [...populations];
    if (treatNoneOwners.size !== expectedTreatNoneOwners.length || expectedTreatNoneOwners.some((owner) => !treatNoneOwners.has(owner))) {
      throw new Error(isTimeDependent
        ? "interventions avoided requires exactly one Treat None reference per population and horizon"
        : "interventions avoided requires exactly one Treat None reference per population");
    }
  }
}
