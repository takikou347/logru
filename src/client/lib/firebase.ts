/**
 * Firebase の初期化。ログインは Firebase に任せ、データは D1 に置く。
 *
 * 設定は Vite の環境変数から読む。手元の開発と E2E テストでは Auth エミュレーターにつなぐ。
 * Web 用の設定は公開されてよい値で、秘密ではない。
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, GoogleAuthProvider, getAuth } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

/** Firebase Authentication の窓口 */
export const auth = getAuth(app);
auth.languageCode = "ja";

const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });

/** エミュレーターにつないでいるか。開発用ログインを出すかの判断に使う */
export const usingEmulator = Boolean(emulator);

/** Google でログインするときの設定。毎回アカウントを選ばせる */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
