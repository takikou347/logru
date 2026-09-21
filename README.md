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

## テスト

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

`pnpm e2e` は、Auth エミュレーターを立ち上げ、本番と同じ形に組み立てて `http://localhost:4173` で動かしてから流す。
スマホの幅と PC の幅の両方で確かめる。

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
4. 外部のカレンダーの URL を暗号にする鍵を置く。32 バイトの乱数を base64 にしたもの。`wrangler.jsonc` にある開発用の値は使わない

   ```bash
   openssl rand -base64 32 | npx wrangler secret put EXTERNAL_CALENDAR_KEY --env production
   ```

   鍵を変えると、登録済みの URL が読めなくなる。変えたら、登録し直してもらう

ログインの鍵は要らない。Worker は Google が公開している鍵で ID トークンを確かめる。

外部のカレンダーは、Cron Triggers で 5 分おきに読み直す。`wrangler.jsonc` の `triggers.crons` にある。
1 回に読むのは、読みに行ってから時間のたった順に 5 つまで。登録が全部で 5 つを超えると、1 つあたりの間隔は 5 分より延びる。

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

利用者ごとの拡張は、`manifest.ts` の `perUser` を true にする。グループの切り替えには出さず、項目は本人にだけ出す。
設定の画面に欄が要れば `ClientExtension` の `SettingsSection` に、定期の処理が要れば `ServerExtension` の `scheduled` に置く。
外部のカレンダーの拡張 `src/extensions/external-calendars/` が見本になる。

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
