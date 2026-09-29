import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { poolColorsOf } from "../calendar/model";
import { HelpSection } from "./components/HelpSection";
import { InstallGuideButton } from "./components/InstallGuideButton";
import { ResetToursButton } from "./components/ResetToursButton";
import { SettingsShell } from "./components/SettingsShell";
import { UpdateAppButton } from "./components/UpdateAppButton";

/**
 * 設定の「使い方」。はじめての案内、画面の案内、ホーム画面に追加する手順、アプリを最新にする、よくある質問。
 * F-32、F-33、F-34、F-42、#72、0089
 */
export function UsageSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  if (!me.data) return <Loading />;
  return (
    <SettingsShell title="使い方" poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <HelpSection>
        <ResetToursButton />
        <InstallGuideButton />
        <UpdateAppButton />
      </HelpSection>
    </SettingsShell>
  );
}
