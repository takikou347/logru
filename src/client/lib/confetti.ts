/**
 * 誕生日・記念日の今日のページで降らせる紙吹雪の、画面に依らない部分。F-49、0098
 *
 * 粒の初期値と動き、同じ日に 2 回目を出さない印(端末の localStorage)を持つ。
 * 描くのは components/parts/Confetti.tsx。
 */

/** 降る長さ(ms)。1.5 秒ほど */
export const CONFETTI_MS = 1500;
/** 粒の数 */
export const CONFETTI_COUNT = 70;

const KEY_PREFIX = "logru:confetti:";

export type Particle = {
  /** 0 〜 1。画面の幅に対する位置 */
  x: number;
  /** 0 〜 1。画面の高さに対する位置。上の外から始める */
  y: number;
  vx: number;
  vy: number;
  /** 粒の大きさ(CSS px) */
  size: number;
  rot: number;
  vrot: number;
  /** 色の番号。色の配列の長さで割った余りを使う */
  color: number;
};

/** 粒を作る。random は 0 以上 1 未満を返す関数(試すときに差し替える) */
export function makeParticles(random: () => number = Math.random, count = CONFETTI_COUNT): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: random(),
    y: -0.05 - random() * 0.25,
    vx: (random() - 0.5) * 0.25,
    vy: 0.55 + random() * 0.55,
    size: 6 + random() * 6,
    rot: random() * Math.PI * 2,
    vrot: (random() - 0.5) * 10,
    color: i,
  }));
}

/** 粒を dt 秒だけ進める。新しい粒を返す */
export function stepParticle(p: Particle, dt: number): Particle {
  return { ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, rot: p.rot + p.vrot * dt };
}

/** 終わり際(最後の 0.3 秒)に薄くする係数。0 〜 1 */
export function fadeAt(elapsedMs: number): number {
  const left = CONFETTI_MS - elapsedMs;
  return Math.max(0, Math.min(1, left / 300));
}

/** 動きを減らす設定か。OS の設定だけ見る(Logru 自身に動きの設定は無い)。haptics.ts と同じ判定 */
export function reducedMotionNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** その日(yyyy-mm-dd)に、もう降らせたか。localStorage が使えなければ false */
export function confettiShown(day: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + day) === "1";
  } catch {
    return false;
  }
}

/** その日に降らせたと覚える。使えなければ何もしない */
export function markConfettiShown(day: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + day, "1");
  } catch {
    // 覚えられなくても祝えればよい
  }
}
