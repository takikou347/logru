# PR #66 のエビデンス

スマホの幅で崩れる UI の、直す前と直した後の画面。

- `before/` … `ad4ff7a`（develop）
- `after/` … `10391d5`（claude/pwa-ui-issues-dysrxl）

どちらも同じ手順で撮った。Chromium、日本語、Asia/Tokyo、2 倍の画素で描き、
登録してカレンダーを開き、次の月（10 月）へ移った状態。

コードは入っていない。PR を閉じたら、このブランチは消してよい。

## review1/

レビュー（[#issuecomment-5777550700](https://github.com/takikou347/logru/pull/66#issuecomment-5777550700)）を受けた `36fecf4` の画面。

- `head-sep-*` / `head-oct-*` … 上の帯だけ。9 月と 10 月で形が変わらないこと
- `full-sep-*` / `full-oct-*` … 画面ぜんたい。下の操作の帯が 1 段のままであること
