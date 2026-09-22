import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { signOut } from "@/app/auth";
import { Notice } from "@/components/layout/AuthShell";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth, googleProvider } from "@/lib/firebase";
import { useDeleteAccount, useDeletionCheck } from "./api";

const CONFIRM_WORD = "削除する";

/**
 * アカウントを消すシート。F-20
 *
 * 次の順に進める。途中で失敗したら、そこで止める。
 *
 * 1. 消せるかをサーバーに聞く。ほかに管理者がいないグループがあれば止める
 * 2. ログインし直してもらう。Firebase は、少し前にログインした人しか消させない
 * 3. D1 の自分のデータを消す
 * 4. Firebase のアカウントを消す
 *
 * D1 を先に消す。Firebase を先に消して D1 で失敗すると、誰も消せないデータが残るため。
 * 逆に 4 で失敗しても、次にログインしたときは新しい人として始まるだけで済む。
 *
 * @param provider ログインに使った手段。`password` ならパスワードを聞き、`google.com` なら Google の窓を開く
 */
export function DeleteAccountSheet({ provider, onClose }: { provider: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useDeletionCheck();
  const deleteAccount = useDeleteAccount();
  const usesPassword = provider === "password";

  /** ログインし直す。失敗したら例外を投げる */
  async function reauthenticate() {
    const user = auth.currentUser;
    if (!user) throw new Error("ログインし直してください。");
    if (usesPassword) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
    } else {
      await reauthenticateWithPopup(user, googleProvider);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reauthenticate();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
      return;
    }
    try {
      await deleteAccount.mutateAsync(confirm);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      return;
    }
    const user = auth.currentUser;
    if (user) await deleteUser(user).catch(() => undefined);
    await signOut();
    toast("アカウントを消しました");
    navigate("/login", { replace: true });
  }

  const blocked = check.data && !check.data.ok;

  return (
    <ResponsiveSheet title="アカウントを消す" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <FieldMessage>
          消すと、自分の予定と設定が消え、元に戻せません。グループに共有した予定はグループに残ります。ほかに管理者がいないグループがあると、先に管理者を渡す必要があります。
        </FieldMessage>
        {blocked && <Notice error>{check.data.message}</Notice>}
        <Field label={`確認のため「${CONFIRM_WORD}」と入れてください`}>
          {(p) => <Input {...p} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        {usesPassword ? (
          <Field label="パスワード" hint="本人か確かめるため、もう一度入れてください。">
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        ) : (
          <FieldMessage>本人か確かめるため、消す前に Google の画面が開きます。</FieldMessage>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={busy || check.isPending || blocked || confirm !== CONFIRM_WORD || (usesPassword && !password)}
          >
            アカウントを消す
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
