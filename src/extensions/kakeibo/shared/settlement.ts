/**
 * 精算の計算。人ごとの払った額と負担額から差し引きを出し、送る回数がいちばん少ない組み合わせを作る。0072、F-320
 */

/** 精算した記録 1 件ぶんの、貸し借りへの影響 */
export type SettlementEntry = { from: string; to: string; amount: number };

/** 「誰が誰にいくら送るか」1 件 */
export type Transfer = { from: string; to: string; amount: number };

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
 * 送る回数がいちばん少ない組み合わせを作る。貸しの多い人と借りの多い人から順に当てる。0072
 *
 * 差し引きがプラスの人(貸している)を大きい順、マイナスの人(借りている)を大きい順に並べ、
 * いちばん貸している人といちばん借りている人を、どちらかが 0 になるまで当てる。0 になったら次の人に進む。
 * 端数(1 円未満)は出ない前提なので、最後は必ずちょうど 0 になる。
 */
export function minimalTransfers(net: Map<string, number>): Transfer[] {
  const creditors = [...net.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = [...net.entries()].filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
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
