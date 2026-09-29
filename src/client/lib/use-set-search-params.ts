/**
 * `useSearchParams()` が返す setter を差し替える。連なる 2 回の呼び出しの間に描き直しが挟まらないと、
 * 後の呼び出しが前の呼び出しを巻き戻す(react-router の `searchParams` が、前の描き直し時点の値のまま
 * 固まっているため。react-router 8 の `useSearchParams` の実装(lib/dom/lib.js)を見ると、setter は
 * フックが持つ `searchParams` の使い回しのコピーに対して更新するだけで、呼ぶたびに URL を読み直さない)。
 *
 * 一覧の行を直すシートは、作るシートを閉じる動き(0044、0093 で新しい見た目が長くなった)の途中でも
 * 押せる。閉じる動きが終わってから作るシートが URL から自分の印(`create`)を消すのと、直すシートを
 * 開く印(`edit`)を足すのが競り、どちらか遅い方がもう一方を消してしまうことがある。issue #274
 *
 * 呼ぶたびに `window.location.search` を直に読むので、他の呼び出しが先に history を書き換えていても
 * 取りこぼさない。読む方(`params`)はこれまでどおり `useSearchParams()` を使ってよい。
 */
import { useCallback } from "react";
import { useNavigate } from "react-router";

export function useSetSearchParams() {
  const navigate = useNavigate();
  return useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      navigate(`?${params.toString()}`, { replace: true });
    },
    [navigate],
  );
}
