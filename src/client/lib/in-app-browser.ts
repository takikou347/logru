/**
 * アプリ内のブラウザーを見分ける。#126、0060
 *
 * Google はアプリに埋め込んだブラウザーからのログインを認めていない。
 * LINE は URL に決まった引数を付けると自分から外のブラウザーで開き直すので、そちらへ移す。
 * ほかのアプリ内のブラウザーにはこの仕組みが無いので、画面に案内を出すだけにする。
 * 判定の関数は、ブラウザーの値を引数で受け取る。単体テストで UA を切り替えられるように
 */

/** アプリ内のブラウザーの種類。line は開き直せる。other は案内だけ出す */
export type InAppBrowserKind = "line" | "other";

/** LINE が UA に含める印 */
const LINE = /Line\//;
/** LINE 以外のアプリ内のブラウザー。Instagram、Facebook、X から始める */
const OTHER = /Instagram|FBAN|FBAV|Twitter/;

/**
 * UA からアプリ内のブラウザーを見分ける。
 * @param userAgent navigator.userAgent
 * @returns 当てはまらなければ null
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserKind | null {
  if (LINE.test(userAgent)) return "line";
  if (OTHER.test(userAgent)) return "other";
  return null;
}

/** LINE を外のブラウザーで開き直すときに URL へ足す引数。開き直した後も残るので、もう一度開き直さない印にもなる */
const EXTERNAL_PARAM = "openExternalBrowser";

/**
 * LINE の中で開かれていたら、外のブラウザーで開き直す先の URL。
 * すでに開き直した印が付いているのにまだ LINE の中なら null を返す。行き来が止まらなくなるのを防ぐため
 * @param userAgent navigator.userAgent
 * @param href いまの URL。location.href
 * @returns 開き直す先の URL。開き直さないなら null
 */
export function externalBrowserRedirectUrl(userAgent: string, href: string): string | null {
  if (detectInAppBrowser(userAgent) !== "line") return null;
  const url = new URL(href);
  if (url.searchParams.has(EXTERNAL_PARAM)) return null;
  url.searchParams.set(EXTERNAL_PARAM, "1");
  return url.toString();
}

/**
 * 外のブラウザーで開いた後、URL に残った開き直しの印を消した URL。
 * @param href いまの URL。location.href
 * @returns 消した URL。印が付いていないなら null
 */
export function withoutExternalBrowserParam(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(EXTERNAL_PARAM)) return null;
  url.searchParams.delete(EXTERNAL_PARAM);
  return url.toString();
}
