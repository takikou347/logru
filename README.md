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

## ブランチと出し方

| ブランチ | 役割 | 入ると |
| --- | --- | --- |
| `main` | 本番 | CI が通った後、本番の `logru-production` に出る |
| `develop` | 本番の手前。既定のブランチ | CI が通った後、staging の `logru-staging` に出る |
| 作業のブランチ | 1 つの変更 | 何も出ない。PR の CI だけが走る |
| `hotfix/*` | 本番の急ぎの直し | 何も出ない。main へ直接 PR を出せる |

1. `develop` からブランチを切り、`develop` へ PR を出す
2. CI が通ったらマージする。staging に出るので、`logru-staging` で動きを確かめる
3. 本番に出すときは、`develop` から `main` へ PR を出し、「Create a merge commit」でマージする。squash や rebase にすると、develop と main の履歴がずれる
4. `hotfix/*` を `main` に入れたら、`main` を `develop` にもマージして戻す

`main` と `develop` は保護している。直接の push はできず、PR の CI の `check` と `branch-rule` が通らないとマージできない。
`branch-rule` は、`main` への PR が `develop` か `hotfix/*` から来ているかを見る。

出す処理は `.github/workflows/ci.yml` の `deploy` にある。組み立て、移行を当て、Worker を置き換える。
出し直すときは、Actions の CI を「Run workflow」で `main` か `develop` を選んで流す。

移行は新しいコードより先に当たる。置き換わるまでの少しの間、古いコードが新しい表の上で動く。
このため 1 つの PR の移行では、列や表を足すだけにする。消すのは、コードが使わなくなった後の別の PR で行う。

戻すときは次を使う。移行は戻らない。

```bash
CLOUDFLARE_ENV=production npx wrangler rollback
```

手元から出すこともできる。普段は使わない。

```bash
pnpm deploy:staging
pnpm deploy:production
```

## 本番に出す

staging と本番で、最初の 1 回だけ次を行う。コマンドは `<環境>` を `staging` か `production` に置き換えて、それぞれで流す。

| | staging | 本番 |
| --- | --- | --- |
| Worker | `logru-staging` | `logru-production` |
| URL | `https://logru-staging.<サブドメイン>.workers.dev` | `https://logru-production.<サブドメイン>.workers.dev` |
| D1 | `logru-staging` | `logru` |
| R2 | `logru-memories-staging` | `logru-memories` |
| Firebase | 本番と同じプロジェクト | |

`<サブドメイン>` は、Cloudflare のダッシュボードの「Workers & Pages」の右側に出る。独自ドメインは使わない。

### Firebase

staging と本番で 1 つのプロジェクトを使う。作るのは 1 回だけ。

1. Firebase のコンソールでプロジェクトを作る。料金は無料の Spark プランのままでよい
2. Authentication の「ログイン方法」で、「メール / パスワード」と「Google」を有効にする
3. Authentication の「設定」の「承認済みドメイン」に、staging と本番の 2 つのドメインを足す
4. Authentication の「テンプレート」で、メールの言語を日本語にする
5. 「プロジェクトの設定」でウェブアプリを足し、出てきた値を `.env.production` に書く。これらは画面に配られる値で、秘密ではない。staging も同じ値で組み立てる

### Cloudflare

1. `npx wrangler login` で Cloudflare にログインする
2. データベースを作り、出てきた ID を `wrangler.jsonc` の `env.<環境>` の `database_id` に書く

   ```bash
   npx wrangler d1 create logru-staging
   npx wrangler d1 create logru
   ```

3. `wrangler.jsonc` の `env.<環境>.vars` の `APP_URL` をその環境の URL に、`FIREBASE_PROJECT_ID` を Firebase のプロジェクト ID に書き換える
4. ダッシュボードで R2 を有効にする。10GB までは無料だが、支払い方法の登録を求められる
5. 思い出の写真の置き場を作る

   ```bash
   npx wrangler r2 bucket create logru-memories-staging
   npx wrangler r2 bucket create logru-memories
   ```

6. 鍵を置く。どれも 32 バイトの乱数を base64 にしたもの。環境ごとに別の値にし、`wrangler.jsonc` にある開発用の値は使わない

   ```bash
   openssl rand -base64 32 | npx wrangler secret put EXTERNAL_CALENDAR_KEY --env <環境>
   openssl rand -base64 32 | npx wrangler secret put MEMORIES_PHOTO_KEY --env <環境>
   ```

   外部のカレンダーの鍵を変えると、登録済みの URL が読めなくなる。変えたら、登録し直してもらう。
   写真の鍵を変えると、配った写真の URL がすぐ切れる。画面を読み直せば新しい URL になる

7. 端末への知らせの VAPID の鍵の組を、環境ごとに作る。公開鍵を `wrangler.jsonc` の `env.<環境>.vars` の `VAPID_PUBLIC_KEY` に書き、秘密鍵を secret に置く

   ```bash
   node -e 'const{generateKeyPairSync:g}=require("node:crypto");const k=g("ec",{namedCurve:"prime256v1"}).privateKey.export({format:"jwk"});console.log("public",Buffer.concat([Buffer.from([4]),Buffer.from(k.x,"base64url"),Buffer.from(k.y,"base64url")]).toString("base64url"));console.log("private",k.d)'
   npx wrangler secret put VAPID_PRIVATE_KEY --env <環境>
   ```

   鍵を変えると、登録済みの端末に届かなくなる。変えたら、設定の画面で知らせを入れ直してもらう

8. 3 つの鍵が置けたかを見る

   ```bash
   npx wrangler secret list --env <環境>
   ```

ログインの鍵は要らない。Worker は Google が公開している鍵で ID トークンを確かめる。

Cron Triggers は 5 分おきに、外部のカレンダーの読み直し、ひとコマの知らせ、消した写真の片付けをする。
外部のカレンダーを 1 回に読むのは、読みに行ってから時間のたった順に 5 つまで。登録が全部で 5 つを超えると、1 つあたりの間隔は 5 分より延びる。

### GitHub

GitHub の Settings の Environments に `staging` と `production` がある。`staging` は `develop` から、`production` は `main` からだけ使える。
それぞれに次を置くと、自動で出るようになる。置くまでは、CI の `deploy` は出さずに成功で終わる。

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare の API トークン。「Edit Cloudflare Workers」の雛形に「D1 の編集」を足して作る |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |
| Variable | `APP_URL` | その環境の URL。Actions の画面にリンクとして出るだけ |

### 出す前に確かめること

- `.env.production` に `replace-me` が残っていると、ログインできない
- `APP_URL` が `example` のままだと、招待リンクが壊れる
- 承認済みドメインにその環境のドメインが無いと、Google でのログインが断られる
- `VAPID_PUBLIC_KEY` が `replace-me` のままだと、知らせを入れられない
- `MEMORIES_PHOTO_KEY` を置いていないと、写真を配れない

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
カレンダーの「読み直す」を押したときに先にしておく仕事があれば、`ClientExtension` の `refresh` に置く。
外部のカレンダーの拡張 `src/extensions/external-calendars/` が見本になる。

### ホームのウィジェットを足すとき

ホームは、拡張が `ClientExtension` の `widgets` に登録したものを並べる。0029

1. `client/` にウィジェットの部品を作る。`HomeWidgetProps`(`size`、`editing`)だけを受け取り、中身は自分の hook で読む。
   ホームは並べ方と大きさしか知らない。思い出の拡張の `src/extensions/memories/client/HomeWidget.tsx` が見本になる
2. `ClientExtension` の `widgets` に 1 件足す。key は拡張の key を頭に付ける。例は `memories.shortcut`
3. 選べる大きさ(`sizes`)、既定の大きさ(`defaultSize`)、初めて開いたときに置くか(`defaultPlaced`)を決める
4. グループでその拡張を無効にすると、ウィジェットもホームから消える。有効に戻すと元の場所に戻るので、拡張の側で何もしなくてよい

カレンダーの本体、選んだ日の予定、このあとは、拡張ではなくホームの土台のウィジェット。外せない・並べ替えの土台になる都合上、
`src/client/modules/home/BaseWidgets.tsx` にあり、拡張の `widgets` とは別に扱う。

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
