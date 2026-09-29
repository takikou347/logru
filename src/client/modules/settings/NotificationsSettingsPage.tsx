import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { poolColorsOf } from "../calendar/model";
import { NotificationKindsSection } from "./components/NotificationKindsSection";
import { PushSection } from "./components/PushSection";
import { SettingsShell } from "./components/SettingsShell";

/** 設定の「通知」。この端末の通知の入り切りと、種類ごとの一覧・端末の出し分け。F-23、F-47、0096 */
export function NotificationsSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  if (!me.data) return <Loading />;
  return (
    <SettingsShell title="通知" poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <PushSection />
      <NotificationKindsSection />
    </SettingsShell>
  );
}
