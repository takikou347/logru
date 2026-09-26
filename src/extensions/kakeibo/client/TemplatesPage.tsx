/** よく使う記録の画面。並べる。名前を直す、消す。F-326 */
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { poolColorsOf } from "@/modules/calendar/model";
import { kakeiboCategoryLabel } from "../shared/categories";
import type { KakeiboTemplate } from "./api";
import { useDeleteTemplate, useKakeiboGroups, useKakeiboTemplates, useSaveTemplate } from "./api";

/** よく使う記録 1 件の行。名前を押すとその場で直せる。issue #12 と同じ「元に戻す」で消す */
function TemplateRow({ template, onRemove }: { template: KakeiboTemplate; onRemove: () => void }) {
  const saveTemplate = useSaveTemplate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    const value = name.trim();
    setEditing(false);
    if (!value || value === template.name) return;
    try {
      await saveTemplate.mutateAsync({ id: template.id, body: { name: value } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setName(template.name);
      setEditing(false);
    }
  }

  const detail = [
    template.type === "income" ? "収入" : "支出",
    template.category ? kakeiboCategoryLabel(template.category) : null,
    template.amount ? `${template.amount.toLocaleString("ja-JP")}円` : null,
  ]
    .filter(Boolean)
    .join(" ・ ");

  return (
    <li className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-2 border-line py-1 not-first:border-t">
      {editing ? (
        <Input
          ref={inputRef}
          value={name}
          maxLength={30}
          aria-label={`${template.name} を直す`}
          className="h-9"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKeyDown}
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-col items-start text-left"
          onClick={() => {
            setName(template.name);
            setEditing(true);
          }}
        >
          <span className="min-w-0 truncate text-[15px] font-medium">{template.name}</span>
          <span className="text-xs text-ink-2">{detail}</span>
        </button>
      )}
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
  const { pending, remove } = useUndoableDelete("よく使う記録を消しました");
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  if (!me.data) return <Loading />;
  const rows = (templates.data ?? []).filter((t) => !pending.has(t.id));

  return (
    <Page>
      <PageBar title="よく使う記録" back="/kakeibo" />

      {templates.error && !templates.data && (
        <LoadFailure what="よく使う記録" error={templates.error} onRetry={() => void templates.refetch()} />
      )}
      {templates.isPending && <Loading />}

      {templates.data && (
        <Panel>
          {rows.length === 0 ? (
            <Empty>まだよく使う記録がありません。記録のシートの「よく使う記録にする」で残せます。</Empty>
          ) : (
            <ul className="flex flex-col">
              {rows.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onRemove={() => remove(t.id, ({ keepalive }) => deleteTemplate.mutateAsync({ id: t.id, keepalive }))}
                />
              ))}
            </ul>
          )}
        </Panel>
      )}
    </Page>
  );
}
