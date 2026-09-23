/**
 * ホーム画面に追加する案内の判定。F-34、0036
 *
 * 端末ごとに手順が違うので、判定して合う手順だけを出す。閉じたかは端末ごとの話なので、サーバーには持たず localStorage に持つ。
 * 判定の関数は、ブラウザーの値を引数で受け取る。単体テストで端末を切り替えられるように
 */

import { useSyncExternalStore } from "react";

/**
 * 案内の出し分け。
 * - ios-safari: iPhone か iPad の Safari。共有ボタンから追加する
 * - ios-other: iPhone か iPad の Safari 以外。Safari で開き直してもらう
 * - android: Android。Chrome の追加のダイアログを出す
 * - desktop: PC。何も出さない
 */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

/** Safari 以外の iOS のブラウザーと、アプリの中のブラウザーが UA に入れる印 */
const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|Line\/|Instagram|FBAN|FBAV|Twitter/;

/**
 * 端末とブラウザーを見分ける。
 * @param userAgent navigator.userAgent
 * @param maxTouchPoints navigator.maxTouchPoints。iPad の Safari は Mac と同じ UA を出すので、触れるかで見分ける
 */
export function detectPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios) return IOS_NON_SAFARI.test(userAgent) ? "ios-other" : "ios-safari";
  if (/Android/.test(userAgent)) return "android";
  return "desktop";
}

/**
 * ホーム画面から開いているか。
 * @param displayModeStandalone `(display-mode: standalone)` に合うか
 * @param navigatorStandalone iOS の Safari だけが持つ navigator.standalone
 */
export function isStandalone(displayModeStandalone: boolean, navigatorStandalone: boolean | undefined): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

/** 帯を閉じてから、また出すまでの日数 */
export const BANNER_SNOOZE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 上の帯を出すか。
 * @param p.platform 端末
 * @param p.standalone ホーム画面から開いているか
 * @param p.dismissedAt 帯を閉じた日時。閉じていなければ null
 * @param p.now いまの日時
 * @param p.canPrompt Android の追加のダイアログを出せるか。beforeinstallprompt を受けたか
 */
export function shouldShowInstallBanner(p: {
  platform: InstallPlatform;
  standalone: boolean;
  dismissedAt: number | null;
  now: number;
  canPrompt: boolean;
}): boolean {
  if (p.standalone || p.platform === "desktop") return false;
  // Android は、Chrome が追加できると知らせたときだけ出す。押しても何も起きない帯は出さない
  if (p.platform === "android" && !p.canPrompt) return false;
  if (p.dismissedAt !== null && p.now - p.dismissedAt < BANNER_SNOOZE_DAYS * DAY_MS) return false;
  return true;
}

/**
 * 知らせの欄で、先にホーム画面に追加するよう案内するか。iOS はホーム画面から開いたときだけ知らせを受けられる。0023
 * @param platform 端末
 * @param standalone ホーム画面から開いているか
 */
export function needsInstallForPush(platform: InstallPlatform, standalone: boolean): boolean {
  return (platform === "ios-safari" || platform === "ios-other") && !standalone;
}

/** この端末の端末とブラウザー */
export function currentPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/** いまホーム画面から開いているか */
export function currentStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return isStandalone(
    window.matchMedia("(display-mode: standalone)").matches,
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

/** 帯を閉じた日時を置く localStorage の鍵 */
const DISMISSED_KEY = "logru:install-banner-dismissed-at";

/** 帯を閉じた日時。読めなければ null */
export function readBannerDismissedAt(): number | null {
  try {
    const v = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** 帯を閉じたことを残す */
export function writeBannerDismissedAt(at: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(at));
  } catch {
    // 使えない環境では、次に開いたときにまた出るだけ
  }
}

/** Chrome の beforeinstallprompt。型が標準に無いので、使う分だけ書く */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/**
 * beforeinstallprompt を受け始める。画面の部品より先に来ることがあるので、main.tsx で最初に呼ぶ。
 * Chrome が出す小さな案内は止め、帯のボタンから出す
 */
export function listenInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

/** Android の追加のダイアログを出せるか。出せるようになったら描き直す */
export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => deferred !== null,
    () => false,
  );
}

/**
 * Android の追加のダイアログを出す。1 回しか出せないので、出したら捨てる。
 * @returns 追加したら true。出せないか、やめたら false
 */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}
