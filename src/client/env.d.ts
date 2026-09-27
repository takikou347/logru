/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Firebase の Web 用の設定。公開されてよい値 */
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** 入っていれば Auth エミュレーターにつなぐ。手元の開発と E2E テストだけ */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  /** `off` なら画面の案内を出さない。E2E テストだけ。案内の吹き出しがほかの操作を隠さないように。F-33 */
  readonly VITE_TOURS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 組み立てたときの git の短い SHA。vite.config.ts の define で埋める。手元の開発では "dev"。0040 */
declare const __APP_VERSION__: string;

declare module "*.md?raw" {
  const content: string;
  export default content;
}
