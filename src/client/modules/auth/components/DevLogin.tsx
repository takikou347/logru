import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { OrDivider } from "@/components/layout/AuthShell";
import { Field } from "@/components/parts/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { forgetAgreement, rememberAgreement } from "../pending-agreement";

const DEV_PASSWORD = "dev-password-123";

/**
 * エミュレーターの利用者のメールアドレスを、確かめたことにする。エミュレーターの管理用の API を使う。
 * 本物の Firebase には届かない。
 */
async function markVerified(uid: string): Promise<void> {
  const base = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  await fetch(`${base}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
}

/**
 * 開発用ログイン。Firebase のエミュレーターにつないでいるときだけ出す。
 *
 * メールアドレスと表示名だけで入れる。初めてのアドレスなら作り、確かめたことにして、規約にも同意する。
 * アプリ内ブラウザでの確認と、E2E テストで使う。本番の組み立てでは、エミュレーターの設定が無いので出ない。
 *
 * @param onDone 入れたとき
 */
export function DevLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("kota@example.com");
  const [name, setName] = useState("kota");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // ログインした瞬間に画面が移るので、同意は先に覚えておく
    rememberAgreement(email);
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, email, DEV_PASSWORD);
      } catch {
        cred = await createUserWithEmailAndPassword(auth, email, DEV_PASSWORD);
        await updateProfile(cred.user, { displayName: name });
      }
      if (!cred.user.emailVerified) {
        await markVerified(cred.user.uid);
        await cred.user.reload();
        await cred.user.getIdToken(true);
      }
      onDone();
    } catch (err) {
      forgetAgreement();
      setError(`開発用ログインに失敗しました。エミュレーターが動いているか確かめてください。${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} aria-label="開発用ログイン">
      <OrDivider>開発用。エミュレーターのときだけ出る</OrDivider>
      <Field label="開発用のメールアドレス">
        {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label="開発用の表示名" error={error}>
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" disabled={busy || !email || !name}>
        開発用にログイン
      </Button>
    </form>
  );
}
