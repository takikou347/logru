/** 画面の入口。index.html から読む */
import "@fontsource-variable/murecho";
import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { setApiFailureHandlers } from "@/lib/api";
import { keys, queryClient } from "@/lib/queries";
import { isSessionExpired, markSessionExpired } from "@/lib/session-expired";
import { applyTheme, readStoredTheme, watchSystemTheme } from "@/lib/theme";
import { AuthProvider, signOut } from "./auth";
import { router } from "./router";

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

const stored = readStoredTheme();
applyTheme(stored.mode, stored.accent);
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
