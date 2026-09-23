import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { Dot, FieldMessage, Panel } from "@/components/parts/Panel";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { Switch } from "@/components/ui/switch";
import { groupColor } from "@/lib/colors";
import { BASE_TOURS } from "@/lib/tours";
import { poolColorsOf } from "../calendar/model";
import { useExtensionOverview, useToggleExtension } from "./api";

/**
 * 機能の一覧。拡張ごとに、自分が使うかを切り替える。F-24、0019
 *
 * 切ると、グループで有効でも、自分の画面には入口も項目も出ない。
 * どのグループで共有できるかは、そのグループの設定で管理者が決める。ここではグループの名前だけを出し、押すとグループの設定へ移る。
 */
export function ExtensionsPage() {
  const me = useMe();
  const groups = useGroups();
  const overview = useExtensionOverview();
  const toggle = useToggleExtension(overview.data?.personalGroupId ?? undefined);
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
  const byId = new Map((groups.data ?? []).map((g) => [g.id, g]));

  return (
    <AppLayout poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <Page>
        <PageBar title="機能" />
        {overview.error && (
          <LoadFailure what="機能の一覧" error={overview.error} onRetry={() => void overview.refetch()} />
        )}
        {list.length === 0 && !overview.error && (
          <EmptyState pose="compass" action={{ label: "カレンダーを見る", to: "/" }}>
            足せる機能はまだありません。
            <br />
            予定と外部のカレンダーは、いつも使えます。
          </EmptyState>
        )}
        {list.map((x) => {
          const pending = toggle.isPending && toggle.variables?.key === x.key;
          const checked = pending ? Boolean(toggle.variables?.enabled) : x.personal;
          return (
            <Panel key={x.key} aria-label={x.label}>
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="text-[17px] font-bold">{x.label}</h2>
                  <p className="text-[13px] leading-relaxed text-ink-2">{x.description}</p>
                </div>
                <Switch
                  checked={checked}
                  aria-label={`${x.label}を使う`}
                  data-tour="extension-toggle"
                  disabled={!overview.data?.personalGroupId || pending}
                  onCheckedChange={(enabled) => toggle.mutate({ key: x.key, enabled })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                <span className="mr-1 text-xs text-ink-2">共有できるグループ</span>
                {x.groups.length === 0 && <span className="text-xs text-ink-3">まだありません</span>}
                {x.groups.map((g) => {
                  const group = byId.get(g.id);
                  return (
                    <Link
                      key={g.id}
                      to={`/groups/${g.id}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-(--glass-edge) bg-field pr-2 pl-3 text-xs font-bold no-underline"
                    >
                      <Dot color={group ? groupColor(group, me.data.colorPrefs) : "nezumi"} />
                      {g.name}
                      <ChevronRight className="size-3.5 text-ink-3" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
              <FieldMessage>
                使うと、共有しない記録はいつでも残せます。グループで共有するには、そのグループの設定で管理者が有効にします。
              </FieldMessage>
            </Panel>
          );
        })}
      </Page>
      <ScreenTour id="extensions" steps={BASE_TOURS.extensions} />
    </AppLayout>
  );
}
