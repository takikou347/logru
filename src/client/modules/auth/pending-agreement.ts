/**
 * 登録の画面で受けた同意を、メールアドレスを確かめ終えるまで端末に覚えておく。
 *
 * メールで登録した人は、確かめるまで API を使えない。確かめた後に同意の画面をもう一度出すと
 * 同じことを 2 回聞くことになるので、覚えておいた同意をそのとき送る。F-16
 *
 * 同意はメールアドレスと組にして覚える。同じ端末で別の人が入っても、その人の同意として送らない。
 */
import { LEGAL_VERSIONS } from "@shared/legal";

const KEY = "logru-pending-agreement";

type Stored = { email: string; versions: typeof LEGAL_VERSIONS };

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * 登録の画面で同意したことを覚える。
 * @param email 登録に使うメールアドレス
 */
export function rememberAgreement(email: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: normalize(email), versions: LEGAL_VERSIONS } satisfies Stored));
  } catch {
    // 覚えられなければ、後で同意の画面を出す
  }
}

/** 登録に失敗したとき、覚えた同意を消す */
export function forgetAgreement(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 消せなくても、版かアドレスが違えば使われない
  }
}

/**
 * 覚えている同意が、この人のもので、いまの規約の版と同じか。そうなら取り出して消す。
 * 別の人のものなら、消さずに残す。
 * @param email いまログインしている人のメールアドレス
 */
export function takeRememberedAgreement(email: string | null | undefined): boolean {
  if (!email) return false;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    if (!stored || stored.email !== normalize(email)) return false;
    localStorage.removeItem(KEY);
    return JSON.stringify(stored.versions) === JSON.stringify(LEGAL_VERSIONS);
  } catch {
    return false;
  }
}
