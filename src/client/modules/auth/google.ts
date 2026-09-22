import { FirebaseError } from "firebase/app";
import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

/**
 * Google でログインする。まず小さな窓を開き、窓が止められたら画面ごと移る。
 * 初めての人は、そのまま登録になる。
 * @throws Firebase の失敗。画面は authErrorMessage で文にする
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e instanceof FirebaseError && e.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw e;
  }
}
