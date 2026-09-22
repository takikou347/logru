import { type User, onIdTokenChanged, signOut as firebaseSignOut } from "firebase/auth";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { clearApiCache } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { queryClient } from "@/lib/queries";

/** ログインの状態 */
export type AuthState = {
  /** Firebase の利用者。ログインしていなければ null */
  user: User | null;
  /** Firebase が前回のログインを読み終えたか。読み終えるまでは画面を出さない */
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, ready: false });

/** ログインの状態を配る。アプリの一番外側に置く */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: auth.currentUser, ready: false });
  useEffect(
    () =>
      // トークンが更新されたときにも呼ばれる。確かめたメールアドレスの反映もこれで拾う
      onIdTokenChanged(auth, (user) => setState({ user, ready: true })),
    [],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** いまのログインの状態を返す */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * ログアウトする。端末に残した API の控えと、読み込んだデータも消す。
 * 共有の端末で、前の人の予定が見えないようにする。
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  await clearApiCache();
  queryClient.clear();
}

/** メールとパスワードで登録し、まだメールアドレスを確かめていないか */
export function needsEmailVerification(user: User | null): boolean {
  return Boolean(user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password"));
}
