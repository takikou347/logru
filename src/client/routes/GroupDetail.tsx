import "../styles/app.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ExtensionInfo, GroupMember, GroupSummary } from "../../shared/api-types";
import { GROUP_COLORS } from "../../shared/colors";
import { poolColorsOf } from "../calendar/model";
import { api } from "../lib/api";
import { groupColor, memberColor } from "../lib/colors";
import { useColorPref } from "../lib/mutations";
import { keys, useGroups, useMe } from "../lib/queries";
import { AppLayout, PageBar } from "../ui/AppLayout";
import { ColorSheet } from "../ui/ColorSheet";
import { Field, Swatches, Toggle } from "../ui/controls";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

type Invite = { url: string; expiresAt: number };

export function GroupDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const groups = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const colorPref = useColorPref();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [colorTarget, setColorTarget] = useState<{ type: "group" | "user"; id: string; title: string; fallback: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const group = groups.data?.find((g) => g.id === id);
  const extensions = useQuery({
    queryKey: ["extensions", id],
    queryFn: () => api<{ extensions: ExtensionInfo[] }>(`/groups/${id}/extensions`).then((r) => r.extensions),
    enabled: Boolean(group),
  });

  if (groups.isPending || me.isPending) return <div className="loading">読み込んでいます</div>;
  if (!group || !me.data) {
    return (
      <AppLayout poolColors={poolColorsOf(groups.data ?? [], me.data)}>
        <div className="page">
          <PageBar title="グループ" back="/groups" />
          <p className="empty">グループが見つかりません。抜けたか、消えています。</p>
          <Link to="/groups">グループの一覧へ</Link>
        </div>
      </AppLayout>
    );
  }
  const myId = me.data.user.id;
  const prefs = me.data.colorPrefs;
  const admin = group.role === "admin";
  const shown = groupColor(group, prefs);

  async function run<T>(fn: () => Promise<T>, done?: string) {
    try {
      const result = await fn();
      await qc.invalidateQueries({ queryKey: keys.groups });
      if (done) toast({ message: done });
      return result;
    } catch (e) {
      toast({ message: (e as Error).message, tone: "error" });
      return undefined;
    }
  }

  async function makeInvite() {
    const r = await run(() => api<Invite>(`/groups/${id}/invites`, { method: "POST" }));
    if (r) setInvite(r);
  }

  async function share() {
    if (!invite || !group) return;
    const text = `Logru の「${group.name}」に招待します。7 日のうちに開いてください。`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Logru への招待", text, url: invite.url });
        return;
      } catch {
        // 閉じられたらコピーに回さない
        return;
      }
    }
    await copy();
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast({ message: "招待リンクをコピーしました" });
    } catch {
      toast({ message: "コピーできませんでした。リンクを長押しして、コピーしてください。", tone: "error" });
    }
  }

  async function leave() {
    try {
      await api(`/groups/${id}/members/me`, { method: "DELETE" });
    } catch (e) {
      setConfirmLeave(false);
      toast({ message: (e as Error).message, tone: "error" });
      return;
    }
    await qc.invalidateQueries();
    toast({ message: "グループを抜けました" });
    navigate("/groups", { replace: true });
  }

  return (
    <AppLayout poolColors={[shown, ...poolColorsOf(groups.data ?? [], me.data).filter((c) => c !== shown)]} poolFocus={0}>
      <div className="page">
        <PageBar title={group.isPersonal ? "自分" : group.name} back="/groups" />

        {!group.isPersonal && admin && <RenameForm group={group} onSaved={() => toast({ message: "名前を変えました" })} />}

        <section className="panel glass">
          <h2>色</h2>
          <button
            type="button"
            className="row-btn"
            onClick={() => setColorTarget({ type: "group", id: group.id, title: "自分の画面での色", fallback: group.color })}
          >
            <span className={`dot c-${shown}`} aria-hidden="true" />
            <span className="grow">自分の画面での色</span>
            <span className="note">{prefs.some((p) => p.targetType === "group" && p.targetId === group.id) ? "自分だけ変えた" : "グループの色のまま"}</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
          {!group.isPersonal && admin && (
            <div className="field">
              <span className="label">グループの色。まだ色を選んでいないメンバー全員に出ます</span>
              <Swatches
                label="グループの色"
                value={group.color}
                options={GROUP_COLORS}
                onChange={(color) => run(() => api(`/groups/${id}`, { method: "PATCH", body: { color } }), "グループの色を変えました")}
              />
            </div>
          )}
          {group.isPersonal && <p className="hint">自分だけのグループの色は、設定の「自分の色」で変わります。</p>}
        </section>

        {!group.isPersonal && (
          <section className="panel glass" aria-label="メンバー">
            <h2>メンバー</h2>
            <div>
              {group.members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  me={m.id === myId}
                  color={memberColor(m.id, m.userColor, prefs)}
                  canManage={admin && !(m.role === "admin" && group.members.filter((x) => x.role === "admin").length === 1)}
                  onColor={() => setColorTarget({ type: "user", id: m.id, title: `${m.name} の色`, fallback: m.userColor })}
                  onRole={(role) =>
                    run(
                      () => api(`/groups/${id}/members/${m.id}`, { method: "PATCH", body: { role } }),
                      role === "admin" ? `${m.name} を管理者にしました` : `${m.name} をメンバーに戻しました`,
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}

        {!group.isPersonal && admin && (
          <section className="panel glass">
            <h2>招待</h2>
            {invite ? (
              <>
                <p className="hint">このリンクを開いた人は、7 日のうちならグループに入れます。招待したい相手にだけ送ってください。</p>
                <input className="input" readOnly value={invite.url} aria-label="招待リンク" onFocus={(e) => e.target.select()} />
                <div className="wrap">
                  <button type="button" className="btn primary" onClick={share}>
                    送る
                  </button>
                  <button type="button" className="btn glassy" onClick={copy}>
                    コピーする
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn glassy" style={{ alignSelf: "flex-start" }} onClick={makeInvite}>
                招待リンクを作る
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              style={{ alignSelf: "flex-start" }}
              onClick={() => run(() => api(`/groups/${id}/invites`, { method: "DELETE" }), "招待リンクをすべて取り消しました").then(() => setInvite(null))}
            >
              招待リンクをすべて取り消す
            </button>
          </section>
        )}

        <section className="panel glass">
          <h2>拡張機能</h2>
          <div className="line">
            <span>予定</span>
            <Toggle checked label="予定。いつも使えます" disabled onChange={() => {}} />
          </div>
          {extensions.data && extensions.data.length > 0 ? (
            extensions.data.map((x) => (
              <div className="line" key={x.key}>
                <span>
                  {x.label}
                  <br />
                  <span className="hint">{x.description}</span>
                </span>
                <Toggle
                  checked={x.enabled}
                  label={x.label}
                  disabled={!admin}
                  onChange={(enabled) =>
                    run(() => api(`/groups/${id}/extensions/${x.key}`, { method: "PUT", body: { enabled } })).then(() =>
                      qc.invalidateQueries({ queryKey: ["extensions", id] }),
                    )
                  }
                />
              </div>
            ))
          ) : (
            <div className="empty">
              足せる拡張はまだありません。
              <br />
              予定はいつも使えます。
            </div>
          )}
        </section>

        {!group.isPersonal && (
          <button type="button" className="btn danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmLeave(true)}>
            グループを抜ける
          </button>
        )}
      </div>

      {colorTarget && (
        <ColorSheet
          title={colorTarget.title}
          value={
            prefs.find((p) => p.targetType === colorTarget.type && p.targetId === colorTarget.id)?.color ??
            (colorTarget.type === "group" ? group.color : colorTarget.fallback)
          }
          isCustom={prefs.some((p) => p.targetType === colorTarget.type && p.targetId === colorTarget.id)}
          onPick={(color) => colorPref.mutate({ type: colorTarget.type, id: colorTarget.id, color })}
          onReset={() => colorPref.mutate({ type: colorTarget.type, id: colorTarget.id, color: null })}
          onClose={() => setColorTarget(null)}
        />
      )}
      {confirmLeave && (
        <Sheet title="グループを抜けますか" onClose={() => setConfirmLeave(false)}>
          <p className="hint">
            抜けると、このグループの予定が見えなくなります。自分が足した予定は、グループに残ります。もう一度入るには、招待リンクが要ります。
          </p>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setConfirmLeave(false)}>
              やめる
            </button>
            <button type="button" className="btn primary" onClick={leave}>
              抜ける
            </button>
          </div>
        </Sheet>
      )}
    </AppLayout>
  );
}

function MemberRow({
  member,
  me,
  color,
  canManage,
  onColor,
  onRole,
}: {
  member: GroupMember;
  me: boolean;
  color: string;
  canManage: boolean;
  onColor: () => void;
  onRole: (role: "admin" | "member") => void;
}) {
  return (
    <div className="row-btn" style={{ cursor: "default" }}>
      <button type="button" className={`swatch c-${color}`} aria-label={`${member.name} の色を変える`} onClick={onColor} />
      <span className="grow">
        {member.name}
        {me && "（自分）"}
      </span>
      <span className="note">{member.role === "admin" ? "管理者" : "メンバー"}</span>
      {canManage && (
        <button
          type="button"
          className="btn ghost"
          style={{ minHeight: 40, padding: "0 10px", fontSize: 13 }}
          onClick={() => onRole(member.role === "admin" ? "member" : "admin")}
        >
          {member.role === "admin" ? "メンバーに戻す" : "管理者にする"}
        </button>
      )}
    </div>
  );
}

function RenameForm({ group, onSaved }: { group: GroupSummary; onSaved: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/groups/${group.id}`, { method: "PATCH", body: { name } });
      await qc.invalidateQueries({ queryKey: keys.groups });
      setError(null);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form className="panel glass" onSubmit={submit} noValidate>
      <h2>名前</h2>
      <Field label="グループの名前" error={error}>
        {(p) => <input {...p} className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <button type="submit" className="btn glassy" style={{ alignSelf: "flex-start" }} disabled={!name.trim() || name === group.name}>
        名前を変える
      </button>
    </form>
  );
}
