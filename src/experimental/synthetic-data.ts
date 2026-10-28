/**
 * Synthetic Longitudinal Continuous Outcome Dataset Generator (POC)
 *
 * Generates deterministic subject-level longitudinal continuous outcome trajectories
 * for 600 subjects across 36 steps (0-35) with bounded values in [0, 1].
 */

export interface SubjectTrajectory {
  subjectId: number;
  /** Outcomes at steps 0..35 */
  outcomes: number[];
  /** Last observed step for Scenario B (0 <= censoringStep <= 35) */
  censoringStep: number;
}

export interface SyntheticDataset {
  subjects: SubjectTrajectory[];
  nSubjects: number;
  numSteps: number;
}

/**
 * Pseudo-random number generator (Mulberry32) for deterministic reproducible data generation.
 */
function createRandomGenerator(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for standard normal random variables.
 */
function createNormalGenerator(rand: () => number) {
  return (mean = 0, std = 1) => {
    let u1 = rand();
    let u2 = rand();
    while (u1 === 0) u1 = rand();
    while (u2 === 0) u2 = rand();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * std;
  };
}

/**
 * Generate synthetic longitudinal continuous outcome dataset.
 * Seed is fixed for exact reproducibility.
 */
export function generateSyntheticContinuousDataset(seed = 42): SyntheticDataset {
  const rand = createRandomGenerator(seed);
  const randNorm = createNormalGenerator(rand);

  const nSubjects = 600;
  const numSteps = 36; // steps 0 to 35

  // Assign subject cluster membership (e.g., 55% shift to high mode, 45% remain in low mode)
  const clusters: ("shifter" | "stayer")[] = [];
  for (let i = 0; i < nSubjects; i++) {
    clusters.push(rand() < 0.55 ? "shifter" : "stayer");
  }

  // Assign per-subject random effect/trait
  const subjectTraits: number[] = [];
  for (let i = 0; i < nSubjects; i++) {
    subjectTraits.push(randNorm(0, 0.08));
  }

  // Pre-calculate monotone censoring step for Scenario B
  // Target: all 600 observed at step 0, progressively censored down to ~390 observed at step 35 (~210 censored).
  // Prob of being censored at each step s from 1 to 35:
  const censoringSteps: number[] = [];
  for (let i = 0; i < nSubjects; i++) {
    let lastObserved = 35;
    for (let s = 1; s <= 35; s++) {
      // Risk of censoring between step s-1 and s
      // Gradual hazard so survival at step 35 is ~390/600 = 0.65
      const hazard = 0.0088 + 0.00015 * s;
      if (rand() < hazard) {
        lastObserved = s - 1;
        break;
      }
    }
    censoringSteps.push(lastObserved);
  }

  const subjects: SubjectTrajectory[] = [];

  for (let i = 0; i < nSubjects; i++) {
    const isShifter = clusters[i] === "shifter";
    const trait = subjectTraits[i];
    const outcomes: number[] = [];

    for (let s = 0; s < numSteps; s++) {
      const progress = s / 35; // 0 to 1

      // Initial unimodal peak around 0.25 at step 0
      let val: number;
      if (isShifter) {
        // Mode transitions smoothly from 0.25 at s=0 to 0.78 at s=35
        const mean = 0.25 + 0.53 * Math.pow(progress, 1.4);
        const std = 0.07 + 0.04 * Math.sin(progress * Math.PI);
        val = randNorm(mean, std) + trait * (1 + progress);
      } else {
        // Stayer mode remains centered near 0.22, with increasing dispersion
        const mean = 0.25 - 0.05 * progress;
        const std = 0.07 + 0.06 * progress;
        val = randNorm(mean, std) + trait;
      }

      // Add a small step-dependent noise
      val += randNorm(0, 0.02);

      // Clamp strictly to [0, 1]
      val = Math.max(0, Math.min(1, val));
      outcomes.push(val);
    }

    subjects.push({
      subjectId: i + 1,
      outcomes,
      censoringStep: censoringSteps[i],
    });
  }

  return {
    subjects,
    nSubjects,
    numSteps,
  };
}
