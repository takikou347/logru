/**
 * 明るさとテーマカラー。html の data-theme と data-accent に当て、CSS の変数が切り替わる。
 * 選んだ設定は端末にも覚えさせ、public/theme-boot.js が描画の前に当てる。0012
 */
import type { ThemeMode } from "@shared/api-types";

const KEY = "logru-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

type Stored = { mode: ThemeMode; accent: string };

/** 端末に覚えさせた設定を読む。読めなければ、端末に合わせる */
export function readStoredTheme(): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    if (v && typeof v.mode === "string") return v;
  } catch {
    // 読めなければ既定に戻す
  }
  return { mode: "system", accent: "aizumi" };
}

/** 端末に合わせる設定を、ライトかダークに決める */
function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return media().matches ? "dark" : "light";
  return mode;
}

/**
 * html に明るさとテーマカラーを付け、端末にも覚えさせる。
 * @param mode 端末に合わせる、ライト、ダーク
 * @param accent テーマカラーの名前
 */
export function applyTheme(mode: ThemeMode, accent: string): void {
  const root = document.documentElement;
  const resolved = resolve(mode);
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  root.dataset.themeMode = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#10151c" : "#e6ece8");
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode, accent } satisfies Stored));
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
    const { mode, accent } = readStoredTheme();
    if (mode === "system") applyTheme(mode, accent);
  };
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
