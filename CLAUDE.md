# CLAUDE.md

Logru(カレンダーが土台のアプリ)のコード。

## 始める前に

要件、設計、決めたことは develop-docs の `docs/logru/` にある。実装の前に読む。
このリポジトリの中に無ければ探しに行く。

## 規約

コードの書き方(ファイル名、置き場所、API の呼び出し、依存の向き、コメントの書き方、
コミットの形、テスト)は [CONTRIBUTING.md](CONTRIBUTING.md) にある。

## 動かし方

`pnpm install`、`pnpm dev`、テストの流し方は [README.md](README.md) にある。

## エミュレーターの癖

Firebase Auth エミュレーター(9099)は、`pnpm dev` や `pnpm e2e` を始めるとき既に立ち上がっていれば
そのまま使う。新しく立ち上げることはしない。

登録した利用者はエミュレーターに残り続ける。何度もテストを流して利用者がたまり、Google の
ログイン窓の一覧が長くなって遅く感じたら、`kill $(lsof -ti tcp:9099 -sTCP:LISTEN)` で止めて
立ち上げ直す。
