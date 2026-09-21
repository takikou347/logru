# Logru

カレンダーが土台のアプリ。使いたい機能だけを足して使う。読みはログる。

要件、設計、決めたことは develop-docs の `docs/logru/` にある。

## 使っているもの

| 層 | 使うもの |
| --- | --- |
| 画面 | React、React Router、TanStack Query、Tailwind CSS、shadcn/ui。PWA |
| API | Hono。Cloudflare Workers の上で動く |
| データベース | Cloudflare D1。Drizzle ORM で定義する |
| ログイン | Firebase Authentication。メールとパスワード、Google |
| テスト | Vitest、Playwright |

ログインは Firebase、それ以外のデータは D1 に置く。画面は Firebase の ID トークンを API に付け、Worker が署名を確かめる。
パスワードの変換とメールの送信は Firebase が行う。Workers は無料プランのままで動く。

## 手元で動かす

Node 24 と pnpm 11 を使う。Chrome が入っていれば、E2E テストも動く。

```bash
pnpm install
pnpm dev
```

`pnpm dev` は、手元の D1 に移行を当て、Firebase の Auth エミュレーターと Vite を一緒に立ち上げる。

1. `http://localhost:5173` を開く
2. ログインの画面の下にある「開発用にログイン」で、登録と確認を飛ばして入れる。エミュレーターのときだけ出る
3. 普通に登録したときの確認メールは、`http://127.0.0.1:9099/emulator/v1/projects/demo-logru/oobCodes` で読める
4. 部品見本は `http://localhost:5173/_components` にある

エミュレーターの利用者は、止めると消える。

`Ctrl+C` で、Vite と、`pnpm dev` が立ち上げたエミュレーターの両方が止まる。
立ち上げたときに 9099 番でエミュレーターが既に動いていれば、`pnpm dev` はそれを使い、止めるときも残す。

### エミュレーターだけを扱う

| やりたいこと | コマンド |
| --- | --- |
| エミュレーターだけを立ち上げる | `pnpm emulator` |
| 残っているエミュレーターを止める | `kill $(lsof -ti tcp:9099 -sTCP:LISTEN)` |
| 登録した利用者をすべて消す | エミュレーターを止めて、立ち上げ直す |

テストを何度も流すと、エミュレーターに利用者がたまる。Google でのログインの窓に一覧が並び、テストが遅くなる。気になったら立ち上げ直す。

## テスト

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

`pnpm e2e` は、本番と同じ形に組み立てて `http://localhost:4173` で動かしてから流す。
スマホの幅と PC の幅の両方で確かめる。ブラウザは画面を出さずに動く。

Auth エミュレーターが動いていなければ、テストの間だけ立ち上げ、終わったら止める。
既に動いていれば、それを使い、終わっても残す。`pnpm dev` を動かしたままテストを流してもよい。

| やりたいこと | コマンド |
| --- | --- |
| 1 つのファイルだけ流す | `pnpm e2e e2e/calendar.spec.ts` |
| 名前で絞って流す | `pnpm e2e -g "予定を直せる"` |
| 別の番号で流す | `E2E_PORT=4174 pnpm e2e` |
| 同時に流す数を減らす | `pnpm e2e --workers=2` |

`E2E_PORT` を変えれば、別のフォルダで同時にテストを流せる。例は git worktree で作業を並べるとき。
ただし、同時に流すと Mac が重くなり、時間切れで落ちることがある。落ちたファイルだけを 1 つずつ流し直して、通るかを確かめる。

## 本番に出す

最初の 1 回だけ、次を行う。

### Firebase

1. Firebase のコンソールでプロジェクトを作る。料金は無料の Spark プランのままでよい
2. Authentication の「ログイン方法」で、「メール / パスワード」と「Google」を有効にする
3. Authentication の「設定」の「承認済みドメイン」に、本番の URL のドメインを足す。例は `logru-production.<アカウント>.workers.dev`
4. Authentication の「テンプレート」で、メールの言語を日本語にする
5. 「プロジェクトの設定」でウェブアプリを足し、出てきた値を `.env.production` に書く。これらは画面に配られる値で、秘密ではない

### Cloudflare

1. `npx wrangler login` で Cloudflare にログインする
2. `npx wrangler d1 create logru` でデータベースを作り、出てきた ID を `wrangler.jsonc` の `env.production` の `database_id` に書く
3. `wrangler.jsonc` の `env.production.vars` の `APP_URL` を本番の URL に、`FIREBASE_PROJECT_ID` を Firebase のプロジェクト ID に書き換える

鍵は要らない。Worker は Google が公開している鍵で ID トークンを確かめる。

その後は、次の 1 行で出す。移行を当ててから Worker を置き換える。

```bash
pnpm run deploy
```

### 本番に出す前に確かめること

- `.env.production` に `replace-me` が残っていると、ログインできない
- `APP_URL` が `example` のままだと、招待リンクが壊れる
- 承認済みドメインに本番のドメインが無いと、Google でのログインが断られる

## 規約を改めるとき

1. `legal/terms.md` か `legal/privacy.md` を直す
2. `src/shared/legal.ts` の版を、改めた日に上げる
3. 公開すると、全員に次のログインで同意を取り直す

## 拡張を足すとき

カレンダーは拡張を知らない。拡張の側が、期間に入る項目を返し、項目を直すシートを持つ。
予定の拡張 `src/extensions/events/` が見本になる。

1. `src/extensions/<名前>/` を作る。`manifest.ts` に名前と説明を書く
2. `server/` に表の定義、項目の渡し方、API を置き、`ServerExtension` の形にまとめる
3. `client/` に項目を直すシートを置き、`ClientExtension` の形にまとめる
4. `src/extensions/registry.server.ts` と `registry.client.ts` に 1 行ずつ足す
5. `pnpm db:generate` で移行を作る

グループの設定の画面に切り替えが出る。無効にしても、拡張のデータは消えない。

## ディレクトリ

| 場所 | 中身 |
| --- | --- |
| `src/client/app` | 入口、道順、ログインの状態、画面の入口の守り |
| `src/client/modules` | 画面。ログイン、カレンダー、グループ、設定、規約ごとに分ける |
| `src/client/components` | 共通の部品。`ui` は shadcn/ui から取ったもの |
| `src/client/lib` | API、Firebase、読み込み、色、日付 |
| `src/server/core` | API の土台。ID トークンの確認、D1 の表の定義 |
| `src/server/modules` | API の入り口。自分、グループ、招待、カレンダー |
| `src/extensions` | 拡張。1 つの拡張の画面、API、表を 1 か所に置く |
| `src/shared` | 画面と API の両方で使う型、入力の検証、色、規約の版 |
| `migrations` | D1 の移行。`pnpm db:generate` で作る |
| `legal` | 利用規約とプライバシーポリシーの本文 |
| `scripts` | 開発用の起動 |
| `e2e` | Playwright のテスト |
| `tests` | Vitest のテスト。画面用と Worker 用に分ける |
