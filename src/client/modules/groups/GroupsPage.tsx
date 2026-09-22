import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { Field } from "@/components/parts/Field";
import { Dot, Empty, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupColor } from "@/lib/colors";
import { useGroups, useMe } from "@/api/common";
import { poolColorsOf } from "../calendar/model";
import { useCreateGroup } from "./api";

/** グループの一覧と、グループを作る画面。自分だけのグループは一覧に出さない。F-10 */
export function GroupsPage() {
  const me = useMe();
  const groups = useGroups();
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = groups.data ?? [];
  // 自分だけのグループは、画面ではグループとして見せない。0009
  const shared = list.filter((g) => !g.isPersonal);
  const prefs = me.data?.colorPrefs ?? [];
  const busy = createGroup.isPending;

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const g = await createGroup.mutateAsync(name);
      navigate(`/groups/${g.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AppLayout poolColors={poolColorsOf(list, me.data)}>
      <Page>
        <PageBar title="グループ" />
        <Panel title="入っているグループ" aria-label="グループの一覧">
          {shared.length > 0 ? (
            <div>
              {shared.map((g) => (
                <Link
                  key={g.id}
                  to={`/groups/${g.id}`}
                  className="flex min-h-12 items-center gap-3 border-b border-line text-[15px] text-ink no-underline last:border-b-0"
                >
                  <Dot color={groupColor(g, prefs)} className="size-3" />
                  <span className="flex-1">{g.name}</span>
                  <span className="text-xs text-ink-2">{`${g.members.length} 人${g.role === "admin" ? "・管理者" : ""}`}</span>
                  <span className="text-lg text-ink-3" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            groups.data && (
              <Empty>
                まだ入っているグループはありません。
                <br />
                家族やパートナーと予定を共有するなら、下でグループを作ってください。
              </Empty>
            )
          )}
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
