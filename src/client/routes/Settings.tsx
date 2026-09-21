import "../styles/app.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Me, ThemeMode } from "../../shared/api-types";
import { ACCENT_COLORS, GROUP_COLORS } from "../../shared/colors";
import { poolColorsOf } from "../calendar/model";
import { ApiError, api, clearApiCache } from "../lib/api";
import { groupColor, memberColor } from "../lib/colors";
import { useColorPref } from "../lib/mutations";
import { keys, useGroups, useMe } from "../lib/queries";
import { applyTheme } from "../lib/theme";
import { AppLayout, PageBar, useSignOut } from "../ui/AppLayout";
import { ColorSheet } from "../ui/ColorSheet";
import { Field, Segmented, Swatches } from "../ui/controls";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const MODES = [
  { value: "system", label: "端末と同じ" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
] as const;

type Target = { type: "group" | "user"; id: string; title: string; fallback: string };

export function Settings() {
  const me = useMe();
  const groups = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  const signOut = useSignOut();
  const colorPref = useColorPref();
  const [target, setTarget] = useState<Target | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const settings = useMutation({
    mutationFn: (next: Me["settings"]) => api<Me["settings"]>("/me/settings", { method: "PUT", body: next }),
    onMutate: async (next) => {
      applyTheme(next.themeMode, next.accentColor);
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, settings: next });
      return { prev };
    },
    onError: (e, _n, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(keys.me, ctx.prev);
        applyTheme(ctx.prev.settings.themeMode, ctx.prev.settings.accentColor);
      }
      toast({ message: (e as Error).message, tone: "error" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });

  if (!me.data) return <div className="loading">読み込んでいます</div>;
  const data = me.data;
  const s = data.settings;
  const prefs = data.colorPrefs;
  const list = groups.data ?? [];
  const shared = list.filter((g) => !g.isPersonal);
  const others = new Map<string, { id: string; name: string; userColor: string; groups: string[] }>();
  for (const g of shared) {
    for (const m of g.members) {
      if (m.id === data.user.id) continue;
      const cur = others.get(m.id) ?? { id: m.id, name: m.name, userColor: m.userColor, groups: [] };
      cur.groups.push(g.name);
      others.set(m.id, cur);
    }
  }
  const change = (patch: Partial<Me["settings"]>) => settings.mutate({ ...s, ...patch });
  const isCustom = (type: "group" | "user", id: string) => prefs.some((p) => p.targetType === type && p.targetId === id);

  return (
    <AppLayout poolColors={poolColorsOf(list, data)}>
      <div className="page">
        <PageBar title="設定" />

        <section className="panel glass">
          <h2 id="mode-label">明るさ</h2>
          <Segmented<ThemeMode> full label="明るさ" value={s.themeMode} options={MODES} onChange={(themeMode) => change({ themeMode })} />
        </section>

        <section className="panel glass">
          <h2>テーマカラー</h2>
          <span className="hint">主ボタンと今日の印に使います。</span>
          <Swatches label="テーマカラー" value={s.accentColor} options={ACCENT_COLORS} onChange={(accentColor) => change({ accentColor })} />
        </section>

        <section className="panel glass">
          <h2>自分の色</h2>
          <span className="hint">自分だけの予定の色になります。グループのメンバーにも、この色で見えます。</span>
          <Swatches label="自分の色" value={s.userColor} options={GROUP_COLORS} onChange={(userColor) => change({ userColor })} />
        </section>

        {(shared.length > 0 || others.size > 0) && (
          <section className="panel glass" aria-label="グループとメンバーの色">
            <h2>グループとメンバーの色</h2>
            <span className="hint">ほかの人の画面は変わりません。</span>
            <div>
              {shared.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="row-btn"
                  onClick={() => setTarget({ type: "group", id: g.id, title: `${g.name} の色`, fallback: g.color })}
                >
                  <span className={`dot c-${groupColor(g, prefs)}`} aria-hidden="true" />
                  <span className="grow">{g.name}</span>
                  <span className="note">{isCustom("group", g.id) ? "自分だけ変えた" : "グループの色のまま"}</span>
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
              {[...others.values()].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="row-btn"
                  onClick={() => setTarget({ type: "user", id: o.id, title: `${o.name} の色`, fallback: o.userColor })}
                >
                  <span className={`dot c-${memberColor(o.id, o.userColor, prefs)}`} aria-hidden="true" />
                  <span className="grow">{o.name}</span>
                  <span className="note">{o.groups.join("、")}のメンバー</span>
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="panel glass">
          <h2>アカウント</h2>
          <div>
            <div className="kv">
              <span>表示名</span>
              <button type="button" className="btn ghost" style={{ minHeight: 40, padding: "0 4px" }} onClick={() => setEditingName(true)}>
                {data.user.name} を変える
              </button>
            </div>
            <div className="kv">
              <span>メールアドレス</span>
              <span>{data.user.email}</span>
            </div>
            <div className="kv">
              <span>ログインの方法</span>
              <span>{data.loginMethods.map((m) => (m === "google" ? "Google" : "メール")).join("、") || "なし"}</span>
            </div>
            <div className="kv">
              <Link to="/terms">利用規約</Link>
              <Link to="/privacy">プライバシーポリシー</Link>
            </div>
          </div>
          <button type="button" className="btn glassy" style={{ alignSelf: "flex-start" }} onClick={signOut}>
            ログアウト
          </button>
        </section>

        <button type="button" className="btn danger" style={{ alignSelf: "flex-start" }} onClick={() => setDeleting(true)}>
          アカウントを消す
        </button>
      </div>

      {target && (
        <ColorSheet
          title={target.title}
          value={prefs.find((p) => p.targetType === target.type && p.targetId === target.id)?.color ?? target.fallback}
          isCustom={isCustom(target.type, target.id)}
          onPick={(color) => colorPref.mutate({ type: target.type, id: target.id, color })}
          onReset={() => colorPref.mutate({ type: target.type, id: target.id, color: null })}
          onClose={() => setTarget(null)}
        />
      )}
      {editingName && <NameSheet current={data.user.name} onClose={() => setEditingName(false)} />}
      {deleting && <DeleteSheet onClose={() => setDeleting(false)} />}
    </AppLayout>
  );
}

function NameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/me", { method: "PATCH", body: { name } });
      await qc.invalidateQueries();
      toast({ message: "表示名を変えました" });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Sheet title="表示名を変える" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="表示名" error={error} hint="グループのメンバーに見える名前です。">
          {(p) => <input {...p} className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            保存する
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "DELETE", body: { confirm } });
      await clearApiCache();
      qc.clear();
      toast({ message: "アカウントを消しました" });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "消せませんでした。もう一度試してください。");
      setBusy(false);
    }
  }
  return (
    <Sheet title="アカウントを消す" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="hint">
          消すと、自分の予定と設定が消え、元に戻せません。グループに共有した予定はグループに残ります。ほかに管理者がいないグループがあると、先に管理者を渡す必要があります。
        </p>
        <Field label="確認のため「削除する」と入れてください" error={error}>
          {(p) => <input {...p} className="input" value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="btn primary" disabled={busy || confirm !== "削除する"} style={{ background: "var(--sun)", color: "#fff" }}>
            アカウントを消す
          </button>
        </div>
      </form>
    </Sheet>
  );
}
