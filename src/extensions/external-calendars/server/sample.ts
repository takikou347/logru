/**
 * E2E と手元の確かめに使う、見本の iCal。手元の開発のときだけ配る。
 * 日付は今日を基準に作る。いつ流しても、今月の表に予定が出るようにする。
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間の今日から n 日後の、年月日 */
function tokyoDay(n: number): { y: number; m: number; d: number } {
  const t = new Date(Date.now() + 9 * 60 * 60 * 1000 + n * 24 * 60 * 60 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const date = (n: number) => {
  const { y, m, d } = tokyoDay(n);
  return `${y}${pad(m)}${pad(d)}`;
};

/**
 * 見本の iCal を作る。
 * - 今日の 10 時から 11 時の打ち合わせ。場所つき
 * - 明日から 2 日間の終日の旅行
 * - 2 週間前から毎週の読書会。来週の回だけ EXDATE で抜く
 */
export function sampleIcs(): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Logru//sample//JA",
    "X-WR-CALNAME:見本",
    "X-WR-TIMEZONE:Asia/Tokyo",
    "BEGIN:VEVENT",
    "UID:sample-meeting@logru.test",
    `DTSTAMP:${date(0)}T000000Z`,
    `DTSTART;TZID=Asia/Tokyo:${date(0)}T100000`,
    `DTEND;TZID=Asia/Tokyo:${date(0)}T110000`,
    "SUMMARY:外部の打ち合わせ",
    "LOCATION:渋谷の会議室",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:sample-trip@logru.test",
    `DTSTAMP:${date(0)}T000000Z`,
    `DTSTART;VALUE=DATE:${date(1)}`,
    `DTEND;VALUE=DATE:${date(3)}`,
    "SUMMARY:外部の旅行",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:sample-weekly@logru.test",
    `DTSTAMP:${date(0)}T000000Z`,
    `DTSTART;TZID=Asia/Tokyo:${date(-14)}T200000`,
    `DTEND;TZID=Asia/Tokyo:${date(-14)}T210000`,
    "RRULE:FREQ=WEEKLY;COUNT=6",
    `EXDATE;TZID=Asia/Tokyo:${date(7)}T200000`,
    "SUMMARY:外部の読書会",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
