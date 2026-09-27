/**
 * 新しい版を出したら、開き直さなくても画面を切り替える。F-41、0073
 *
 * VitePWA の autoUpdate は、新しい Service Worker を裏で待たせてから画面の制御を引き継ぐ
 * (controllerchange)。けれど開いている画面の JavaScript は前の版のまま動き続け、iPhone の
 * ホーム画面から開く形では、完全に閉じて開き直すまでずっと前の版のままになる。
 *
 * controllerchange を受けたら読み込み直す。ただし、シートを開いて入力の途中に読み込み直すと
 * 書いたものが消えるので、シートを閉じるかアプリに戻ってきた(visibilitychange)ときまで延ばす。
 * 延ばすかどうかの判定は、このファイルへ 1 か所にまとめる。0073
 */

import { toast } from "sonner";

/** 開いている ResponsiveSheet の数 */
let openSheets = 0;
/** シートが開いている間に、フォームの入力欄へ触れたか */
let touchedWhileOpen = false;
/** controllerchange を受けたが、まだ読み込み直せていないか */
let reloadPending = false;

/** いま読み込み直すと、開いているシートの入力中の内容が消えるか */
function isMidInput(): boolean {
  return openSheets > 0 && touchedWhileOpen;
}

/** 読み込み直した後、新しい版になったことを 1 回だけ知らせるための印 */
const TOAST_KEY = "logru:pwa-update-toast-pending";

function reloadNow(): void {
  try {
    sessionStorage.setItem(TOAST_KEY, "1");
  } catch {
    // 置けない環境では、知らせを出さないまま切り替える
  }
  window.location.reload();
}

/** 延ばしていた読み込み直しがあれば、いま入力の途中でなければ行う */
function flushPendingReload(): void {
  if (reloadPending && !isMidInput()) reloadNow();
}

/**
 * ResponsiveSheet が開いている間、呼ぶ。閉じたら、返した関数を呼ぶ。
 * @returns 閉じたときに呼ぶ関数
 */
export function sheetOpened(): () => void {
  openSheets += 1;
  return () => {
    openSheets = Math.max(0, openSheets - 1);
    if (openSheets === 0) {
      touchedWhileOpen = false;
      flushPendingReload();
    }
  };
}

function isFormField(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * 新しい版を受け持ったら読み込み直す仕組みを始める。main.tsx で 1 度だけ呼ぶ。
 * 読み込み直した直後なら、下に小さく知らせを 1 回出す。
 */
export function listenAutoUpdate(): void {
  // <Toaster /> はこの後で描かれる。先に呼ぶと、まだ誰も聞いていない知らせを取りこぼすので、
  // 描き終わってから出す
  window.setTimeout(() => {
    try {
      if (sessionStorage.getItem(TOAST_KEY)) {
        sessionStorage.removeItem(TOAST_KEY);
        toast("新しい版にしました");
      }
    } catch {
      // 読めない環境では知らせを出さない
    }
  }, 0);

  if (!("serviceWorker" in navigator)) return;

  // シートが開いている間にフォームの入力欄へ触れたら、入力の途中とみなす
  document.addEventListener(
    "input",
    (e) => {
      if (openSheets > 0 && isFormField(e.target)) touchedWhileOpen = true;
    },
    true,
  );

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadPending = true;
    flushPendingReload();
  });

  // アプリに戻ってきたら、延ばしていた読み込み直しを行い、新しい版が無いかも確かめる
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    flushPendingReload();
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
  });
}
