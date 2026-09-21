import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Me, ThemeMode } from "../../../shared/api-types";
import { ACCENT_COLORS, GROUP_COLORS } from "../../../shared/colors";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar, useSignOut } from "@/components/AppLayout";
import { ColorSheet } from "@/components/ColorSheet";
import { ColorSwatches } from "@/components/ColorSwatches";
import { Field } from "@/components/Field";
import { Dot, FieldMessage, Panel, PanelRow, RowButton } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { groupColor, memberColor } from "@/lib/colors";
import { useColorPref } from "@/lib/mutations";
import { keys, useGroups, useMe } from "@/lib/queries";
import { applyTheme } from "@/lib/theme";
import { poolColorsOf } from "../calendar/model";
import { DeleteAccountSheet } from "./DeleteAccountSheet";

const MODES = [
  { value: "system", label: "端末と同じ" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
] as const;

/** ログインに使った手段の、画面での名前 */
const PROVIDER_LABELS: Record<string, string> = { "google.com": "Google", password: "メールとパスワード" };

type Target = { type: "group" | "user"; id: string; title: string; fallback: string };

/**
 * 設定の画面。明るさ、テーマカラー、自分の色、ほかの人とグループの色、アカウント。F-15、F-17〜F-20
 * 見た目の設定は、押した瞬間に画面に効かせてから送る。
 */
export function SettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const qc = useQueryClient();
  const doSignOut = useSignOut();
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
      toast.error((e as Error).message);
    },
    // 自分の色は、自分だけのグループの色でもある
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });

  if (!me.data) return <Loading />;
  const data = me.data;
  const s = data.settings;
  const prefs = data.colorPrefs;
  const list = groups.data ?? [];
  const shared = list.filter((g) => !g.isPersonal);
  const others = otherMembers(shared, data.user.id);
  const change = (patch: Partial<Me["settings"]>) => settings.mutate({ ...s, ...patch });
  const isCustom = (type: "group" | "user", id: string) => prefs.some((p) => p.targetType === type && p.targetId === id);

  return (
    <AppLayout poolColors={poolColorsOf(list, data)}>
      <Page>
        <PageBar title="設定" />

        <Panel title="明るさ">
          <Segmented<ThemeMode> full label="明るさ" value={s.themeMode} options={MODES} onChange={(themeMode) => change({ themeMode })} />
        </Panel>

        <Panel title="テーマカラー">
          <FieldMessage>主ボタンと今日の印に使います。</FieldMessage>
          <ColorSwatches label="テーマカラー" value={s.accentColor} options={ACCENT_COLORS} onChange={(accentColor) => change({ accentColor })} />
        </Panel>

        <Panel title="自分の色">
          <FieldMessage>自分だけの予定の色になります。グループのメンバーにも、この色で見えます。</FieldMessage>
          <ColorSwatches label="自分の色" value={s.userColor} options={GROUP_COLORS} onChange={(userColor) => change({ userColor })} />
        </Panel>

        {(shared.length > 0 || others.length > 0) && (
          <Panel title="グループとメンバーの色" aria-label="グループとメンバーの色">
            <FieldMessage>ほかの人の画面は変わりません。</FieldMessage>
            <div>
              {shared.map((g) => (
                <RowButton key={g.id} onClick={() => setTarget({ type: "group", id: g.id, title: `${g.name} の色`, fallback: g.color })}>
                  <Dot color={groupColor(g, prefs)} className="size-3" />
                  <span className="flex-1">{g.name}</span>
                  <span className="text-xs text-ink-2">{isCustom("group", g.id) ? "自分だけ変えた" : "グループの色のまま"}</span>
                </RowButton>
              ))}
              {others.map((o) => (
                <RowButton key={o.id} onClick={() => setTarget({ type: "user", id: o.id, title: `${o.name} の色`, fallback: o.userColor })}>
                  <Dot color={memberColor(o.id, o.userColor, prefs)} className="size-3" />
                  <span className="flex-1">{o.name}</span>
                  <span className="text-xs text-ink-2">{o.groups.join("、")}のメンバー</span>
                </RowButton>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="アカウント">
          <div>
            <PanelRow>
              <span>表示名</span>
              <Button variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                {data.user.name} を変える
              </Button>
            </PanelRow>
            <PanelRow>
              <span>メールアドレス</span>
              <span className="min-w-0 truncate">{data.user.email}</span>
            </PanelRow>
            <PanelRow>
              <span>ログインの方法</span>
              <span>{PROVIDER_LABELS[data.provider] ?? data.provider}</span>
            </PanelRow>
            <PanelRow>
              <Link to="/terms">利用規約</Link>
              <Link to="/privacy">プライバシーポリシー</Link>
            </PanelRow>
          </div>
          <Button variant="secondary" className="self-start" onClick={doSignOut}>
            ログアウト
          </Button>
        </Panel>

        <Button variant="danger" className="self-start" onClick={() => setDeleting(true)}>
          アカウントを消す
        </Button>
      </Page>

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
      {deleting && <DeleteAccountSheet provider={data.provider} onClose={() => setDeleting(false)} />}
    </AppLayout>
  );
}

/**
 * 共有のグループのメンバーを、自分を除いて 1 人 1 行にまとめる。
 * 同じ人が複数のグループにいれば、グループの名前を並べる。
 */
function otherMembers(shared: { name: string; members: { id: string; name: string; userColor: string }[] }[], myId: string) {
  const others = new Map<string, { id: string; name: string; userColor: string; groups: string[] }>();
  for (const g of shared) {
    for (const m of g.members) {
      if (m.id === myId) continue;
      const cur = others.get(m.id) ?? { id: m.id, name: m.name, userColor: m.userColor, groups: [] };
      cur.groups.push(g.name);
      others.set(m.id, cur);
    }
  }
  return [...others.values()];
}

/** 表示名を変えるシート。グループのメンバーに見える名前 */
function NameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/me", { method: "PATCH", body: { name } });
      await qc.invalidateQueries();
      toast("表示名を変えました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <ResponsiveSheet title="表示名を変える" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="表示名" error={error} hint="グループのメンバーに見える名前です。">
          {(p) => <Input {...p} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            保存する
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
