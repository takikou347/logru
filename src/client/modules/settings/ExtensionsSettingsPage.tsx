import { clientExtensions } from "@extensions/client/registry";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { BASE_TOURS } from "@/lib/tours";
import { poolColorsOf } from "../calendar/model";
import { ExtensionCard } from "./components/ExtensionCard";
import { SettingsShell } from "./components/SettingsShell";
import { useExtensionOverview, useSetExtensionEnabled } from "./extensions-api";

/** 自分で登録や調整をせず、いつでも使える拡張。設定の欄を持つものだけをカードにする。0019、issue #102 */
const ALWAYS_AVAILABLE = clientExtensions.filter(
  (x) => x.SettingsSection && (x.manifest.alwaysOn || x.manifest.perUser),
);

/**
 * 設定の「機能」。拡張ごとに、自分が使うかを切り替える。F-24、0019
 *
 * 切り替えられる拡張はカードの「使う」で切り替え、いつでも使える拡張(外部のカレンダーなど)は
 * カードを押すとその拡張の詳細へ移る。共有できるかどうかや、拡張ごとの設定は、その拡張の詳細に集めた。issue #102
 */
export function ExtensionsSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const overview = useExtensionOverview();
  const toggle = useSetExtensionEnabled();
  const [params, setParams] = useSearchParams();

  // 近道などから、使っていない拡張の画面を開こうとして、ここへ来たとき。#110
  const off = params.get("off");
  useEffect(() => {
    if (!off) return;
    toast(`${off}は使っていません。ここから使うに切り替えられます`);
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        q.delete("off");
        return q;
      },
      { replace: true },
    );
  }, [off, setParams]);

  if (overview.isPending || !me.data) return <Loading />;
  const list = overview.data?.extensions ?? [];
  const personalGroupId = overview.data?.personalGroupId;

  return (
    <SettingsShell title="機能" poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      {overview.error && (
        <LoadFailure what="機能の一覧" error={overview.error} onRetry={() => void overview.refetch()} />
      )}
      {list.length === 0 && ALWAYS_AVAILABLE.length === 0 && !overview.error && (
        <EmptyState pose="compass" action={{ label: "カレンダーを見る", to: "/" }}>
          足せる機能はまだありません。
          <br />
          予定は、いつも使えます。
        </EmptyState>
      )}
      {list.map((x) => {
        const pending =
          toggle.isPending && toggle.variables?.groupId === personalGroupId && toggle.variables?.key === x.key;
        const checked = pending ? Boolean(toggle.variables?.enabled) : x.personal;
        return (
          <ExtensionCard
            key={x.key}
            extKey={x.key}
            label={x.label}
            description={x.description}
            toggle={{
              checked,
              pending,
              disabled: !personalGroupId,
              onToggle: (enabled) => {
                if (!personalGroupId) return;
                toggle.mutate({ groupId: personalGroupId, key: x.key, enabled });
              },
            }}
          />
        );
      })}
      {ALWAYS_AVAILABLE.map((x) => (
        <ExtensionCard
          key={x.manifest.key}
          extKey={x.manifest.key}
          label={x.manifest.label}
          description={x.manifest.description}
        />
      ))}
      <ScreenTour id="extensions" steps={BASE_TOURS.extensions} />
    </SettingsShell>
  );
}
