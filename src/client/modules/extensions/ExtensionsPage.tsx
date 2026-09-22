import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { ExtensionOverview } from "../../../shared/api-types";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/AppLayout";
import { LoadFailure } from "@/components/Failure";
import { Dot, Empty, FieldMessage, Panel } from "@/components/Panel";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { groupColor } from "@/lib/colors";
import { keys, useGroups, useMe } from "@/lib/queries";
import { poolColorsOf } from "../calendar/model";

type Overview = { extensions: ExtensionOverview[]; personalGroupId: string | null };

/**
 * 機能の一覧。拡張ごとに、自分が使うかを切り替える。F-24、0019
 *
 * 切ると、グループで有効でも、自分の画面には入口も項目も出ない。
 * どのグループで共有できるかは、そのグループの設定で管理者が決める。ここではグループの名前だけを出し、押すとグループの設定へ移る。
 */
export function ExtensionsPage() {
  const me = useMe();
  const groups = useGroups();
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: keys.extensionOverview, queryFn: () => api<Overview>("/extensions") });
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api(`/groups/${overview.data?.personalGroupId}/extensions/${key}`, { method: "PUT", body: { enabled } }),
    onSuccess: (_r, v) => toast(v.enabled ? "使えるようにしました" : "使わないようにしました"),
    onError: (e) => toast.error((e as Error).message),
    // 入口の出し分けはグループの有効な拡張で決まるので、グループも読み直す
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: keys.extensionOverview }), qc.invalidateQueries({ queryKey: keys.groups })]),
  });

  if (overview.isPending || !me.data) return <Loading />;
  const list = overview.data?.extensions ?? [];
  const byId = new Map((groups.data ?? []).map((g) => [g.id, g]));

  return (
    <AppLayout poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <Page>
        <PageBar title="機能" />
        {overview.error && <LoadFailure what="機能の一覧" error={overview.error} onRetry={() => void overview.refetch()} />}
        {list.length === 0 && !overview.error && (
          <Empty>
            足せる機能はまだありません。
            <br />
            予定と外部のカレンダーは、いつも使えます。
          </Empty>
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
              <FieldMessage>使うと、共有しない記録はいつでも残せます。グループで共有するには、そのグループの設定で管理者が有効にします。</FieldMessage>
            </Panel>
          );
        })}
      </Page>
    </AppLayout>
  );
}
