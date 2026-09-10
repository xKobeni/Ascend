import { Random } from "../core/Random";

export interface RecruitmentRoll {
  rank: 1 | 2 | 3;
  seed: number;
}

export const RECRUITMENT_COST = 3;

export class RecruitmentSystem {
  constructor(private readonly random = Random.fromEntropy()) {}

  createRoll(seed = this.random.integer(1, 0x7fff_ffff)): RecruitmentRoll {
    const normalizedSeed = (Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0) || 0x6d2b_79f5;
    const rankRandom = new Random(normalizedSeed ^ 0x9e37_79b9);
    rankRandom.next();
    rankRandom.next();
    rankRandom.next();
    const rankRoll = rankRandom.next();
    return {
      rank: rankRoll < 0.05 ? 3 : rankRoll < 0.28 ? 2 : 1,
      seed: normalizedSeed,
    };
  }
}
