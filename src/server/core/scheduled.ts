/**
 * Cron Triggers から呼ぶ定期の処理をまとめて走らせる。1 つが失敗しても、ほかは最後まで動く。0065、#161
 *
 * 拡張ごとの scheduled は ctx.waitUntil に積むだけで並んで動くが、CPU 時間は 1 回の呼び出し全体で
 * 共有される。重い処理が先に CPU 時間を使い切ると、後ろの処理まで道連れで止まりかねない。
 * ここでは、外部のカレンダーの読み直しのような重い処理が失敗しても、失敗を記録するだけにして、
 * 天気やひとコマの知らせ、写真の片付け、お知らせの掃除のような軽い処理を続けて呼ぶ。
 */

/** 名前を付けた 1 つの定期の処理 */
export type NamedTask = { name: string; run: () => Promise<void> };

/** 1 つの処理を呼ぶ。失敗しても外へ投げず、Workers Logs に記録するだけにする */
async function runOne(task: NamedTask): Promise<void> {
  try {
    await task.run();
  } catch (e) {
    console.error(`scheduled task failed: ${task.name}`, e);
  }
}

/**
 * 渡した処理をすべて並べて呼ぶ。どれかが失敗しても、ほかは最後まで動く。
 * @param tasks 呼ぶ処理の一覧
 */
export async function runAllScheduled(tasks: NamedTask[]): Promise<void> {
  await Promise.all(tasks.map(runOne));
}
