/**
 * 明るさ、背景のテーマ、テーマカラー。html の data-theme、data-bg-theme、data-accent に当て、
 * CSS の変数が切り替わる。選んだ設定は端末にも覚えさせ、public/theme-boot.js が描画の前に当てる。0012、#50
 */
import type { BgTheme, ThemeMode } from "@shared/api-types";

const KEY = "logru-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

type Stored = { mode: ThemeMode; bgTheme: BgTheme; accent: string };

/**
 * 背景のテーマの既定。端末の「透明度を下げる」が有効なら平ら、それ以外はガラス。
 * 選んだ値が無いときだけ使う。一度選んだ値(既定として決めた値も含む)は、そのまま覚えさせる。#95
 */
function defaultBgTheme(): BgTheme {
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches ? "flat" : "glass";
}

/** 端末に覚えさせた設定を読む。読めなければ、端末に合わせる */
export function readStoredTheme(): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Stored> | null;
    if (v && typeof v.mode === "string")
      return { mode: v.mode, bgTheme: v.bgTheme ?? defaultBgTheme(), accent: v.accent ?? "aizumi" };
  } catch {
    // 読めなければ既定に戻す
  }
  return { mode: "system", bgTheme: defaultBgTheme(), accent: "aizumi" };
}

/** 端末に合わせる設定を、ライトかダークに決める */
function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return media().matches ? "dark" : "light";
  return mode;
}

/**
 * html に明るさ、背景のテーマ、テーマカラーを付け、端末にも覚えさせる。
 * @param mode 端末に合わせる、ライト、ダーク
 * @param bgTheme 背景のテーマ。glass はガラス、flat は平ら。
 *   Service Worker が古い `/api/me` の返事を出すことがあり、そのときは項目自体が無い。
 *   その場合は端末の「透明度を下げる」に合わせた既定にし、`data-bg-theme` が文字の "undefined" にならないようにする。#63、#95
 * @param accent テーマカラーの名前
 */
export function applyTheme(mode: ThemeMode, bgTheme: BgTheme | undefined, accent: string): void {
  const resolvedBgTheme = bgTheme ?? defaultBgTheme();
  const root = document.documentElement;
  const resolved = resolve(mode);
  root.dataset.theme = resolved;
  root.dataset.bgTheme = resolvedBgTheme;
  root.dataset.accent = accent;
  root.dataset.themeMode = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#10151c" : "#e6ece8");
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode, bgTheme: resolvedBgTheme, accent } satisfies Stored));
  } catch {
    // 保存できなくても表示は変わる
  }
}

/**
 * 端末に合わせる設定のとき、端末の明るさが変わったら追いかける。
 * @returns 追いかけるのをやめる関数
 */
export function watchSystemTheme(): () => void {
  const m = media();
  const onChange = () => {
    const { mode, bgTheme, accent } = readStoredTheme();
    if (mode === "system") applyTheme(mode, bgTheme, accent);
  };
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
