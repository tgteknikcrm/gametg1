/**
 * Veritabanı sözleşme testi — `npm run test:db`
 *
 * Gerçek anon anahtarı ve gerçek kullanıcı jetonlarıyla, tarayıcının gittiği yolun
 * aynısından (PostgREST) gider. Doğruladıkları:
 *   - kayıt tetikleyicisi profili kuruyor
 *   - fiyat/ayak izi/XP sunucuda hesaplanıyor
 *   - RLS istemcinin tabloya doğrudan yazmasını engelliyor
 *   - sahiplik kontrolleri
 *   - EŞZAMANLI aynı hücreye inşa denemesinden tam olarak biri geçiyor
 *
 * Sadece anon anahtar kullanır; service_role anahtarına ihtiyaç yoktur.
 * Test sonunda oluşturduğu nesneleri temizler (kullanıcılar kalır).
 */
import { readFileSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error(".env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY bulunamadı.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name} ${detail}`); }
};

const call = async (path, { token, method = "GET", body } = {}) => {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const rpc = (fn, args, token) => call(`/rest/v1/rpc/${fn}`, { token, method: "POST", body: args });

const signUp = async (email) => {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "prototip123", data: { username: email.split("@")[0] } }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`kayıt başarısız: ${JSON.stringify(body).slice(0, 300)}`);
  return { token: body.access_token, id: body.user.id };
};

const stamp = Date.now().toString(36);
const created = [];
const track = (result) => { if (result.data?.id) created.push(result.data.id); return result; };

console.log("\n1) Kayıt ve profil kurulumu (trigger)");
const A = await signUp(`test-a-${stamp}@ornek.test`);
const B = await signUp(`test-b-${stamp}@ornek.test`);

const profA = await call(`/rest/v1/profiles?id=eq.${A.id}&select=*`, { token: A.token });
check("kayıt olunca profil otomatik oluştu", profA.data?.length === 1);
check("başlangıç altını game_config'ten geldi", profA.data?.[0]?.coins === 5000, String(profA.data?.[0]?.coins));
check("şehir atandı", !!profA.data?.[0]?.city_id);

console.log("\n2) Katalog ve denge verisi veritabanında");
const types = await call(`/rest/v1/object_types?select=id&is_active=eq.true`, { token: A.token });
check("nesne türleri okundu", (types.data?.length ?? 0) >= 18, String(types.data?.length));
const anonTypes = await call(`/rest/v1/object_types?select=id`);
check("katalog giriş yapmadan da okunabiliyor", anonTypes.status === 200);

console.log("\n3) place_object");
const free = await findFreeSpot(A.token);
const placed = track(await rpc("place_object", { p_type_id: "wheat_field", p_x: free.x, p_y: free.y, p_rotation: 0 }, A.token));
check("3x3 tarla yerleşti", placed.status === 200 && placed.data?.type_id === "wheat_field", JSON.stringify(placed.data).slice(0, 200));
check("ayak izi sunucuda hesaplandı", placed.data?.footprint_w === 3 && placed.data?.footprint_h === 3);
const afterPlace = await call(`/rest/v1/profiles?id=eq.${A.id}&select=coins,xp`, { token: A.token });
check("maliyet sunucuda düşüldü", afterPlace.data?.[0]?.coins === 4880, String(afterPlace.data?.[0]?.coins));
check("XP verildi", afterPlace.data?.[0]?.xp === 12, String(afterPlace.data?.[0]?.xp));

console.log("\n4) Doğrulama kuralları");
const overlap = await rpc("place_object", { p_type_id: "small_house", p_x: free.x + 1, p_y: free.y + 1, p_rotation: 0 }, A.token);
check("çakışma -> cell_occupied", overlap.data?.message === "cell_occupied", JSON.stringify(overlap.data));
const oob = await rpc("place_object", { p_type_id: "wheat_field", p_x: 19, p_y: 19, p_rotation: 0 }, A.token);
check("grid dışı -> out_of_bounds", oob.data?.message === "out_of_bounds");
const lvl = await rpc("place_object", { p_type_id: "town_hall", p_x: 0, p_y: 0, p_rotation: 0 }, A.token);
check("seviye kapısı -> level_required", lvl.data?.message === "level_required");
const badRot = await rpc("place_object", { p_type_id: "tree", p_x: 0, p_y: 0, p_rotation: 45 }, A.token);
check("geçersiz rotasyon reddedildi", badRot.data?.message === "invalid_rotation");
const unknown = await rpc("place_object", { p_type_id: "hile_binasi", p_x: 0, p_y: 0, p_rotation: 0 }, A.token);
check("bilinmeyen tür reddedildi", unknown.data?.message === "unknown_type");
const anonPlace = await rpc("place_object", { p_type_id: "tree", p_x: 0, p_y: 0, p_rotation: 0 });
check("giriş yapmadan çağrı reddedildi", anonPlace.status >= 400);

console.log("\n5) RLS — istemci tabloya doğrudan yazamaz");
const directInsert = await call(`/rest/v1/placed_objects`, {
  token: A.token, method: "POST",
  body: { parcel_id: placed.data.parcel_id, owner_id: A.id, type_id: "town_hall", local_x: 15, local_y: 15, rotation: 0, footprint_w: 4, footprint_h: 4 },
});
check("doğrudan INSERT reddedildi", directInsert.status >= 400, String(directInsert.status));

await call(`/rest/v1/profiles?id=eq.${A.id}`, { token: A.token, method: "PATCH", body: { coins: 999999999 } });
const coinsNow = await call(`/rest/v1/profiles?id=eq.${A.id}&select=coins`, { token: A.token });
check("altını doğrudan artırmak işe yaramadı", coinsNow.data?.[0]?.coins !== 999999999);

await call(`/rest/v1/placed_objects?id=eq.${placed.data.id}`, { token: A.token, method: "DELETE" });
const stillThere = await call(`/rest/v1/placed_objects?id=eq.${placed.data.id}&select=id`, { token: A.token });
check("doğrudan DELETE işe yaramadı", stillThere.data?.length === 1);

await call(`/rest/v1/object_types?id=eq.town_hall`, { token: A.token, method: "PATCH", body: { cost: 1 } });
const catalogNow = await call(`/rest/v1/object_types?id=eq.town_hall&select=cost`, { token: A.token });
check("katalog fiyatı istemciden değiştirilemedi", catalogNow.data?.[0]?.cost === 2500);

console.log("\n6) Sahiplik ve paylaşılan şehir");
const otherRemove = await rpc("remove_object", { p_object_id: placed.data.id }, B.token);
check("başkasının binasını kaldıramaz", otherRemove.data?.message === "not_owner");
const otherMove = await rpc("move_object", { p_object_id: placed.data.id, p_x: 1, p_y: 1, p_rotation: 0 }, B.token);
check("başkasının binasını taşıyamaz", otherMove.data?.message === "not_owner");
const seenByB = await call(`/rest/v1/placed_objects?select=id&owner_id=eq.${A.id}`, { token: B.token });
check("B, A'nın binalarını görebiliyor", (seenByB.data?.length ?? 0) >= 1);

console.log("\n7) YARIŞ TESTİ — eşzamanlı aynı hücre");
const race = await findFreeSpot(A.token, 2);
const results = await Promise.all(
  Array.from({ length: 8 }, () =>
    rpc("place_object", { p_type_id: "small_house", p_x: race.x, p_y: race.y, p_rotation: 0 }, A.token)),
);
const won = results.filter((r) => r.status === 200);
won.forEach((r) => created.push(r.data.id));
check("8 eşzamanlı istekten tam olarak 1'i başarılı", won.length === 1, `başarılı=${won.length}`);

console.log("\n8) İç yardımcı fonksiyonlar dışarıya kapalı");
// Geçmişte gerçek bir açık: `revoke ... from public`, Supabase'in anon ve
// authenticated rollerine verdiği AYRI grant'ı kaldırmıyordu. `add_to_inventory`
// giriş yapmadan çağrılabiliyor, sınırsız mal basılabiliyordu.
// Var olmayan bir UUID ile çağırıyoruz: yetki açıksa FK hatası (23503) alırdık,
// kapalıysa fonksiyon bulunamaz (42883) ya da yetki reddi (42501).
{
  const FAKE = "00000000-0000-0000-0000-0000000000ff";
  const closed = (res) =>
    res.status === 404 || res.data?.code === "42883" || res.data?.code === "42501" || res.data?.code === "PGRST202";

  const probes = [
    ["add_to_inventory", { p_user: FAKE, p_item: "bread", p_quantity: 1 }],
    ["record_ledger", { p_user: FAKE, p_reason: "build", p_amount: -1 }],
    ["apply_level_up", { p_user: FAKE }],
    ["active_parcel", { p_city: FAKE }],
  ];

  for (const [fn, args] of probes) {
    const anonCall = await rpc(fn, args);
    const authCall = await rpc(fn, args, A.token);
    check(
      `${fn} anon'a kapalı`,
      closed(anonCall),
      `${anonCall.status} ${JSON.stringify(anonCall.data).slice(0, 90)}`,
    );
    check(
      `${fn} giriş yapmış kullanıcıya da kapalı`,
      closed(authCall),
      `${authCall.status} ${JSON.stringify(authCall.data).slice(0, 90)}`,
    );
  }

  // Oyuncuya açık RPC'ler ise giriş yapmadan reddedilmeli ama VAR olmalı.
  const anonPlace = await rpc("place_object", { p_type_id: "tree", p_x: 0, p_y: 0, p_rotation: 0 });
  check(
    "oyuncu RPC'leri anon'a kapalı ama mevcut",
    anonPlace.status >= 400 && anonPlace.data?.code !== "42883",
    `${anonPlace.status} ${JSON.stringify(anonPlace.data).slice(0, 90)}`,
  );
}

console.log("\n9) Temizlik");
let removed = 0;
for (const id of created) {
  const res = await rpc("remove_object", { p_object_id: id }, A.token);
  if (res.status === 200) removed++;
}
check("test nesneleri kaldırıldı", removed === created.length, `${removed}/${created.length}`);

console.log(`\n${pass} geçti, ${fail} başarısız.\n`);
process.exit(fail === 0 ? 0 : 1);

/** Şehirde belirtilen ölçüde boş bir köşe bulur — test tekrar çalıştırılabilir olsun. */
async function findFreeSpot(token, size = 3) {
  const { data } = await call(`/rest/v1/placed_objects?select=local_x,local_y,footprint_w,footprint_h`, { token });
  const taken = new Set();
  for (const o of data ?? []) {
    for (let dx = 0; dx < o.footprint_w; dx++) {
      for (let dy = 0; dy < o.footprint_h; dy++) taken.add(`${o.local_x + dx},${o.local_y + dy}`);
    }
  }
  for (let y = 0; y + size <= 20; y++) {
    for (let x = 0; x + size <= 20; x++) {
      let ok = true;
      for (let dx = 0; dx < size && ok; dx++) {
        for (let dy = 0; dy < size && ok; dy++) if (taken.has(`${x + dx},${y + dy}`)) ok = false;
      }
      if (ok) return { x, y };
    }
  }
  throw new Error("şehirde boş yer yok");
}
