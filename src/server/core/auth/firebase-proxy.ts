/**
 * Firebase の認証の通り道を、アプリと同じドメインで受けて Firebase へ中継する。#1
 *
 * Google でのログインの窓は、認証用のドメインの `/__/auth/handler` で開く。
 * 認証用のドメインがアプリと違うと、Safari は窓の保存領域を分け、ログインの結果が画面に戻らない。
 * 画面の authDomain をアプリのドメインにし、その道をここで `<プロジェクト ID>.firebaseapp.com` へ渡す。
 */

/** 中継する道。ログインの窓と、画面が裏で開く iframe */
export function isFirebaseAuthPath(pathname: string): boolean {
  return pathname.startsWith("/__/auth/");
}

/**
 * 要求を Firebase の認証用のドメインへ渡し、返事をそのまま返す。
 * @param request 受けた要求。道は isFirebaseAuthPath で確かめてから渡す
 * @param projectId Firebase のプロジェクト ID
 */
export function proxyFirebaseAuth(request: Request, projectId: string): Promise<Response> {
  const from = new URL(request.url);
  const to = new URL(from.pathname + from.search, `https://${projectId}.firebaseapp.com`);
  // Firebase の側が移すときは、移し先をそのまま画面に返す
  return fetch(new Request(to, request), { redirect: "manual" });
}
