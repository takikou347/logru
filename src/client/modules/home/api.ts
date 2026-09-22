/** ホームの画面だけが使う API の hook。0028 */

import type { HomeForm, HomeLayout, HomeWidgetEntry } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";

const homeLayoutKey = (form: HomeForm) => ["home-layout", form] as const;

/** 保存したホームの並びを読む。まだ保存が無ければ widgets が null */
export function useHomeLayout(form: HomeForm) {
  return useQuery({
    queryKey: homeLayoutKey(form),
    queryFn: () => api<HomeLayout>(`/me/home-layout?form=${form}`),
  });
}

/** ホームの並びを保存する。form ごとの設定 */
export function useSaveHomeLayout(form: HomeForm) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: HomeWidgetEntry[]) =>
      api<HomeLayout>("/me/home-layout", { method: "PUT", body: { form, widgets } }),
    onSuccess: (data) => qc.setQueryData(homeLayoutKey(form), data),
    onError: (e) => toast.error((e as Error).message),
  });
}
