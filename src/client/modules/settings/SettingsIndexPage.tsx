import { Navigate } from "react-router";
import { useGroups, useMe } from "@/api/common";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { useMediaQuery } from "@/lib/use-media-query";
import { poolColorsOf } from "../calendar/model";
import { SETTINGS_SECTIONS, SettingsToc } from "./components/SettingsToc";

/**
 * 設定の目次。`/settings`。issue #102
 *
 * スマホは、見た目・通知・機能・使い方・アカウントへの道を並べるだけの画面。
 * PC は左に目次、右に中身の 2 列にするため、常に最初の節(見た目)へ移す。
 */
export function SettingsIndexPage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const me = useMe();
  const groups = useGroups();

  if (desktop) return <Navigate to={SETTINGS_SECTIONS[0].path} replace />;

  return (
    <AppLayout poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <Page>
        <PageBar title="設定" />
        <SettingsToc variant="menu" />
      </Page>
    </AppLayout>
  );
}
