/**
 * 招待リンク(/invite/:token)を LINE などへ貼ったときに出すカードの文言。
 *
 * index.html は 1 つしか無いので、招待リンクの分だけ Worker が OG タグを書き換えて返す。
 * DB は読まない。グループの名前や招待した人の名前は入れない。LINE の下見のサーバーが
 * 結果をキャッシュに残すため、グループが変わっても文言は同じにする。#93
 */

const INVITE_PATH = /^\/invite\/([^/]+)$/;

/** パスが招待リンクなら token を返す。それ以外は null */
export function matchInvitePath(pathname: string): string | null {
  return INVITE_PATH.exec(pathname)?.[1] ?? null;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `<meta property="og:X" content="...">` の content だけを書き換える */
function setMetaContent(html: string, property: string, content: string): string {
  const pattern = new RegExp(`(<meta[^>]*\\bproperty="${property}"[^>]*\\bcontent=")[^"]*(")`);
  return html.replace(pattern, `$1${escapeAttr(content)}$2`);
}

/**
 * index.html の OG タグを、招待リンク用の文言に書き換える。
 * @param html ビルド後の index.html の中身(ASSETS から読んだもの)
 * @param appUrl この要求が来た環境の画面の URL。resolveAppUrl の結果
 * @param token 招待リンクの token。パスからそのまま取る
 */
export function rewriteInviteMeta(html: string, appUrl: string, token: string): string {
  const withTitle = setMetaContent(html, "og:title", "Logru への招待");
  const withDescription = setMetaContent(withTitle, "og:description", "Logru への招待が届いています。");
  const withUrl = setMetaContent(withDescription, "og:url", `${appUrl}/invite/${token}`);
  return setMetaContent(withUrl, "og:image", `${appUrl}/og-image.png`);
}
