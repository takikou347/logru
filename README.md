# Logru

カレンダーが土台のアプリ。使いたい機能だけを足して使う。読みはログる。

要件、設計、決めたことは develop-docs の `docs/logru/` にある。

## 使っているもの

| 層 | 使うもの |
| --- | --- |
| 画面 | React、React Router、TanStack Query。PWA |
| API | Hono。Cloudflare Workers の上で動く |
| データベース | Cloudflare D1。Drizzle ORM で定義する |
| ログイン | Better Auth。メールとパスワード、Google |
| メール | Resend |
| テスト | Vitest、Playwright |

## 手元で動かす

Node 24 と pnpm 11 を使う。Chrome が入っていれば、E2E テストも動く。

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

1. `http://localhost:5173` を開く
2. 登録すると、確認メールは送らずに控えを残す。`http://localhost:5173/api/dev/mails` で読める
3. 部品見本は `http://localhost:5173/_components` にある

## テスト

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

`pnpm e2e` は本番と同じ形に組み立て、`http://localhost:4173` で動かしてから流す。スマホの幅と PC の幅の両方で確かめる。

## 本番に出す

最初の 1 回だけ、次を行う。

1. `npx wrangler login` で Cloudflare にログインする
2. `npx wrangler d1 create logru` でデータベースを作り、出てきた ID を `wrangler.jsonc` の `env.production` の `database_id` に書く
3. `wrangler.jsonc` の `env.production.vars` の `APP_URL` と `MAIL_FROM` を、本番の URL と送り元に書き換える
4. 鍵を入れる

```bash
openssl rand -base64 32 | npx wrangler secret put BETTER_AUTH_SECRET --env production
npx wrangler secret put RESEND_API_KEY --env production
```

Google でのログインを使うなら、Google Cloud で OAuth のクライアントを作る。戻り先は `<APP_URL>/api/auth/callback/google`。次を入れる。

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

その後は、次の 1 行で出す。移行を当ててから Worker を置き換える。

```bash
pnpm run deploy
```

### 本番に出す前に確かめること

- Resend に送り元のドメインを登録し、DNS に証明のレコードを入れる。入れないと、自分以外にメールが届かない
- パスワードは PBKDF2 で 10 万回まわす。Workers の無料プランは 1 回の CPU 時間が 10 ミリ秒で、登録とログインがこれを超えることがある。Workers の有料プランにする
- `APP_URL` が `example.com` のままだと、確認メールのリンクが壊れる

## 規約を改めるとき

1. `legal/terms.md` か `legal/privacy.md` を直す
2. `src/shared/legal.ts` の版を、改めた日に上げる
3. 公開すると、全員に次のログインで同意を取り直す

## 拡張を足すとき

カレンダーは拡張を知らない。拡張の側が、期間に入る項目を返す。

1. `src/worker/extensions/` に拡張を 1 つ作る。`CalendarProvider` の形に合わせる
2. `src/worker/extensions/registry.ts` の `providers` に 1 行足す
3. 拡張の表を `src/worker/db/schema.ts` に足し、`pnpm db:generate` で移行を作る

グループの設定の画面に切り替えが出る。無効にしても、拡張のデータは消えない。

## ディレクトリ

| 場所 | 中身 |
| --- | --- |
| `src/client` | 画面。`routes` が画面、`ui` が共通部品、`calendar` がカレンダー |
| `src/worker` | API。`routes` が入り口、`extensions` が拡張、`db` が表の定義 |
| `src/shared` | 画面と API の両方で使う型、入力の検証、色、規約の版 |
| `migrations` | D1 の移行。`pnpm db:generate` で作る |
| `legal` | 利用規約とプライバシーポリシーの本文 |
| `e2e` | Playwright のテスト |
| `tests` | Vitest のテスト。画面用と Worker 用に分ける |
