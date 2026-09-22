import { Check, Pencil, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Me, ThemeMode } from "@shared/api-types";
import { ACCENT_COLORS, GROUP_COLORS } from "@shared/colors";
import { clientExtensions } from "@extensions/client/registry";
import { profileInput } from "@shared/schemas";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar, useSignOut } from "@/components/layout/AppLayout";
import { ColorSheet } from "@/components/parts/ColorSheet";
import { ColorSwatches } from "@/components/parts/ColorSwatches";
import { Dot, FieldMessage, Panel, PanelRow, RowButton } from "@/components/parts/Panel";
import { Segmented } from "@/components/parts/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupColor, memberColor } from "@/lib/colors";
import { useColorPref, useGroups, useMe } from "@/api/common";
import { poolColorsOf } from "../calendar/model";
import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { PushSection } from "./PushSection";
import { useUpdateName, useUpdateSettings } from "./api";

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
  const doSignOut = useSignOut();
  const colorPref = useColorPref();
  const [target, setTarget] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState(false);

  const settings = useUpdateSettings();

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
          <FieldMessage>カレンダーの「自分だけの予定」の色になります。グループのメンバーにも、この色で見えます。</FieldMessage>
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

        {clientExtensions.map((x) => x.SettingsSection && <x.SettingsSection key={x.manifest.key} />)}

        <PushSection />

        <Panel title="アカウント">
          <div>
            <NameRow current={data.user.name} />
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

/**
 * 表示名の行。グループのメンバーに見える名前。
 * 鉛筆のボタンを押すと、その行で直せる。Enter か保存のボタンで送り、Esc で元に戻す。
 */
function NameRow({ current }: { current: string }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // 開いたら全体を選び、閉じたら鉛筆のボタンに戻す
  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (wasEditing.current) pencilRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const save = useUpdateName();

  function open() {
    setName(current);
    setError(null);
    setEditing(true);
  }
  function cancel() {
    setName(current);
    setError(null);
    setEditing(false);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    const parsed = profileInput.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力が正しくありません。");
      inputRef.current?.focus();
      return;
    }
    if (parsed.data.name === current) return cancel();
    save.mutate(parsed.data.name, {
      onSuccess: () => {
        toast("表示名を変えました");
        setEditing(false);
      },
      onError: (e) => setError((e as Error).message),
    });
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    cancel();
  }

  if (!editing) {
    return (
      <PanelRow>
        <span>表示名</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate">{current}</span>
          <Button ref={pencilRef} variant="ghost" size="icon" className="-mr-2.5" aria-label="表示名を変える" onClick={open}>
            <Pencil />
          </Button>
        </span>
      </PanelRow>
    );
  }

  return (
    <form className="flex flex-col gap-1.5 border-b border-line py-1.5 text-sm" onSubmit={submit} noValidate>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="shrink-0">
          表示名
        </label>
        <Input
          ref={inputRef}
          id={id}
          className="min-h-11 flex-1"
          value={name}
          autoFocus
          autoComplete="nickname"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-msg` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" variant="ghost" size="icon" aria-label="保存する" disabled={save.isPending}>
          <Check />
        </Button>
        <Button variant="ghost" size="icon" className="-mr-2.5" aria-label="やめる" onClick={cancel} disabled={save.isPending}>
          <X />
        </Button>
      </div>
      {error && (
        <FieldMessage id={`${id}-msg`} error>
          {error}
        </FieldMessage>
      )}
    </form>
  );
}
