/** 画面の入口。index.html から読む */
import "@fontsource-variable/murecho";
import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { setApiFailureHandlers } from "@/api/client";
import { keys } from "@/api/keys";
import { queryClient } from "@/api/query-client";
import { Toaster } from "@/components/ui/sonner";
import { clientErrorReporter, describeError } from "@/lib/error-report";
import { detectInAppBrowser, externalBrowserRedirectUrl, withoutExternalBrowserParam } from "@/lib/in-app-browser";
import { listenInstallPrompt } from "@/lib/pwa";
import { listenAutoUpdate } from "@/lib/pwa-update";
import { isSessionExpired, markSessionExpired } from "@/lib/session-expired";
import { applyTheme, readStoredTheme, watchSystemTheme } from "@/lib/theme";
import { AuthProvider, signOut } from "./auth";
import { router } from "./router";

// LINE の中で開かれたら、外のブラウザーで開き直す。React を描く前に、招待の URL も含めて確かめる。#126、0060
const redirectUrl = externalBrowserRedirectUrl(navigator.userAgent, location.href);
if (redirectUrl) {
  location.replace(redirectUrl);
} else {
  // 外のブラウザーで開いた後だけ、URL に残った開き直しの印を消す。まだ LINE の中なら印を残し、
  // 読み込み直しても開き直さない状態を保つ。行き来が止まらなくなるのを防ぐため
  if (detectInAppBrowser(navigator.userAgent) !== "line") {
    const cleared = withoutExternalBrowserParam(location.href);
    if (cleared) history.replaceState(history.state, "", cleared);
  }

  // 画面ごとではなく、アプリ全体で受ける失敗。0025
  setApiFailureHandlers({
    // ログアウトすると、ログインが要る画面の入口がログインへ移し、戻り先も付ける
    onSessionExpired: () => {
      if (isSessionExpired()) return;
      markSessionExpired();
      void signOut();
    },
    // 自分を読み直すと、ログインが要る画面の入口が同意の画面へ移す
    onLegalRequired: () => void queryClient.invalidateQueries({ queryKey: keys.me }),
  });

  // 画面で起きた誤りをサーバーへ送り、Workers Logs で見る。0040
  window.addEventListener("error", (e) => {
    const { message, stack } = describeError(e.error ?? e.message);
    clientErrorReporter.report(message, stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const { message, stack } = describeError(e.reason);
    clientErrorReporter.report(message, stack);
  });

  // 新しい版を出した後に、消えた古いファイルを読みにいったら、1 度だけ黙って読み込み直す。0025
  // 2 度目も失敗したら、画面を開けなかったときのカードに任せる
  const RELOADED = "logru:reloaded-for-new-version";
  window.addEventListener("vite:preloadError", (e) => {
    try {
      if (sessionStorage.getItem(RELOADED)) return;
      sessionStorage.setItem(RELOADED, "1");
    } catch {
      return;
    }
    e.preventDefault();
    window.location.reload();
  });
  // 読み込み直した後に開けたら、次の版のために印を消す
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOADED);
    } catch {
      // 使えない環境では何もしない
    }
  }, 10_000);

  // Android の Chrome が「追加できる」と知らせるのは画面の部品より先のことがある。最初に受け始める。F-34
  listenInstallPrompt();

  // 新しい版を出したら、開き直さなくても画面を切り替える。F-41、0073
  listenAutoUpdate();

  const stored = readStoredTheme();
  applyTheme(stored.mode, stored.bgTheme, stored.accent);
  watchSystemTheme();

  // 開発中だけ。?debug=noblur,nopools で見た目の効果を切る。globals.css の data-debug を見る。#3
  if (import.meta.env.DEV) {
    const debug = new URLSearchParams(location.search).get("debug");
    if (debug) document.documentElement.dataset.debug = debug.split(",").join(" ");
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
