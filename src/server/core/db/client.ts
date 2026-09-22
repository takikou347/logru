import { extensionSchemas } from "@extensions/server/registry";
import * as core from "@server/core/db/schema";
import { drizzle } from "drizzle-orm/d1";

/** 土台の表と、すべての拡張の表 */
const schema = { ...core, ...extensionSchemas };

/**
 * D1 を Drizzle で包む。要求ごとに 1 つ作る。
 * @param d1 wrangler.jsonc の DB の束縛
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/** createDb が返す型。各所ではこれを受け取る */
export type DB = ReturnType<typeof createDb>;
