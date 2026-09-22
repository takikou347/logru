/** グループの画面(GroupsPage、GroupDetailPage、InvitePage)が使う API の hook */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExtensionInfo, GroupSummary, InviteInfo } from "@shared/api-types";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

type Invite = { url: string; expiresAt: number };

/** グループごとの読み込みキー。このファイルの hook だけが使う */
const groupKeys = {
  extensions: (groupId: string) => ["extensions", groupId] as const,
  invite: (token: string) => ["invite", token] as const,
};

/** グループを作る。作ったグループの ID を返す */
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<GroupSummary>("/groups", { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** グループの名前を変える */
export function useRenameGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api(`/groups/${groupId}`, { method: "PATCH", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** グループの色を変える */
export function useUpdateGroupColor(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (color: string) => api(`/groups/${groupId}`, { method: "PATCH", body: { color } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** メンバーの役割(管理者・メンバー)を変える */
export function useUpdateMemberRole(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: "admin" | "member" }) =>
      api(`/groups/${groupId}/members/${memberId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** グループを抜ける。カレンダーなど全部を読み直す */
export function useLeaveGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/groups/${groupId}/members/me`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** 招待リンクを作る */
export function useCreateInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Invite>(`/groups/${groupId}/invites`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** グループの招待リンクをすべて取り消す */
export function useRevokeInvites(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/groups/${groupId}/invites`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** グループで拡張機能の一覧と、有効かどうかを読む */
export function useGroupExtensions(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.extensions(groupId),
    queryFn: () => api<{ extensions: ExtensionInfo[] }>(`/groups/${groupId}/extensions`).then((r) => r.extensions),
    enabled,
  });
}

/** グループで拡張機能を切り替える */
export function useToggleGroupExtension(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api(`/groups/${groupId}/extensions/${key}`, { method: "PUT", body: { enabled } }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.groups }), qc.invalidateQueries({ queryKey: groupKeys.extensions(groupId) })]),
  });
}

/** 招待リンクの中身を読む。ログインしていなくても読める */
export function useInviteInfo(token: string) {
  return useQuery({ queryKey: groupKeys.invite(token), queryFn: () => api<InviteInfo>(`/invites/${token}`) });
}

/** 招待を受けてグループに入る。入った後は全部を読み直す */
export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ groupId: string }>(`/invites/${token}/accept`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
