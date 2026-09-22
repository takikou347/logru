import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/** D1 の現在時刻。ミリ秒の UTC */
export const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** 作成日時の列。拡張の表でもこれを使う */
export const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);

/** 更新日時の列。拡張の表でもこれを使う */
export const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now);
