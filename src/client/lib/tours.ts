/**
 * 画面ごとの案内(コーチマーク)。土台の画面の案内の中身と、出すかどうかの決まり。F-33
 * 拡張の画面の案内は、拡張の manifest の tour に書く。
 */

import type { Me } from "@shared/api-types";
import type { TourStep } from "@shared/tours";

/** 土台の画面の案内。ID は tours_seen に入る。変えると、見た人にもう一度出る */
export const BASE_TOURS = {
  calendar: [
    { target: '[role="gridcell"][data-today]', text: "日付を押すと、その日の予定を足せます。" },
    { target: '[data-tour="group-filter"]', text: "グループを選ぶと、そのグループの予定だけになります。" },
    { target: '[data-tour="edit-home"]', text: "「ホームを編集」で、ウィジェットを並べ替えられます。" },
  ],
  group: [{ target: '[data-tour="group-invite"]', text: "招待リンクを渡すと、7 日のあいだ相手がグループに入れます。" }],
  extensions: [
    {
      target: '[data-tour="extension-add"]',
      text: "「+」から機能を足せます。外しても、記録は消えません。また足すと戻ります。",
    },
  ],
} satisfies Record<string, TourStep[]>;

/**
 * その画面の案内を出してよいか。出す条件はここ 1 か所にまとめる。
 * E2E テストでは VITE_TOURS=off で切る。吹き出しがほかの操作を隠さないように
 *
 * @param me 自分の情報。読めていなければ出さない
 * @param id 画面の ID
 */
export function shouldShowTour(me: Me | undefined, id: string): boolean {
  if (import.meta.env.VITE_TOURS === "off") return false;
  if (!me) return false;
  // はじめての案内(F-32)が終わるまでは出さない。2 つが重なって出ないように
  if (me.onboardedAt === null) return false;
  return !me.settings.toursSeen.includes(id);
}

/**
 * 案内の進み方。「分かった」で次へ、最後の 1 枚か「もう出さない」か外を押したら終わる。
 * 終わったら onFinish を 1 回だけ呼ぶ。呼ぶ側はそこで見たことを保存する
 *
 * @param length 案内の枚数
 * @param onFinish 終わったとき
 */
export function tourController(length: number, onFinish: () => void) {
  let index = 0;
  let finished = length === 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    onFinish();
  };
  return {
    get index() {
      return index;
    },
    get finished() {
      return finished;
    },
    /** 「分かった」。最後の 1 枚なら終わる */
    next() {
      if (finished) return;
      if (index + 1 >= length) finish();
      else index += 1;
    },
    /** 「もう出さない」、外を押した、Esc。その画面の案内を全部止める */
    dismiss: finish,
  };
}

/**
 * セレクターに合う要素のうち、見えている最初のもの。スマホと PC で別の要素を置いている画面があるため。
 * 無ければ null
 */
export function findVisibleTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * 指す場所が画面の中に収まっているか。スマホの下に浮かぶ操作の帯に隠れるときは、収まっていないとみなす。
 * 収まっていなければ、吹き出しをやめて下から出るシートで読ませる
 *
 * @param rect 指す場所の位置
 * @param viewport 画面の大きさ
 * @param bottomInset 下に浮かぶ帯の高さ。PC は 0
 */
export function fitsInViewport(
  rect: { top: number; bottom: number },
  viewport: { height: number },
  bottomInset: number,
): boolean {
  return rect.top >= 0 && rect.bottom <= viewport.height - bottomInset;
}
