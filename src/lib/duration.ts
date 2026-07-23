/**
 * Süre biçimleme.
 *
 * Veritabanındaki `build_seconds` / `produce_seconds` saniye cinsindendir ve
 * herhangi bir ölçeğe ayarlanabilir. Bu yüzden biçimleyici saniyeden haftaya
 * kadar bütün aralığı kapsar; SQL'den 604800 yazınca arayüz "1h" gösterir.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const UNITS: { limit: number; short: string }[] = [
  { limit: WEEK, short: "h" },
  { limit: DAY, short: "g" },
  { limit: HOUR, short: "sa" },
  { limit: MINUTE, short: "dk" },
  { limit: 1, short: "sn" },
];

/**
 * En büyük iki birimi gösterir: "3dk 20sn", "1sa 5dk", "2g 4sa", "1h 3g".
 * Kısa ve tek satırda kalması için ikiden fazla birim yazılmaz.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "hazır";

  const parts: string[] = [];
  let rest = seconds;

  for (const unit of UNITS) {
    if (parts.length === 2) break;
    const value = Math.floor(rest / unit.limit);
    if (value === 0 && parts.length === 0) continue;
    if (value === 0) continue;
    parts.push(`${value}${unit.short}`);
    rest -= value * unit.limit;
  }

  return parts.length > 0 ? parts.join(" ") : "1sn";
}

/** Uzun biçim — kart ve künyelerde okunabilirlik için: "2 dakika 30 saniye". */
export function formatDurationLong(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "anında";

  const LONG: { limit: number; name: string }[] = [
    { limit: WEEK, name: "hafta" },
    { limit: DAY, name: "gün" },
    { limit: HOUR, name: "saat" },
    { limit: MINUTE, name: "dakika" },
    { limit: 1, name: "saniye" },
  ];

  const parts: string[] = [];
  let rest = seconds;
  for (const unit of LONG) {
    if (parts.length === 2) break;
    const value = Math.floor(rest / unit.limit);
    if (value === 0) continue;
    parts.push(`${value} ${unit.name}`);
    rest -= value * unit.limit;
  }
  return parts.join(" ");
}
