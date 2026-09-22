/** API から読むデータ。TanStack Query で持ち、画面の間で使い回す */
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

/** アプリで 1 つの QueryClient。4xx は取り直しても変わらないので、取り直さない */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
    mutations: {
      // 既定の "online" だとオフライン中は mutation が保留のまま止まり、つながった瞬間に画面を離れた後でも黙って送られる。
      // "always" にして、これまでと同じく api() が「通信できません」を返して失敗させる
      networkMode: "always",
    },
  },
});
