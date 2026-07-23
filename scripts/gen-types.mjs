/**
 * Veritabanı tiplerini şemadan üretir — `npm run gen:types`
 *
 * Kural: DB tipleri elle yazılmaz. Şemayı her değiştirdiğinde bunu çalıştır.
 *
 * Gerekli ortam değişkenleri (kişisel erişim jetonu, depoya YAZILMAZ):
 *   SUPABASE_ACCESS_TOKEN   supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF    proje ref'i (panel URL'inde geçer)
 */
import { writeFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error(
    "SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF ortam değişkenleri gerekli.\n" +
      'Örnek: $env:SUPABASE_ACCESS_TOKEN="sbp_..."; $env:SUPABASE_PROJECT_REF="abc123"; npm run gen:types',
  );
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!res.ok) {
  console.error(`Supabase API hatası ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const { types } = await res.json();
const out = new URL("../src/types/database.ts", import.meta.url);

writeFileSync(
  out,
  "// URETILMIS DOSYA - elle duzenlemeyin.\n" +
    "// Kaynak: Supabase semasi. Yeniden uretmek icin: npm run gen:types\n\n" +
    types,
  "utf8",
);

console.log(`yazildi: src/types/database.ts (${types.length} karakter)`);
