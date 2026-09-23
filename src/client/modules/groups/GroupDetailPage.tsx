import type { GroupMember, GroupSummary } from "@shared/api-types";
import { GROUP_COLORS } from "@shared/colors";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useColorPref, useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { InitialAvatar } from "@/components/parts/Avatars";
import { ColorSheet } from "@/components/parts/ColorSheet";
import { ColorSwatches } from "@/components/parts/ColorSwatches";
import { ExtensionToggleRow } from "@/components/parts/ExtensionToggleRow";
import { FailurePanel, LoadFailure } from "@/components/parts/Failure";
import { Field } from "@/components/parts/Field";
import { Dot, Empty, FieldMessage, Panel, PanelRow, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { groupColor, memberColor } from "@/lib/colors";
import { BASE_TOURS } from "@/lib/tours";
import { poolColorsOf } from "../calendar/model";
import {
  useCreateInvite,
  useGroupExtensions,
  useLeaveGroup,
  useRenameGroup,
  useRevokeInvites,
  useToggleGroupExtension,
  useUpdateGroupColor,
  useUpdateMemberRole,
} from "./api";

type Invite = { url: string; expiresAt: number };
type ColorTarget = { type: "group" | "user"; id: string; title: string; fallback: string };

/**
 * グループの詳しい画面。名前、色、メンバー、招待、機能、抜ける。F-10〜F-15、F-19
 * 名前とグループの色と招待と拡張の切り替えは、管理者だけが変えられる。
 * 自分だけのグループを開いたら、一覧へ戻す。0009
 */
export function GroupDetailPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const groups = useGroups();
  const navigate = useNavigate();
  const colorPref = useColorPref();
  const updateColor = useUpdateGroupColor(id);
  const updateRole = useUpdateMemberRole(id);
  const leaveGroup = useLeaveGroup(id);
  const createInvite = useCreateInvite(id);
  const revokeInvites = useRevokeInvites(id);
  const toggleExtension = useToggleGroupExtension(id);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [colorTarget, setColorTarget] = useState<ColorTarget | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const group = groups.data?.find((g) => g.id === id);
  const extensions = useGroupExtensions(id, Boolean(group && !group.isPersonal));

  if (groups.isPending || me.isPending) return <Loading />;
  // 自分だけのグループは、グループとして見せない。直接開いたら一覧へ戻す。0009
  if (group?.isPersonal) return <Navigate to="/groups" replace />;
  if (!group || !me.data) {
    return (
      <AppLayout poolColors={poolColorsOf(groups.data ?? [], me.data)}>
        <Page>
          <PageBar title="グループ" back="/groups" />
          {/* 読めなかったのか、無いのかを分ける。0025 */}
          {groups.error && !groups.data ? (
            <LoadFailure what="グループ" error={groups.error} onRetry={() => void groups.refetch()} />
          ) : (
            <FailurePanel
              mark="?"
              title="グループが見つかりません"
              action={
                <Button asChild variant="secondary">
                  <Link to="/groups">グループの一覧へ</Link>
                </Button>
              }
            >
              抜けたか、管理者が消しました。入り直すには、新しい招待リンクをもらってください。
            </FailurePanel>
          )}
        </Page>
      </AppLayout>
    );
  }
  const myId = me.data.user.id;
  const prefs = me.data.colorPrefs;
  const admin = group.role === "admin";
  const shown = groupColor(group, prefs);
  const adminCount = group.members.filter((m) => m.role === "admin").length;

  /** 変更を送る。成功したら知らせ、失敗したら知らせて undefined を返す */
  async function run<T>(fn: () => Promise<T>, done?: string): Promise<T | undefined> {
    try {
      const result = await fn();
      if (done) toast(done);
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return undefined;
    }
  }

  async function makeInvite() {
    const r = await run(() => createInvite.mutateAsync());
    if (r) setInvite(r);
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast("招待リンクをコピーしました");
    } catch {
      toast.error("コピーできませんでした。リンクを長押しして、コピーしてください。");
    }
  }

  async function leave() {
    try {
      await leaveGroup.mutateAsync();
    } catch (e) {
      setConfirmLeave(false);
      toast.error((e as Error).message);
      return;
    }
    toast("グループを抜けました");
    navigate("/groups", { replace: true });
  }

  const isCustom = (t: ColorTarget) => prefs.some((p) => p.targetType === t.type && p.targetId === t.id);

  return (
    <AppLayout
      poolColors={[shown, ...poolColorsOf(groups.data ?? [], me.data).filter((c) => c !== shown)]}
      poolFocus={0}
    >
      <Page>
        <PageBar title={group.name} back="/groups" />

        {admin && <RenameForm group={group} />}

        <Panel title="色">
          <RowButton
            onClick={() =>
              setColorTarget({ type: "group", id: group.id, title: "自分の画面での色", fallback: group.color })
            }
          >
            <Dot color={shown} className="size-3" />
            <span className="flex-1">自分の画面での色</span>
            <span className="text-xs text-ink-2">
              {isCustom({ type: "group", id: group.id, title: "", fallback: "" })
                ? "自分だけ変えた"
                : "グループの色のまま"}
            </span>
          </RowButton>
          {admin && (
            <div className="flex flex-col gap-2 pt-1">
              <FieldMessage>グループの色。まだ色を選んでいないメンバー全員に出ます</FieldMessage>
              <ColorSwatches
                label="グループの色"
                value={group.color}
                options={GROUP_COLORS}
                onChange={(color) => run(() => updateColor.mutateAsync(color), "グループの色を変えました")}
              />
            </div>
          )}
        </Panel>

        <Panel title="メンバー" aria-label="メンバー">
          <div>
            {group.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.id === myId}
                color={memberColor(m.id, m.userColor, prefs)}
                canManage={admin && !(m.role === "admin" && adminCount === 1)}
                onColor={() =>
                  setColorTarget({ type: "user", id: m.id, title: `${m.name} の色`, fallback: m.userColor })
                }
                onRole={(role) =>
                  run(
                    () => updateRole.mutateAsync({ memberId: m.id, role }),
                    role === "admin" ? `${m.name} を管理者にしました` : `${m.name} をメンバーに戻しました`,
                  )
                }
              />
            ))}
          </div>
        </Panel>

        {admin && (
          <Panel title="招待" data-tour="group-invite">
            {invite ? (
              <>
                <FieldMessage>
                  このリンクを開いた人は、7 日のうちならグループに入れます。招待したい相手にだけ送ってください。
                </FieldMessage>
                <Input readOnly value={invite.url} aria-label="招待リンク" onFocus={(e) => e.target.select()} />
                <Button className="self-start" onClick={copy}>
                  コピーする
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="self-start" onClick={makeInvite}>
                招待リンクを作る
              </Button>
            )}
            <Button
              variant="ghost"
              className="self-start"
              onClick={() =>
                run(() => revokeInvites.mutateAsync(), "招待リンクをすべて取り消しました").then(() => setInvite(null))
              }
            >
              招待リンクをすべて取り消す
            </Button>
          </Panel>
        )}

        <Panel title="機能">
          <PanelRow>
            <span>予定</span>
            <Switch checked disabled aria-label="予定。いつも使えます" />
          </PanelRow>
          {extensions.data && extensions.data.length > 0 ? (
            extensions.data.map((x) => (
              <ExtensionToggleRow
                key={x.key}
                label={x.label}
                sub={x.description}
                checked={x.enabled}
                canToggle={admin}
                pending={toggleExtension.isPending && toggleExtension.variables?.key === x.key}
                onToggle={(enabled) => run(() => toggleExtension.mutateAsync({ key: x.key, enabled }))}
              />
            ))
          ) : (
            <Empty>
              足せる機能はまだありません。
              <br />
              予定はいつも使えます。
            </Empty>
          )}
        </Panel>

        <Button variant="danger" className="self-start" onClick={() => setConfirmLeave(true)}>
          グループを抜ける
        </Button>
      </Page>

      {colorTarget && (
        <ColorSheet
          title={colorTarget.title}
          value={
            prefs.find((p) => p.targetType === colorTarget.type && p.targetId === colorTarget.id)?.color ??
            colorTarget.fallback
          }
          isCustom={isCustom(colorTarget)}
          onPick={(color) => colorPref.mutate({ type: colorTarget.type, id: colorTarget.id, color })}
          onReset={() => colorPref.mutate({ type: colorTarget.type, id: colorTarget.id, color: null })}
          onClose={() => setColorTarget(null)}
        />
      )}
      {confirmLeave && (
        <ResponsiveSheet
          title="グループを抜けますか"
          description="抜けると、このグループの予定が見えなくなります。自分が足した予定は、グループに残ります。もう一度入るには、招待リンクが要ります。"
          onClose={() => setConfirmLeave(false)}
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
              やめる
            </Button>
            <Button onClick={leave}>抜ける</Button>
          </div>
        </ResponsiveSheet>
      )}
      {!colorTarget && !confirmLeave && <ScreenTour id="group" steps={BASE_TOURS.group} />}
    </AppLayout>
  );
}

/**
 * メンバーの 1 行。頭文字か置いた写真のアバターを出す。#40
 * 左下の小さな丸を押すと、自分の画面でのその人の色を変えられる。
 * @param canManage 役割を変えられるか。最後の管理者は外せない
 */
function MemberRow({
  member,
  isMe,
  color,
  canManage,
  onColor,
  onRole,
}: {
  member: GroupMember;
  isMe: boolean;
  color: string;
  canManage: boolean;
  onColor: () => void;
  onRole: (role: "admin" | "member") => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-line text-[15px] last:border-b-0">
      <span className="relative inline-flex flex-none">
        <InitialAvatar person={{ id: member.id, name: member.name, color, avatarUrl: member.avatarUrl }} size={40} />
        <button
          type="button"
          className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-(--c) shadow-[0_0_0_2px_var(--glass-flat)] c-${color}`}
          aria-label={`${member.name} の色を変える`}
          onClick={onColor}
        />
      </span>
      <span className="flex-1">
        {member.name}
        {isMe && "（自分）"}
      </span>
      <span className="text-xs text-ink-2">{member.role === "admin" ? "管理者" : "メンバー"}</span>
      {canManage && (
        <Button variant="ghost" size="sm" onClick={() => onRole(member.role === "admin" ? "member" : "admin")}>
          {member.role === "admin" ? "メンバーに戻す" : "管理者にする"}
        </Button>
      )}
    </div>
  );
}

/** グループの名前を変える。管理者だけに出す */
function RenameForm({ group }: { group: GroupSummary }) {
  const renameGroup = useRenameGroup(group.id);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await renameGroup.mutateAsync(name);
      setError(null);
      toast("名前を変えました");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Panel title="名前">
      <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
        <Field label="グループの名前" error={error}>
          {(p) => <Input {...p} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Button type="submit" variant="secondary" className="self-start" disabled={!name.trim() || name === group.name}>
          名前を変える
        </Button>
      </form>
    </Panel>
  );
}
