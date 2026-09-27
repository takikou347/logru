/**
 * 招待リンク(/invite/:token)を LINE などへ貼ったときに出すカードの文言。
 *
 * index.html は 1 つしか無いので、招待リンクの分だけ Worker が OG タグを書き換えて返す。
 * DB は読まない。グループの名前や招待した人の名前は入れない。LINE の下見のサーバーが
 * 結果をキャッシュに残すため、グループが変わっても文言は同じにする。#93、#131
 */

// token は randomToken()(groups/routes.ts)が作る、URL で使える Base64 の形だけを受け付ける。0065、#161
const INVITE_PATH = /^\/invite\/([A-Za-z0-9_-]+)$/;

/** パスが招待リンクなら token を返す。それ以外は null */
export function matchInvitePath(pathname: string): string | null {
  return INVITE_PATH.exec(pathname)?.[1] ?? null;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * `<meta property="og:X" content="...">` の content だけを書き換える。
 * 置き換えは関数で渡す。文字列で渡すと、content に `$&` や `$1` のような並びが入ったとき、
 * String.replace が捕まえた部分やグループの中身として解いてしまい、HTML が崩れうる。0065、#161
 */
function setMetaContent(html: string, property: string, content: string): string {
  const pattern = new RegExp(`(<meta[^>]*\\bproperty="${property}"[^>]*\\bcontent=")[^"]*(")`);
  const escaped = escapeAttr(content);
  return html.replace(pattern, (_match, before: string, after: string) => `${before}${escaped}${after}`);
}

/**
 * index.html の OG タグを、招待リンク用の文言に書き換える。
 * @param html ビルド後の index.html の中身(ASSETS から読んだもの)
 * @param appUrl この要求が来た環境の画面の URL。resolveAppUrl の結果
 * @param token 招待リンクの token。パスからそのまま取る
 */
export function rewriteInviteMeta(html: string, appUrl: string, token: string): string {
  const withTitle = setMetaContent(html, "og:title", "Logru への招待");
  const withDescription = setMetaContent(
    withTitle,
    "og:description",
    "Logru で、いっしょに予定を分け合いませんか。リンクから参加できます。",
  );
  const withUrl = setMetaContent(withDescription, "og:url", `${appUrl}/invite/${token}`);
  return setMetaContent(withUrl, "og:image", `${appUrl}/og-image.png`);
}
