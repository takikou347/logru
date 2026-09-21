import "../styles/app.css";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { GroupSummary } from "../../shared/api-types";
import { poolColorsOf } from "../calendar/model";
import { api } from "../lib/api";
import { groupColor } from "../lib/colors";
import { keys, useGroups, useMe } from "../lib/queries";
import { AppLayout, PageBar } from "../ui/AppLayout";
import { Field } from "../ui/controls";

export function Groups() {
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
      <div className="page">
        <PageBar title="グループ" />
        <section className="panel glass" aria-label="グループの一覧">
          <h2>入っているグループ</h2>
          <div>
            {list.map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`} className="row-btn" style={{ textDecoration: "none" }}>
                <span className={`dot c-${groupColor(g, prefs)}`} aria-hidden="true" />
                <span className="grow">{g.isPersonal ? "自分" : g.name}</span>
                <span className="note">
                  {g.isPersonal ? "自分だけ" : `${g.members.length} 人${g.role === "admin" ? "・管理者" : ""}`}
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
        <form className="panel glass" onSubmit={create} noValidate>
          <h2>グループを作る</h2>
          <Field label="グループの名前" error={error} hint="例: ふたり、実家">
            {(p) => <input {...p} className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()} style={{ alignSelf: "flex-start" }}>
            作る
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
