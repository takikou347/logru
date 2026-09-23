import { zValidator } from "@hono/zod-validator";
import { createRouter, isLocalDev, validationHook } from "@server/core/app";
import { requireAgreement, requireUser } from "@server/core/auth/middleware";
import { eq } from "drizzle-orm";
import { weatherLocationInput, weatherSearchQuery } from "../shared/schemas";
import { placeKeyOf, upsertDaily } from "./cache";
import { fetchForecast, fetchGeocode, WeatherFetchError } from "./open-meteo";
import { FORECAST_DAYS } from "./provider";
import { type WeatherLocationRow, weatherLocations } from "./schema";
import { archiveFixture, forecastFixture, geocodeFixture } from "./test-fixtures";

/** 画面に返す形。緯度経度をそのまま出す */
function toLocationDto(row: WeatherLocationRow) {
  return { name: row.name, latitude: row.latitude, longitude: row.longitude };
}

/**
 * `/api/weather`。いつもの場所を選ぶ、変える、消す。市区町村を検索する。F-401、F-402
 *
 * 見本の応答を返す `__test__` の道は、手元の開発と E2E だけで使う。isLocalDev で塞ぐ。
 */
export const weatherRoutes = createRouter()
  // 手元の開発と E2E だけで使う、Open-Meteo の見本の応答。ログインは要らない
  .get("/__test__/geocode", (c) => {
    if (!isLocalDev(c.env, c.req.url)) return c.json({ error: "見つかりません。" }, 404);
    return c.json(geocodeFixture());
  })
  .get("/__test__/forecast", (c) => {
    if (!isLocalDev(c.env, c.req.url)) return c.json({ error: "見つかりません。" }, 404);
    return c.json(forecastFixture());
  })
  .get("/__test__/archive", (c) => {
    if (!isLocalDev(c.env, c.req.url)) return c.json({ error: "見つかりません。" }, 404);
    return c.json(archiveFixture(c.req.query("start_date") ?? ""));
  })
  .use("*", requireUser, requireAgreement)
  .get("/location", async (c) => {
    const row = await c
      .get("db")
      .select()
      .from(weatherLocations)
      .where(eq(weatherLocations.userId, c.get("user").id))
      .get();
    return c.json({ location: row ? toLocationDto(row) : null });
  })
  .post("/location", zValidator("json", weatherLocationInput, validationHook), async (c) => {
    const db = c.get("db");
    const userId = c.get("user").id;
    const input = c.req.valid("json");
    await db
      .insert(weatherLocations)
      .values({ userId, name: input.name, latitude: input.latitude, longitude: input.longitude })
      .onConflictDoUpdate({
        target: weatherLocations.userId,
        set: { name: input.name, latitude: input.latitude, longitude: input.longitude, updatedAt: new Date() },
      });
    // 保存した直後に、7 日分の予報を 1 度だけ取っておく。失敗しても場所の保存は成功のまま返す。
    // Cron Triggers が次の巡回で取り直すので、ここでの失敗は諦めてよい。F-409
    try {
      const forecast = await fetchForecast(input, c.env, c.req.url, FORECAST_DAYS);
      await upsertDaily(db, placeKeyOf(input.latitude, input.longitude), forecast, "forecast");
    } catch {
      // F-409
    }
    return c.json({ name: input.name, latitude: input.latitude, longitude: input.longitude }, 201);
  })
  .delete("/location", async (c) => {
    await c
      .get("db")
      .delete(weatherLocations)
      .where(eq(weatherLocations.userId, c.get("user").id));
    return c.body(null, 204);
  })
  .get("/search", zValidator("query", weatherSearchQuery, validationHook), async (c) => {
    const { q } = c.req.valid("query");
    try {
      const results = await fetchGeocode(q, c.env, c.req.url);
      return c.json({ results });
    } catch (e) {
      // Open-Meteo に届かないときも、探す画面は壊さず空の結果にする。F-409
      if (e instanceof WeatherFetchError) return c.json({ results: [] });
      throw e;
    }
  });
