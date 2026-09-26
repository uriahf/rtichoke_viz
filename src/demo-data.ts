import type { CalibrationV2Spec } from "./index.js";

export const MIN_DEMO_POPULATION_SIZE = 500;

export function scaleCalibrationForDemo(
  spec: CalibrationV2Spec,
  factor = 10,
): CalibrationV2Spec {
  const scaledDistribution = spec.distribution
    ? spec.distribution.map((bin) => ({
        ...bin,
        count: bin.count * factor,
      }))
    : undefined;

  const scaledData = spec.data.map((datum) => {
    if (datum.method !== "discrete" || !scaledDistribution) {
      return { ...datum };
    }

    const matchingBin = scaledDistribution.find(
      (bin) => bin.seriesId === datum.seriesId && bin.midpoint === datum.predicted,
    );

    if (!matchingBin) {
      return { ...datum };
    }

    const total = matchingBin.count;
    const events = Math.round(datum.observed * total);

    return {
      ...datum,
      total,
      events,
    };
  });

  return {
    ...spec,
    data: scaledData,
    ...(scaledDistribution ? { distribution: scaledDistribution } : {}),
  };
}
