/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Firebase の Web 用の設定。公開されてよい値 */
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** 入っていれば Auth エミュレーターにつなぐ。手元の開発と E2E テストだけ */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
