// Mixed-room experiments (docs/n4-hard-roles.md, "Later ideas"): each of the panel's later ideas sits behind a
// switch here so playtest sims (tools/sim/) can run every game with it on and off and weigh its cost (time,
// waiting) against its benefit (listening, speaking, fair scores). The sims set them; the game reads them.
// Defaults are the shipped choice once the sims have decided.

export interface MixedExperiments {
  /** 1. The host says a short setup line (Pon's ドロン！) before the stand-in line. */
  standInSetup: boolean;
  /** 2. Stand-in rooms get the once-a-game curveball too, on the host's line. */
  standInCurveball: boolean;
  /** 3. A Gallery player may say their reaction out loud for a small bonus. */
  spokenReaction: boolean;
  /** 4. The recap's waiting check is asked only on the first two mixed recaps of a night. */
  waitCheckFirstTwo: boolean;
  /** 5. Narabete: when the N4 defender's card also moved most, one defence, not two. */
  narabeteFold: boolean;
  /** 6. The curveball pays about a tenth of the game's basic right answer, not a flat +5. */
  scaledCurveball: boolean;
}

export const EXPERIMENTS: MixedExperiments = {
  standInSetup: true,
  standInCurveball: true,
  spokenReaction: true,
  waitCheckFirstTwo: true,
  narabeteFold: true,
  scaledCurveball: true,
};

/** For sims and tests: set some switches, get a function that puts them back. */
export function withExperiments(patch: Partial<MixedExperiments>): () => void {
  const before = { ...EXPERIMENTS };
  Object.assign(EXPERIMENTS, patch);
  return () => Object.assign(EXPERIMENTS, before);
}
