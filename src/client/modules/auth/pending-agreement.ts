/**
 * 登録の画面で受けた同意を、メールアドレスを確かめ終えるまで端末に覚えておく。
 *
 * メールで登録した人は、確かめるまで API を使えない。確かめた後に同意の画面をもう一度出すと
 * 同じことを 2 回聞くことになるので、覚えておいた同意をそのとき送る。F-16
 */
import { LEGAL_VERSIONS } from "../../../shared/legal";

const KEY = "logru-pending-agreement";

/** 登録の画面で同意したことを覚える */
export function rememberAgreement(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(LEGAL_VERSIONS));
  } catch {
    // 覚えられなければ、後で同意の画面を出す
  }
}

/** 登録に失敗したとき、覚えた同意を消す。同じ端末の別の人に使わせない */
export function forgetAgreement(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 消せなくても、版が変われば使われない
  }
}

/** 覚えている同意が、いまの規約の版と同じか。同じなら取り出して消す */
export function takeRememberedAgreement(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return raw === JSON.stringify(LEGAL_VERSIONS);
  } catch {
    return false;
  }
}
