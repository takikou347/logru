import { createdAt, updatedAt } from "@server/core/db/columns";
import { users } from "@server/core/db/schema";
import { primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** いつもの場所。1 人 1 件だけ持てる。F-401、F-402 */
export const weatherLocations = sqliteTable("weather_locations", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** いつもの場所の表の 1 行 */
export type WeatherLocationRow = typeof weatherLocations.$inferSelect;

/**
 * 場所と日ごとの天気のキャッシュ。0055
 *
 * place_key は緯度経度を小数点 2 桁に丸めた文字列。同じ町を選んだ人どうしで 1 行を共有し、
 * 場所を持つ人がいなくなっても行は残す。次に同じ町を選んだ人が取り直さずに使えるようにするため。F-407
 */
export const weatherDaily = sqliteTable(
  "weather_daily",
  {
    placeKey: text("place_key").notNull(),
    date: text("date").notNull(),
    weatherCode: real("weather_code").notNull(),
    tempMax: real("temp_max").notNull(),
    tempMin: real("temp_min").notNull(),
    /** forecast か archive。どちらから取ったか */
    source: text("source", { enum: ["forecast", "archive"] }).notNull(),
    fetchedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.placeKey, t.date] })],
);

/** 天気のキャッシュの表の 1 行 */
export type WeatherDailyRow = typeof weatherDaily.$inferSelect;
