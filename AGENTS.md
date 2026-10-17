# AGENTS.md

Logru(カレンダーが土台のアプリ)のコード。KNOW IDEA の開発部のプロジェクト。Codex(OpenAI)はここで、開発部やデザイン部の Claude から頼まれた案と直しを作る。決めるのは頼んだ Claude。

## 読むもの

- `CLAUDE.md`、`CONTRIBUTING.md`(書き方、置き場所、依存の向き、コミットの形、テスト)、`README.md`(動かし方)
- 見た目は KNOW IDEA UI(takikou347/knowidea-ui の `DESIGN.md`)に合わせる
- 要件と設計は takikou347/develop-docs の `docs/logru/`(頼む文に要点が書かれる)

## 書き方

- 日本語。結論を先に。絵文字を使わない
- ブランチは `develop` から切り、PR も `develop` へ
- 直したら `CONTRIBUTING.md` のテストと検査を通す
- コミットと PR に AI の署名(Co-authored-by、Generated with など)を付けない
