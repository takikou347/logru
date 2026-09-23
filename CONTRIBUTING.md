# CONTRIBUTING

人と Claude の両方が読む規約。ファイル名や import の禁止など、機械で見られるものは Biome
(`biome.json`) が見る。ここには、Biome で見ていないものだけ書く。要件、設計、置き場所を決めた
理由は develop-docs の `docs/logru/` にある。実装の前に読む。置き場所の理由は decisions の 0013。

## ファイル名

| 場所 | 形 |
| --- | --- |
| コンポーネント(`.tsx`) | PascalCase.tsx |
| それ以外(`.ts`) | kebab-case.ts |
| `src/client/components/ui` | shadcn/ui が生成したままの名前。変えない |

`src/client/components` と `src/client/modules` 配下は Biome の `useFilenamingConvention` が見る。

## 置き場所

| 場所 | 中身 |
| --- | --- |
| `src/client/app` | 入口、道順、ログインの状態、画面の入口の守り |
| `src/client/modules/<機能>` | 画面。auth、calendar、groups、settings、legal |
| `src/client/components/ui` | shadcn/ui から取ったままの部品 |
| `src/client/components/layout` | ページの外枠、ナビゲーションなど画面全体の骨組み |
| `src/client/components/parts` | 複数の画面で使う、独自の共通部品 |
| `src/server/core` | API の土台。ID トークンの確認、D1 の表の定義 |
| `src/server/modules/<機能>` | API の入り口。me、groups、invites、calendar |
| `src/extensions/<名前>` | `manifest.ts`、`server/`、`client/`、`shared/` |

## API の呼び出し

画面(`*Page.tsx`、`*Sheet.tsx`)から `@/api/client` を直接呼ばない。機能ごとに
`src/client/modules/<機能>/api.ts` を置き、TanStack Query の hook(`useXxx`)にまとめて、
画面はその hook だけを呼ぶ。`src/client/modules/calendar/api.ts` が見本になる。

この禁止は Biome の `noRestrictedImports`(`*Page.tsx`、`*Sheet.tsx` への override)が見る。

## 依存の向き

土台が拡張を読んでよいのは `src/extensions/server/registry.ts` と `src/extensions/client/registry.ts` だけ。
`src/server/` から拡張の中の `client/`、`server/`、`shared/` を直接読まない。この禁止は Biome の
`noRestrictedImports`(`src/server/**` への override)が見る。詳しい理由は 0013。

## 別名(path alias)

| 別名 | 差す場所 |
| --- | --- |
| `@/` | `src/client/` |
| `@shared/` | `src/shared/` |
| `@server/` | `src/server/` |
| `@extensions/` | `src/extensions/` |

`tsconfig.app.json`、`tsconfig.worker.json`、`vite.config.ts`、`vitest.config.ts` の 4 か所に定義がある。別名を足したら 4 か所とも直す。

## コメントで決定・機能・issue を引く

仕様の理由や由来をコメントに残すときは、decisions の番号(`0009`)、要件の機能 ID(`F-20`)、
GitHub の issue(`#28`)をそのまま書く。文章は書かず、番号だけを添える。

```ts
/** グループ。登録した人には自分だけのグループを 1 つ作る。0009 */
```

```ts
/** カレンダーに出す人の選択。自分の画面だけの設定。hidden が true の人が作った項目を出さない。F-20 */
```

```ts
// 招待する人が、みな予定のグループのメンバーかを確かめる。違う人がいれば 400。#28
```

複数を引くときは読点で並べる(`F-23、0023`)。番号だけでは分からない固有の判断(捨てた案、境界値の理由)は、
コメントではなく `docs/logru/decisions/` に書く。

## コミットの形

`type(scope): 何をしたか` を日本語で書く。scope は省ける。

type は次のいずれか。

| type | 意味 |
| --- | --- |
| feat | 機能を足す |
| fix | 直す |
| docs | 文書だけの変更 |
| test | テストだけの変更 |
| chore | 上のどれにも当たらない雑務 |
| refactor | 動きを変えない整理 |
| build | ビルドや依存まわりの変更 |

## テスト

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

E2E(Playwright)は Firebase Auth エミュレーター(9099)が要る。README の手順に従う。

同時に流すと Mac の負荷が上がり、時間切れで落ちることがある。`pnpm e2e --workers=2` にし、
落ちたファイルだけを 1 つずつ流し直す。ほかに分かっていること。

- Service Worker が出す要求は `page.route` では止められない。`page.context().route` を使う
- Auth エミュレーターの Google の窓は、開いた直後だとボタンが効かないことがある。入力欄が開くまで押し直す
- パスワード再設定の画面は、移り切る前に入れた値が消えることがある。見出しを待ってから入れる

### E2E を壊れにくくする

2026-w39 に、次の 3 つで E2E が何度も落ちた。

| 決まり | 理由 |
| --- | --- |
| 日付は `e2e/helpers.ts` の `tokyoDateParts` で作る。時刻で出し分ける画面(ひとコマなど)は `page.clock` で時刻を決める | CI は UTC で動く。`new Date()` の日付は日本時間の夜中にずれ、ひとコマは 7 時から 22 時しか出ない |
| 画面への移り方と、よく使う操作は `helpers.ts` の関数を使う(`addExtension`、`pickShare`、`addEvent` など)。無ければ足す | 設定の場所やボタンの名前が変わるたび、直に書いたテストが何本も落ちた |
| 数えたり有る無しを見たりする前に、読み終えた印を待つ。枠が出ただけでは待たない | 枠が先に出て中身が後から入ると、0 と数えて誤った道に進む |

並べて流すときは、`E2E_PORT` を別の番号にする。

## API を足すとき

足す前に、次の表を 1 つずつ確かめる。2026-09-24 のセキュリティの点検で、抜けていたものを表にした。

| 確かめること | 使うもの |
| --- | --- |
| ログインしているか。グループのメンバーか、持ち主か | `requireUser`、拡張ごとの access の関数 |
| 入力を zod で確かめたか。文字の長さと配列の数に上限があるか | `src/shared/schemas.ts` |
| 外へ取りに行く、重い、何度も呼ばれうる経路に、回数の上限があるか | `enforceRateLimit`。決定 0045、0065 |
| 送られてくる本文を、読む前に大きさで断れるか | `hono/body-limit` |
| 1 人が作れる数に上限があるか。グループ、項目、写真など | 決定 0065 |
| R2 に置くなら、合計の上限を見ているか | `assertStorageBudget`。決定 0066 |
| 外への `fetch` に待ち時間の上限があるか | `AbortSignal.timeout` |
| 秘密や署名付きの URL を、ログや応答や CI の出力に出していないか | — |

## 移行

- 番号は、並べて作るときは親が先に割り当てる。自分で最大 + 1 を数えない
- `develop` を取り込んで番号が重なったら、後から入る側が `pnpm db:generate` で振り直す
- `migrations/meta/_journal.json` が SQL のファイルと合わないときは、`db:generate` の出力を使わない。SQL と journal を手で 1 件足す。本番の移行はファイル名の順に流れ、journal は見ない
- 1 つの PR の移行は、足すだけか消すだけにする。決定 0026

## 手元の確認

`lefthook install` で、コミット前と push 前に機械で確かめる仕組みが入る。`pnpm install` の `prepare` で自動でも入る。

| タイミング | 流すもの |
| --- | --- |
| pre-commit | 変えたファイルだけ `biome check --write` |
| pre-push | `pnpm typecheck` と `pnpm test` |

E2E は時間がかかるため手元のフックには入れていない。CI で確かめる。

大きく入れ替えたら `pnpm knip` を流し、使っていない export、ファイル、依存が残っていないか確かめる。
