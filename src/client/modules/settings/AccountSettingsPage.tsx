import type { GroupSummary, Me } from "@shared/api-types";
import { profileInput } from "@shared/schemas";
import { Check, Pencil, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe, useSetUsualShare } from "@/api/common";
import { Loading } from "@/app/guards";
import { useSignOut } from "@/components/layout/AppLayout";
import { FieldMessage, Panel, PanelRow } from "@/components/parts/Panel";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { poolColorsOf } from "../calendar/model";
import { useUpdateName } from "./api";
import { DeleteAccountSheet } from "./components/DeleteAccountSheet";
import { SettingsShell } from "./components/SettingsShell";

/** ログインに使った手段の、画面での名前 */
const PROVIDER_LABELS: Record<string, string> = { "google.com": "Google", password: "メールとパスワード" };

/**
 * 設定の「アカウント」。表示名、メールアドレス、ログインの方法、いつもの共有先、規約、ログアウト、アカウントを消す。
 * F-16、F-17、0063、F-40
 */
export function AccountSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const doSignOut = useSignOut();
  const [deleting, setDeleting] = useState(false);

  if (!me.data) return <Loading />;
  const data = me.data;
  const list = groups.data ?? [];

  return (
    <SettingsShell title="アカウント" poolColors={poolColorsOf(list, data)}>
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

      {list.length > 0 && <UsualShareSection me={data} groups={list} />}

      {/* ページの背景に直に置くので、ガラスの面より少し濃い朱にして比を保つ。issue #154、0034 */}
      <Button variant="danger" className="self-start text-(--sun-deep)" onClick={() => setDeleting(true)}>
        アカウントを消す
      </Button>

      {deleting && <DeleteAccountSheet provider={data.provider} onClose={() => setDeleting(false)} />}
    </SettingsShell>
  );
}

/**
 * いつもの共有先。予定や思い出などを足すときに、最初から選んでおくグループ。0063、F-40
 * 選べるのは「共有しない」と、入っているグループ。押してすぐ画面に効かせる
 */
function UsualShareSection({ me, groups }: { me: Me; groups: GroupSummary[] }) {
  const setUsual = useSetUsualShare();
  const personal = groups.find((g) => g.isPersonal);
  const value = me.settings.usualShareGroupId ?? personal?.id ?? "";

  return (
    <Panel title="いつもの共有先">
      <FieldMessage>予定や思い出などを足すとき、最初から選んでおくグループです。</FieldMessage>
      <SharePickerRow
        groups={groups}
        me={me}
        value={value}
        onChange={(id) => setUsual.mutate(personal && id === personal.id ? null : id)}
      />
    </Panel>
  );
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
          <Button
            ref={pencilRef}
            variant="ghost"
            size="icon"
            className="-mr-2.5"
            aria-label="表示名を変える"
            onClick={open}
          >
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
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2.5"
          aria-label="やめる"
          onClick={cancel}
          disabled={save.isPending}
        >
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
