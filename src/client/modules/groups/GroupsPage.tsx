import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { GroupSummary } from "../../../shared/api-types";
import { AppLayout, Page, PageBar } from "@/components/AppLayout";
import { Field } from "@/components/Field";
import { Dot, Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { groupColor } from "@/lib/colors";
import { keys, useGroups, useMe } from "@/lib/queries";
import { poolColorsOf } from "../calendar/model";

/** グループの一覧と、グループを作る画面。F-10 */
export function GroupsPage() {
  const me = useMe();
  const groups = useGroups();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = groups.data ?? [];
  const prefs = me.data?.colorPrefs ?? [];

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const g = await api<GroupSummary>("/groups", { method: "POST", body: { name } });
      await qc.invalidateQueries({ queryKey: keys.groups });
      navigate(`/groups/${g.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AppLayout poolColors={poolColorsOf(list, me.data)}>
      <Page>
        <PageBar title="グループ" />
        <Panel title="入っているグループ" aria-label="グループの一覧">
          <div>
            {list.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="flex min-h-12 items-center gap-3 border-b border-line text-[15px] text-ink no-underline last:border-b-0"
              >
                <Dot color={groupColor(g, prefs)} className="size-3" />
                <span className="flex-1">{g.isPersonal ? "自分" : g.name}</span>
                <span className="text-xs text-ink-2">
                  {g.isPersonal ? "自分だけ" : `${g.members.length} 人${g.role === "admin" ? "・管理者" : ""}`}
                </span>
                <span className="text-lg text-ink-3" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="グループを作る">
          <form className="flex flex-col gap-3" onSubmit={create} noValidate>
            <Field label="グループの名前" error={error} hint="例: ふたり、実家">
              {(p) => <Input {...p} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Button type="submit" className="self-start" disabled={busy || !name.trim()}>
              作る
            </Button>
          </form>
        </Panel>
      </Page>
    </AppLayout>
  );
}
