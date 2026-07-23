/**
 * Faz 2.5 üretim sözleşmesi testi — `npm run test:production`
 *
 * Sürekli üretim, bina seviyeleri, depo kapasitesi ve elmas.
 * Zamanı beklemek yerine `produced_since`/`state_since`'i geriye alarak ileri
 * sarar; bu yüzden yönetim API'si gerekir:
 *
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; $env:SUPABASE_PROJECT_REF="abc"; npm run test:production
 */
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error(
    "Bu test zamanı ileri sarmak için yönetim API'sine ihtiyaç duyuyor.\n" +
      "SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF ortam değişkenlerini ayarla.",
  );
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name} ${detail}`); }
};

const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const call = async (path, { token: jwt, method = "GET", body } = {}) => {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt ?? anonKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};
const rpc = (fn, args, jwt) => call(`/rest/v1/rpc/${fn}`, { token: jwt, method: "POST", body: args });

const signUp = async (email) => {
  const body = await fetch(`${url}/auth/v1/signup`, {
    method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "prototip123" }),
  }).then((r) => r.json());
  if (!body.access_token) throw new Error(JSON.stringify(body).slice(0, 300));
  return { token: body.access_token, id: body.user.id };
};

const stamp = Date.now().toString(36);
const A = await signUp(`prod-${stamp}@ornek.test`);
const T = A.token;
const profile = () => call(`/rest/v1/profiles?id=eq.${A.id}&select=coins,gems,xp,level`, { token: T }).then((r) => r.data[0]);
const inventory = () => call(`/rest/v1/inventory?user_id=eq.${A.id}&select=item_id,quantity`, { token: T }).then((r) => r.data);
const world = () => call(`/rest/v1/world_objects?owner_id=eq.${A.id}&select=*`, { token: T }).then((r) => r.data);
const storage = () => call(`/rest/v1/storage_status?select=*`, { token: T }).then((r) => r.data);
const forward = (id, seconds) => sql(`
  update public.placed_objects
     set state_since = state_since - make_interval(secs => ${seconds}),
         produced_since = produced_since - make_interval(secs => ${seconds})
   where id = '${id}';`);

/** Grid'de boş bir köşe bul — test tekrar tekrar çalıştırılabilir olsun. */
async function freeSpot(size = 3) {
  const { data } = await call(`/rest/v1/placed_objects?select=local_x,local_y,footprint_w,footprint_h`, { token: T });
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

console.log("\n1) Başlangıç ve yerleştirme");
check("elmasla başlıyor", (await profile()).gems > 0, String((await profile()).gems));

const spot = await freeSpot(3);
const placed = await rpc("place_object", { p_type_id: "wheat_field", p_x: spot.x, p_y: spot.y, p_rotation: 0 }, T);
const id = placed.data.id;
check("seviye 1", placed.data.level === 1);
check("state_duration inşaat süresi", placed.data.state_duration === 20, String(placed.data.state_duration));
check("üretim penceresi açıldı", !!placed.data.produced_since);

let w = (await world()).find((o) => o.id === id);
check("görünüm 'building'", w.effective_state === "building", w.effective_state);
check("tur değerleri seviyeden geliyor", w.cycle_seconds === 120 && w.cycle_output === 10,
  `${w.cycle_seconds}/${w.cycle_output}`);

console.log("\n2) SÜREKLİ ÜRETİM — tıklama yok, tembel hesap");
await forward(id, 20 + 360);
w = (await world()).find((o) => o.id === id);
check("inşaat kendiliğinden bitti", w.effective_state === "idle", w.effective_state);
check("3 tur birikti", w.pending_cycles === 3, String(w.pending_cycles));
check("30 buğday bekliyor", w.pending_qty === 30, String(w.pending_qty));
check("mevcut turun kalanı hesaplanıyor",
  w.cycle_remaining_seconds > 0 && w.cycle_remaining_seconds <= 120, String(w.cycle_remaining_seconds));

const c1 = await rpc("collect_all", {}, T);
check("toplama tek çağrıda", c1.data?.[0]?.collected === 30, JSON.stringify(c1.data));
check("envantere girdi", (await inventory()).find((i) => i.item_id === "wheat")?.quantity === 30);
w = (await world()).find((o) => o.id === id);
check("biriken sıfırlandı ama sayaç devam ediyor",
  w.pending_cycles === 0 && w.cycle_remaining_seconds > 0, JSON.stringify({ c: w.pending_cycles, r: w.cycle_remaining_seconds }));

console.log("\n3) Depo kapasitesi üretimi sınırlıyor");
const grain = (await storage()).find((r) => r.storage_class === "grain");
check("taban kapasite", grain.capacity === 200, JSON.stringify(grain));
await forward(id, 120 * 40);
const c2 = await rpc("collect_all", {}, T);
check("kapasiteye kadar toplandı", c2.data?.[0]?.collected === 170, JSON.stringify(c2.data?.[0]));
check("depo doldu bayrağı", c2.data?.[0]?.blocked_full === true);

await sql(`update public.profiles set coins = 300000, level = 8 where id = '${A.id}';`);
const gspot = await freeSpot(3);
const granary = await rpc("place_object", { p_type_id: "granary", p_x: gspot.x, p_y: gspot.y, p_rotation: 0 }, T);
await forward(granary.data.id, 200);
check("tahıl ambarı kapasiteyi büyüttü",
  (await storage()).find((r) => r.storage_class === "grain").capacity === 600,
  JSON.stringify((await storage()).find((r) => r.storage_class === "grain")));

console.log("\n4) SEVİYE — altın + malzeme + süre");
await sql(`delete from public.inventory where user_id = '${A.id}' and item_id = 'timber';`);
check("malzeme yoksa reddedildi",
  (await rpc("upgrade_object", { p_object_id: id }, T)).data?.message === "missing_materials");

const need = await call(`/rest/v1/object_level_costs?type_id=eq.wheat_field&level=eq.2&select=item_id,quantity`, { token: T });
for (const c of need.data) await rpc("buy_item", { p_item_id: c.item_id, p_quantity: c.quantity }, T);

const coinsBefore = (await profile()).coins;
const up = await rpc("upgrade_object", { p_object_id: id }, T);
check("yükseltme başladı", up.data?.pending_level === 2, JSON.stringify(up.data).slice(0, 120));
check("altın düşüldü", (await profile()).coins < coinsBefore);
check("malzeme tüketildi", ((await inventory()).find((i) => i.item_id === "timber")?.quantity ?? 0) === 0);

w = (await world()).find((o) => o.id === id);
check("yükseltirken 'building'", w.effective_state === "building");
check("yükseltirken etkin seviye eski", w.effective_level === 1, String(w.effective_level));
check("yükseltirken üretim durdu", w.pending_cycles === 0, String(w.pending_cycles));
check("yükseltme sürerken tekrar yükseltilemez",
  (await rpc("upgrade_object", { p_object_id: id }, T)).data?.message === "still_building");

console.log("\n5) ELMASLA ANINDA BİTİRME");
const gemsBefore = (await profile()).gems;
const rush = await rpc("rush_object", { p_object_id: id }, T);
check("elmas harcandı", rush.status === 200 && rush.data > 0, JSON.stringify(rush.data));
check("bakiye düştü", (await profile()).gems === gemsBefore - rush.data);
w = (await world()).find((o) => o.id === id);
check("yükseltme anında bitti", w.effective_state === "idle" && w.level === 2, `${w.effective_state}/${w.level}`);
check("seviye 2 daha çok üretiyor", w.cycle_output > 10, String(w.cycle_output));
check("seviye 2 turu daha kısa", w.cycle_seconds < 120, String(w.cycle_seconds));
check("bitmiş işte rush reddedildi",
  (await rpc("rush_object", { p_object_id: id }, T)).data?.message === "nothing_to_rush");

console.log("\n6) Zincir tek toplamada ilerliyor");
await sql(`delete from public.inventory where user_id = '${A.id}';`);
const mspot = await freeSpot(2);
const mill = await rpc("place_object", { p_type_id: "mill", p_x: mspot.x, p_y: mspot.y, p_rotation: 0 }, T);
await forward(mill.data.id, 180 + 240 * 2);
await forward(id, 3600);
const c3 = await rpc("collect_all", {}, T);
check("aynı toplamada hem buğday hem un üretildi",
  (c3.data?.[0]?.items?.wheat ?? 0) > 0 && (c3.data?.[0]?.items?.flour ?? 0) > 0,
  JSON.stringify(c3.data?.[0]?.items));

console.log("\n7) Yetki ve fiyat bütünlüğü");
const B = await signUp(`prod-b-${stamp}@ornek.test`);
check("başkasının binası yükseltilemez",
  (await rpc("upgrade_object", { p_object_id: id }, B.token)).data?.message === "not_owner");
check("başkasının binası rush edilemez",
  (await rpc("rush_object", { p_object_id: id }, B.token)).data?.message === "not_owner");
check("seviye tablosuna yazılamıyor",
  (await call(`/rest/v1/object_levels`, { token: T, method: "POST", body: { type_id: "wheat_field", level: 99 } })).status >= 400);
await call(`/rest/v1/profiles?id=eq.${A.id}`, { token: T, method: "PATCH", body: { gems: 999999 } });
check("elmas doğrudan artırılamıyor", (await profile()).gems !== 999999);
check("başkasının envanteri görünmüyor",
  ((await call(`/rest/v1/inventory?user_id=eq.${A.id}&select=*`, { token: B.token })).data?.length ?? 0) === 0);

const items = await call(`/rest/v1/items?select=id,npc_buy_price,npc_sell_price`, { token: T });
const arbitrage = items.data.filter((i) => i.npc_buy_price >= i.npc_sell_price && i.npc_sell_price > 0);
check("al-sat arbitrajı yok (para basılamaz)", arbitrage.length === 0, JSON.stringify(arbitrage));

console.log("\n8) Para defteri");
const ledger = await call(`/rest/v1/ledger?user_id=eq.${A.id}&select=reason,amount,currency`, { token: T });
const reasons = new Set(ledger.data.map((l) => l.reason));
check("inşaat gideri kaydedildi", reasons.has("build"));
check("yükseltme gideri kaydedildi", reasons.has("upgrade"));
check("elmas harcaması ayrı para biriminde",
  ledger.data.some((l) => l.reason === "rush" && l.currency === "gem"),
  JSON.stringify(ledger.data.filter((l) => l.reason === "rush")));

console.log("\n9) Temizlik");
const mine = await world();
let removed = 0;
for (const o of mine) {
  if ((await rpc("remove_object", { p_object_id: o.id }, T)).status === 200) removed++;
}
check("test binaları kaldırıldı", removed === mine.length, `${removed}/${mine.length}`);

console.log(`\n${pass} geçti, ${fail} başarısız.\n`);
process.exit(fail === 0 ? 0 : 1);
