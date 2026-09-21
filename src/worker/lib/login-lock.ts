export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;

export type LockState = { count: number; lockedUntil: number | null };

/** 締め出し中なら、解ける時刻を返す */
export function lockedUntil(state: LockState | undefined, now: number): number | null {
  if (!state?.lockedUntil) return null;
  return state.lockedUntil > now ? state.lockedUntil : null;
}

/** 失敗を 1 回数えた後の状態を返す。5 回目で締め出し、数を 0 に戻す */
export function recordFailure(state: LockState | undefined, now: number): LockState & { remaining: number } {
  const expired = state?.lockedUntil != null && state.lockedUntil <= now;
  const count = (expired ? 0 : (state?.count ?? 0)) + 1;
  if (count >= MAX_FAILURES) return { count: 0, lockedUntil: now + LOCK_MS, remaining: 0 };
  return { count, lockedUntil: null, remaining: MAX_FAILURES - count };
}
