import { clientExtensions } from "@extensions/client/registry";
import type { ExtensionManifest } from "@extensions/types";
import { extensionTourId } from "@shared/tours";
import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";
import { useGroups } from "@/api/common";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { enabledKeys } from "@/lib/extensions";
import { Loading } from "./guards";

/**
 * 拡張の画面を、使えるときだけ出す。どのグループでも無効なら、カレンダーへ戻す。0019
 * 拡張が manifest に tour を持てば、初めて開いたときに案内を出す。F-33
 * @param manifest 画面を持つ拡張の manifest
 */
function ExtensionGate({ manifest, Page }: { manifest: ExtensionManifest; Page: ComponentType }) {
  const groups = useGroups();
  if (groups.isPending) return <Loading />;
  const on = enabledKeys(clientExtensions, groups.data ?? []).has(manifest.key);
  // 近道などから、使っていない拡張の画面を開こうとしたとき。設定の「機能」へ案内する。#110
  if (!on) return <Navigate to={`/settings/extensions?off=${encodeURIComponent(manifest.label)}`} replace />;
  return (
    <>
      <Page />
      {manifest.tour && <ScreenTour id={extensionTourId(manifest.key)} steps={manifest.tour} />}
    </>
  );
}

/** 拡張が登録した画面の道順。ログインした人の画面の下に並べる */
export const extensionRoutes: RouteObject[] = clientExtensions.flatMap((x) =>
  (x.pages ?? []).map((page) => ({
    path: page.path,
    lazy: async () => {
      const { Component } = await page.load();
      return { Component: () => <ExtensionGate manifest={x.manifest} Page={Component} /> };
    },
  })),
);
