import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";
import { clientExtensions } from "../../extensions/registry.client";
import { enabledKeys } from "@/lib/extensions";
import { useGroups } from "@/lib/queries";
import { Loading } from "./guards";

/**
 * 拡張の画面を、使えるときだけ出す。どのグループでも無効なら、カレンダーへ戻す。0019
 * @param extensionKey 画面を持つ拡張の key
 */
function ExtensionGate({ extensionKey, Page }: { extensionKey: string; Page: ComponentType }) {
  const groups = useGroups();
  if (groups.isPending) return <Loading />;
  const on = enabledKeys(clientExtensions, groups.data ?? []).has(extensionKey);
  if (!on) return <Navigate to="/extensions" replace />;
  return <Page />;
}

/** 拡張が登録した画面の道順。ログインした人の画面の下に並べる */
export const extensionRoutes: RouteObject[] = clientExtensions.flatMap((x) =>
  (x.pages ?? []).map((page) => ({
    path: page.path,
    lazy: async () => {
      const { Component } = await page.load();
      return { Component: () => <ExtensionGate extensionKey={x.manifest.key} Page={Component} /> };
    },
  })),
);
