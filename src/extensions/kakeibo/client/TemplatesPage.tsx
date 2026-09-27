/** よく使う記録の画面。並べる。押すと全部の欄を直せる、消す。0072、F-326、issue #248 */
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { useRowMotion } from "@/lib/use-row-motion";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import { kakeiboCategoryLabel } from "../shared/categories";
import { formatYen } from "../shared/format";
import type { KakeiboTemplate } from "./api";
import { useDeleteTemplate, useKakeiboGroups, useKakeiboTemplates } from "./api";
import { TemplateSheet } from "./TemplateSheet";

/**
 * よく使う記録 1 件の行。押すと直すシートが開き、全部の欄を直せる。issue #12 と同じ「元に戻す」で消す。
 * 足した直後は膨らんで入り、消す途中は縮んで消える。直した直後は短く光る。0044、0048、0085、#226、issue #248
 */
function TemplateRow({
  template,
  isLeaving,
  isEdited,
  onEdit,
  onRemove,
}: {
  template: KakeiboTemplate;
  isLeaving: boolean;
  isEdited: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [entering] = useState(() => takeJustAdded(template.id));

  const detail = [
    template.type === "income" ? "収入" : "支出",
    template.category ? kakeiboCategoryLabel(template.category) : null,
    template.amount ? formatYen(template.amount) : null,
  ]
    .filter(Boolean)
    .join(" ・ ");

  return (
    <li
      className={cn(
        "grid min-h-14 grid-cols-[1fr_auto] items-center gap-2 border-line py-1 not-first:border-t",
        entering && "item-enter",
      )}
      data-leaving={isLeaving || undefined}
      data-edited={isEdited || undefined}
    >
      <button type="button" className="flex min-w-0 flex-col items-start text-left" onClick={onEdit}>
        <span className="min-w-0 truncate text-[15px] font-medium">{template.name}</span>
        <span className="text-xs text-ink-2">{detail}</span>
      </button>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        消す
      </Button>
    </li>
  );
}

/** よく使う記録の画面。本人のものだけ並ぶ */
export function TemplatesPage() {
  const me = useMe();
  const { groups } = useKakeiboGroups();
  const templates = useKakeiboTemplates();
  const deleteTemplate = useDeleteTemplate();
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。縮んで消える動きと、直した行を光らせる印も持つ。0085、#226
  const { hidden, leaving, remove, flashing, flash } = useRowMotion("よく使う記録を消しました");
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  const [params, setParams] = useSearchParams();
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  // 同じ記録をもう一度押したときも、前のシートが閉じる動きの途中なら新しく開き直す。RecurringsPage と同じ。#211
  const editGen = useRef(0);

  if (!me.data) return <Loading />;
  const rows = (templates.data ?? []).filter((t) => !hidden.has(t.id));
  const editing = rows.find((t) => t.id === editingId);

  return (
    <>
      <Page>
        <PageBar title="よく使う記録" back="/kakeibo" />

        {templates.error && !templates.data && (
          <LoadFailure what="よく使う記録" error={templates.error} onRetry={() => void templates.refetch()} />
        )}
        {templates.isPending && <Loading />}

        {templates.data && (
          <Panel>
            {rows.length === 0 ? (
              <EmptyState pose="coin" bordered={false} action={{ label: "支出を記録する", to: "/kakeibo?record=1" }}>
                まだよく使う記録がありません。記録のシートの「よく使う記録にする」で残せます。
              </EmptyState>
            ) : (
              <ul className="flex flex-col">
                {rows.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    isLeaving={leaving.has(t.id)}
                    isEdited={flashing.has(t.id)}
                    onEdit={() => {
                      editGen.current += 1;
                      setParams((p) => (p.set("edit", t.id), p), { replace: true });
                    }}
                    onRemove={() =>
                      remove(t.id, ({ keepalive }) => deleteTemplate.mutateAsync({ id: t.id, keepalive }))
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>
        )}
      </Page>
      {editing && (
        <TemplateSheet
          key={`${editingId}-${editGen.current}`}
          groups={groups}
          me={me.data}
          template={editing}
          onClose={closeEdit}
          onSaved={flash}
        />
      )}
    </>
  );
}
