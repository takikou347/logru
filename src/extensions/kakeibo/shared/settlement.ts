/**
 * 精算の計算。人ごとの払った額と負担額から差し引きを出し、送る回数がいちばん少ない組み合わせを作る。0072、F-320
 */

/** 精算した記録 1 件ぶんの、貸し借りへの影響 */
export type SettlementEntry = { from: string; to: string; amount: number };

/** 「誰が誰にいくら送るか」1 件 */
export type Transfer = { from: string; to: string; amount: number };

/** 差し引きが 0 でない人、1 人分 */
type Balance = [userId: string, amount: number];

/**
 * ビットの DP で、部分集合をいくつに分けられるかを試す上限。人数がこれを超えたら、貪欲法だけで済ませる。
 * 組み合わせの数は人数のおよそ 3 乗で増えるため、際限なく大きくすると時間がかかりすぎる。
 * 家計簿は少人数のグループを想定しており、これを超えるのは現実には起きない見込み。0072
 */
const EXACT_SPLIT_LIMIT = 14;

/**
 * 人ごとの差し引き(払った額 − 負担額)を出す。精算した記録があれば、その分を足し引きする。
 *
 * 精算(from が to に amount を送った)は、from の差し引きを amount 増やし(その分の借りを返した)、
 * to の差し引きを amount 減らす(その分を受け取った)。
 *
 * @param paid 払った額。同じ人が複数回あれば合計する
 * @param owed 負担した額。同じ人が複数回あれば合計する
 * @param settlements 精算した記録
 */
export function netBalances(
  paid: { userId: string; amount: number }[],
  owed: { userId: string; amount: number }[],
  settlements: SettlementEntry[] = [],
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (userId: string, delta: number) => net.set(userId, (net.get(userId) ?? 0) + delta);
  for (const p of paid) add(p.userId, p.amount);
  for (const o of owed) add(o.userId, -o.amount);
  for (const s of settlements) {
    add(s.from, s.amount);
    add(s.to, -s.amount);
  }
  return net;
}

/**
 * 差し引きがプラスの人(貸している)を大きい順、マイナスの人(借りている)を大きい順に並べ、
 * いちばん貸している人といちばん借りている人を、どちらかが 0 になるまで当てる。0 になったら次の人に進む。
 *
 * この 1 つの部分集合が、これ以上 0 になる部分集合に分けられない(既にいちばん細かい)なら、
 * この貪欲法がそのまま最少の回数になる。人数を n とすると、必ず n − 1 回以下で全員 0 になる。
 */
function greedyTransfersWithinGroup(balances: Balance[]): Transfer[] {
  const creditors = balances.filter(([, v]) => v > 0).map((b): Balance => [...b]) as Balance[];
  const debtors = balances.filter(([, v]) => v < 0).map((b): Balance => [...b]) as Balance[];
  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => a[1] - b[1]);
  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]!;
    const debt = debtors[di]!;
    const amount = Math.min(credit[1], -debt[1]);
    if (amount > 0) transfers.push({ from: debt[0], to: credit[0], amount });
    credit[1] -= amount;
    debt[1] += amount;
    if (credit[1] === 0) ci += 1;
    if (debt[1] === 0) di += 1;
  }
  return transfers;
}

/**
 * 差し引きが 0 でない人たちを、それぞれの合計が 0 になる部分集合へ、できるだけ細かく分ける。
 *
 * 送る回数は「人数 − 分けた数」になるので、分けた数を最大にすることが、送る回数を最少にすることと同じ。
 * ビットの DP で、全員を表す集合を 0 になる部分集合の組み合わせに分け、部分集合の数がいちばん多い分け方を選ぶ。
 * `dp[mask]` は、`mask` に立っているビットの人たちだけを、0 になる部分集合にちょうど分け切ったときの、
 * 分けた数の最大値(分け切れなければ計算しない)。`choice[mask]` は、そのときに最後に切り出した部分集合。
 *
 * 分けた結果の部分集合どうしは、これ以上 0 になる部分集合には分けられない(分けられるなら、その分だけ
 * 分けた数が増えて dp の最大値と矛盾する)。なので、部分集合の中は greedyTransfersWithinGroup がそのまま最少になる。
 */
function splitIntoZeroSumGroups(balances: Balance[]): Balance[][] {
  const n = balances.length;
  const values = balances.map(([, v]) => v);
  const full = 1 << n;

  // sumOf[mask] はその部分集合の差し引きの合計
  const sumOf = new Array<number>(full).fill(0);
  for (let mask = 1; mask < full; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s += values[i]!;
    sumOf[mask] = s;
  }

  const dp = new Array<number>(full).fill(Number.NEGATIVE_INFINITY);
  const choice = new Array<number>(full).fill(0);
  dp[0] = 0;
  for (let mask = 1; mask < full; mask++) {
    // mask 自身も、合計が 0 ならそのまま 1 つの部分集合にできる
    if (sumOf[mask] === 0) {
      dp[mask] = 1;
      choice[mask] = mask;
    }
    // mask の真部分集合を総当たりし、0 になるものを 1 つ切り出して残りと組み合わせる
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      if (sumOf[sub] !== 0) continue;
      const rest = mask ^ sub;
      if (dp[rest] === Number.NEGATIVE_INFINITY) continue;
      const parts = dp[rest]! + 1;
      if (parts > dp[mask]!) {
        dp[mask] = parts;
        choice[mask] = sub;
      }
    }
  }

  const fullMask = full - 1;
  // 呼び出し側で合計が 0 であることを確かめてから呼ぶので、通常は必ず分け切れる。念のため崩れていたら 1 つの集合にする
  if (dp[fullMask] === Number.NEGATIVE_INFINITY) return [balances];

  const groups: Balance[][] = [];
  let mask = fullMask;
  while (mask > 0) {
    const sub = choice[mask]!;
    groups.push(balances.filter((_, i) => (sub & (1 << i)) !== 0));
    mask ^= sub;
  }
  return groups;
}

/**
 * 送る回数がいちばん少ない組み合わせを作る。0072、F-320
 *
 * 差し引きが 0 でない人たちを、合計が 0 になる部分集合へできるだけ細かく分け(ビットの DP)、
 * 部分集合ごとに、貸しの多い人と借りの多い人から順に当てる。端数(1 円未満)は出ない前提なので、
 * 部分集合の中は必ずちょうど 0 になる。
 */
export function minimalTransfers(net: Map<string, number>): Transfer[] {
  const balances = [...net.entries()].filter(([, v]) => v !== 0) as Balance[];
  if (balances.length === 0) return [];
  if (balances.length > EXACT_SPLIT_LIMIT) return greedyTransfersWithinGroup(balances);

  return splitIntoZeroSumGroups(balances).flatMap((group) => greedyTransfersWithinGroup(group));
}
