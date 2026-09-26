import type { ClientExtension } from "@extensions/client/types";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { EmptyState } from "@/components/parts/EmptyState";
import { Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { extensionIcon } from "@/lib/extension-visuals";
import { useAddableExtensions } from "@/lib/extensions";
import { vibrateShort } from "@/lib/haptics";
import { markExtensionJustAdded } from "@/lib/recent-extension-adds";
import { poolColorsOf } from "../calendar/model";
import { SettingsShell } from "./components/SettingsShell";
import { useSetExtensionEnabled } from "./extensions-api";

/**
 * 1 件のカード。見本の画像は無いので、アイコンで代える。0052
 * 色は拡張ごとに変えない。色はグループだけに使う決まり(0056)のため、テーマカラー 1 色にそろえる。issue #15
 */
function AddableExtensionCard({ ext, pending, onAdd }: { ext: ClientExtension; pending: boolean; onAdd: () => void }) {
  const Icon = extensionIcon(ext.manifest.key);
  return (
    <Panel aria-label={ext.manifest.label}>
      <div className="flex items-center gap-3">
        <span className="grid size-14 flex-none place-items-center rounded-2xl bg-primary/15" aria-hidden="true">
          <Icon className="size-6 text-primary" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-bold">{ext.manifest.label}</span>
          <span className="text-[13px] leading-relaxed text-ink-2">{ext.manifest.description}</span>
        </div>
        <Button size="sm" disabled={pending} onClick={onAdd}>
          足す
        </Button>
      </div>
    </Panel>
  );
}

/**
 * 「機能を足す」画面。まだ足していない機能をカードで並べる。issue #145、0058
 *
 * 「足す」を押すと、自分だけのグループでその拡張を有効にする。足すと、その拡張の最初の一歩(あれば)を
 * 知らせで案内し、タイルの並びに戻ったときに縮みながら入る動きを 1 度だけ付ける(item-enter、0048)。
 * 全部足してあるときは、マスコットの空の表示にする。
 */
export function ExtensionAddPage() {
  const me = useMe();
  const groups = useGroups();
  const navigate = useNavigate();
  const candidates = useAddableExtensions();
  const setEnabled = useSetExtensionEnabled();
  const personalGroupId = groups.data?.find((g) => g.isPersonal)?.id ?? null;

  if (groups.isPending || !me.data) return <Loading />;

  function add(ext: ClientExtension) {
    if (!personalGroupId) return;
    setEnabled.mutate(
      { groupId: personalGroupId, key: ext.manifest.key, enabled: true },
      {
        onSuccess: () => {
          markExtensionJustAdded(ext.manifest.key);
          vibrateShort();
          const first = ext.actions?.[0];
          toast(`${ext.manifest.label}を足しました`, {
            description: first ? `はじめに「${first.label}」からどうぞ` : undefined,
            action: first ? { label: first.label, onClick: () => navigate(first.path) } : undefined,
          });
          navigate("/settings/extensions");
        },
      },
    );
  }

  return (
    <SettingsShell
      title="機能を足す"
      poolColors={poolColorsOf(groups.data ?? [], me.data)}
      back="/settings/extensions"
      backMobileOnly={false}
    >
      {candidates.length === 0 ? (
        <EmptyState pose="compass" action={{ label: "機能の一覧へ", to: "/settings/extensions" }}>
          足せる機能は、もう全部足しています。
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {candidates.map((ext) => (
            <AddableExtensionCard
              key={ext.manifest.key}
              ext={ext}
              pending={setEnabled.isPending && setEnabled.variables?.key === ext.manifest.key}
              onAdd={() => add(ext)}
            />
          ))}
        </div>
      )}
    </SettingsShell>
  );
}
