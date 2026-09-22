/** 思い出の拡張の API がやり取りする形 */

/** 写真 1 枚。URL は期限と署名付き。0021 */
export type Photo = {
  id: string;
  width: number;
  height: number;
  takenAt: number | null;
  /** 32 px の JPEG の data URL。読み込むまでの仮の絵と、奥の色に使う */
  tiny: string;
  thumbUrl: string;
  fullUrl: string;
};

/** しおりの行の種類。やりたいこと、やること、持ち物 */
export type ItemKind = "wish" | "todo" | "packing";

/** しおりの 1 行 */
export type MemoryItem = {
  id: string;
  kind: ItemKind;
  title: string;
  place: string | null;
  dayIndex: number | null;
  assigneeId: string | null;
  dueOn: string | null;
  sortOrder: number;
  doneAt: number | null;
  doneBy: string | null;
  createdBy: string | null;
};

/** 思い出の 1 件 */
export type Memory = {
  id: string;
  groupId: string;
  createdBy: string | null;
  title: string;
  place: string | null;
  startsAt: number;
  endsAt: number;
  timeZone: string;
  komaEnabled: boolean;
  /** 表紙。選んでいなければ期間の最初の写真。写真が無ければ空 */
  cover: Photo | null;
  photoCount: number;
  /** 思い出から外した予定の ID。期間に重なる同じグループの予定は、これ以外が入る。0020 */
  excludedEventIds: string[];
};

/** 記録の 1 件 */
export type MemoryRecord = {
  id: string;
  groupId: string;
  createdBy: string | null;
  kind: "note" | "koma";
  body: string | null;
  occurredAt: number;
  komaSlot: number | null;
  itemId: string | null;
  photos: Photo[];
  /** いいねを付けた人の ID。付けた順 */
  likes: string[];
};

/** `GET /api/memories` の応答 */
export type MemoryList = { memories: Memory[]; recent: MemoryRecord[] };

/** `GET /api/memories/:id` の応答 */
export type MemoryDetail = { memory: Memory; items: MemoryItem[]; dayCounts: number[] };

/** `GET /api/memories/koma/now` の応答。近道の帯と、ひとコマを撮る画面が使う。0022 */
export type KomaNow = {
  /** 端末の時間帯での今日 */
  day: string;
  started: boolean;
  groupId: string | null;
  memory: { id: string; title: string } | null;
  muted: boolean;
  /** いまの枠。7 時台から 22 時台の外なら空 */
  slot: { start: number; hour: number } | null;
  /** いま残せる枠。いまの枠と、過ぎてから 5 分以内の前の枠 */
  open: { start: number; hour: number }[];
  /** いまの枠に、自分が残したか */
  taken: boolean;
  /** 今日の自分の、最後のひとコマの写真 */
  last: Photo | null;
  /** 同じグループの人が、いまの枠に残したもの */
  others: { userId: string; photo: Photo }[];
};

/** `GET /api/memories/koma` の 1 日。確認画面の 1 段 */
export type KomaDay = {
  day: string;
  groupId: string;
  memory: { id: string; title: string; dayIndex: number } | null;
  timeZone: string;
  muted: boolean;
  records: MemoryRecord[];
};
