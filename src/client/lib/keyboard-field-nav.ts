import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { DATE_LIKE_INPUT_TYPES } from "@/lib/date-like-inputs";

/**
 * キーボードの帯の「前の欄」「次の欄」、Enter キーでの「次へ」が対象にする欄。0094、issue #242
 *
 * ラジオボタン代わりの `Chip`(`<button role="radio">`)やスイッチは含めない。「前の欄・次の欄」は
 * 文字や数字を打つ欄を移るためのもので、選ぶだけの操作は含めない方が迷わない。
 */
const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)';

/** form の中で、いま画面に出ている(非表示でない)欄を、DOM の順で返す */
function focusableFormFields(form: HTMLFormElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
}

/** a が b より DOM で前にあるか */
function isBefore(a: Node, b: Node): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * いまフォーカスしている場所から、1 つ前・1 つ次の欄へ移す。端では何もしない(押しても跳ねない)。
 *
 * フォーカスが欄(`fields`)そのものではなく、カテゴリの `Chip` のようなラジオボタンにあるときも、
 * DOM の順でいちばん近い欄を探す。「次の欄」を押した直後にカテゴリを選び、続けて「次の欄」を
 * 押しても、先頭の欄へ戻らないようにするため。
 * @param dir 1 で次へ、-1 で前へ
 */
export function focusAdjacentField(form: HTMLFormElement, dir: 1 | -1): void {
  const fields = focusableFormFields(form);
  if (fields.length === 0) return;
  const active = document.activeElement;
  const from = active instanceof HTMLElement && form.contains(active) ? active : null;
  const target =
    dir === 1
      ? fields.find((f) => !from || isBefore(from, f))
      : [...fields].reverse().find((f) => !from || isBefore(f, from));
  if (!target) return;
  target.focus();
  target.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * 文字の欄で Enter(OS のキーボードの「次へ」)を押したとき、送信の代わりに次の欄へ移す。0094、issue #242
 *
 * OS のキーボードが出ているとき(`data-keyboard-open`)だけ働く。出ていなければ何もせず、
 * これまでどおり Enter で送信する(既存の動きと E2E を変えないため)。
 * 複数行の `<textarea>`、日付・時刻の欄(ネイティブな選択 UI に Enter を任せる)、日本語の変換中の
 * Enter(確定)では発動しない。最後の欄では発動せず、ブラウザの既定の送信(「完了」)に任せる。
 *
 * `<form onKeyDown={handleEnterAdvancesField}>` として使う。
 */
export function handleEnterAdvancesField(e: ReactKeyboardEvent<HTMLFormElement>): void {
  if (e.key !== "Enter") return;
  // その欄自身が既に Enter を処理している(よく使う記録の名前を残す、など)なら、ここでは何もしない
  if (e.defaultPrevented) return;
  if (e.nativeEvent.isComposing) return;
  if (!document.documentElement.hasAttribute("data-keyboard-open")) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
  if (target instanceof HTMLInputElement && DATE_LIKE_INPUT_TYPES.has(target.type)) return;
  const form = e.currentTarget;
  const fields = focusableFormFields(form);
  const idx = fields.indexOf(target);
  if (idx === -1 || idx >= fields.length - 1) return;
  const next = fields[idx + 1];
  if (!next) return;
  e.preventDefault();
  next.focus();
  next.scrollIntoView({ block: "center", behavior: "smooth" });
}
