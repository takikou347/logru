import { useRef, useState } from "react";

/**
 * 送るシート(`ResponsiveSheet` を使う、作る・直すシート)が持つ骨組みをまとめる。0081、issue #207
 *
 * `open`・`busy`・`error` を持ち、`submit` に渡した関数を try/catch で包む。送信中は `busy` を立て、
 * 失敗したら `error` に文を入れる。成功したら閉じ始める(`keepOpen` を渡すと閉じない。続けて記録するときに使う)。
 *
 * `open` は `ResponsiveSheet` にそのまま渡す。閉じる動きは `ResponsiveSheet` に任せ、動きが終わったら
 * `handleClosed` が渡された `onClose` を呼ぶ。0077
 *
 * `closeAndThen` は「消す」のように、閉じる動きが終わってから何かをするときに使う。動きの途中で
 * 元に戻す通知などを出すと描かれないことがあるため。0077 の「困ること」、0079
 *
 * @param onClose 閉じる動きが終わったら呼ぶ、呼び出し側の後片付け
 */
export function useSheetSubmit(onClose: () => void) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 閉じ始めた時点で覚えておき、動きが終わってから実行する
  const afterClose = useRef<(() => void) | null>(null);

  /** 閉じ始める。Esc・外側・X を押したときと、「やめる」を押したときの両方から呼ぶ */
  function close() {
    setOpen(false);
  }

  /** 閉じ始め、動きが終わったら渡した関数を呼ぶ。「消す」のときに使う */
  function closeAndThen(run: () => void) {
    afterClose.current = run;
    setOpen(false);
  }

  /** `ResponsiveSheet` の `onClose` に渡す。閉じる動きが終わった瞬間に 1 回だけ呼ばれる */
  function handleClosed() {
    onClose();
    const pending = afterClose.current;
    afterClose.current = null;
    pending?.();
  }

  /**
   * 送る。失敗を `error` に文で残し、送信中は `busy` を立てる。成功したら閉じ始める。
   * @param fn 実際に送る処理。保存の呼び出しと、成功したときの知らせ(toast)まで含める
   * @param options.keepOpen 成功してもシートを閉じない。続けて記録するときに使う
   */
  async function submit(fn: () => Promise<void>, options?: { keepOpen?: boolean }) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      if (!options?.keepOpen) close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { open, busy, error, setError, submit, close, closeAndThen, handleClosed };
}
