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
  },
});
