import type { Context } from './host';

export const HIGHSCORE_KEY = 'claudle-jump';

export type HighscoreState = { best: number };

const SCORE_LIMIT = 1e9;

/** Same rules as the Claude Code mod: whole number, 0 <= score < 1e9. */
export function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isInteger(score) && score >= 0 && score < SCORE_LIMIT;
}

export function bestAfter(best: number, score: unknown): number {
  return isValidScore(score) && score > best ? score : best;
}

export function createHighscore(storage: Context['storage']): {
  best(): number;
  record(score: unknown): Promise<boolean>;
} {
  const [store, mutate] = storage.store<HighscoreState>(HIGHSCORE_KEY, { initial: { best: 0 } });
  // A corrupted stored value reads as 0.
  const best = () => (isValidScore(store.best) ? store.best : 0);
  return {
    best,
    async record(score) {
      if (!isValidScore(score) || score <= best()) return false;
      await mutate((draft) => {
        draft.best = score;
      });
      return true;
    },
  };
}
