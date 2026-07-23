/**
 * Faz 2 üretim sözleşmesi testi — `npm run test:production`
 *
 * Zaman geçişini beklemek yerine `state_since`'i geriye alarak ileri sarar.
 * Bu, yönetim API'si (SUPABASE_ACCESS_TOKEN) gerektirir:
 *
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."; $env:SUPABASE_PROJECT_REF="abc"; npm run test:production
 *
 * Anon anahtarla çalışan diğer testler için: npm run test:db
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
const profile = () => call(`/rest/v1/profiles?id=eq.${A.id}&select=coins,xp,level`, { token: A.token }).then((r) => r.data[0]);
const inventory = () => call(`/rest/v1/inventory?user_id=eq.${A.id}&select=item_id,quantity`, { token: A.token }).then((r) => r.data);
const world = () => call(`/rest/v1/world_objects?owner_id=eq.${A.id}&select=*`, { token: A.token }).then((r) => r.data);
const forward = (id, seconds) =>
  sql(`update public.placed_objects set state_since = state_since - make_interval(secs => ${seconds}) where id = '${id}';`);

/** Grid'de boş bir köşe bul — test tekrar tekrar çalıştırılabilir olsun. */
async function freeSpot(size = 3) {
  const { data } = await call(`/rest/v1/placed_objects?select=local_x,local_y,footprint_w,footprint_h`, { token: A.token });
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

console.log("\n1) İnşaat süresi uygulanıyor");
const spot = await freeSpot(3);
const placed = await rpc("place_object", { p_type_id: "wheat_field", p_x: spot.x, p_y: spot.y, p_rotation: 0 }, A.token);
const id = placed.data.id;
check("durum 'building'", placed.data.state === "building", placed.data.state);

let view = (await world()).find((o) => o.id === id);
check("görünüm 'building' diyor", view.effective_state === "building");
check("kalan süre sunucudan geliyor", view.remaining_seconds > 0, String(view.remaining_seconds));
check("inşaat bitmeden üretim reddedildi",
  (await rpc("start_production", { p_object_id: id }, A.token)).data?.message === "still_building");

console.log("\n2) Tembel zaman: cron yok, okuma anında hesaplanıyor");
await forward(id, 30);
view = (await world()).find((o) => o.id === id);
check("etkin durum 'idle'", view.effective_state === "idle", view.effective_state);
check("saklanan durum hâlâ 'building'", view.state === "building", view.state);

console.log("\n3) Üretim döngüsü");
check("üretim başladı", (await rpc("start_production", { p_object_id: id }, A.token)).data?.state === "producing");
check("üretirken tekrar başlatılamaz",
  (await rpc("start_production", { p_object_id: id }, A.token)).data?.message === "already_producing");
check("süre dolmadan hasat -> not_ready",
  (await rpc("harvest_object", { p_object_id: id }, A.token)).data?.message === "not_ready");

await forward(id, 130);
const xpBefore = (await profile()).xp;
const harvest = await rpc("harvest_object", { p_object_id: id }, A.token);
check("hasat başarılı", harvest.data?.[0]?.item_id === "wheat" && harvest.data?.[0]?.quantity === 10, JSON.stringify(harvest.data));
check("envantere girdi", (await inventory()).find((i) => i.item_id === "wheat")?.quantity >= 10);
check("hasat XP verdi", (await profile()).xp > xpBefore);
check("boş binadan tekrar hasat edilemez",
  (await rpc("harvest_object", { p_object_id: id }, A.token)).data?.message === "not_ready");

console.log("\n4) NPC pazarı ve fiyat makası");
const coinsBefore = (await profile()).coins;
const sold = await rpc("sell_item", { p_item_id: "wheat", p_quantity: 10 }, A.token);
check("satış geliri sunucudan hesaplandı", sold.data === 10, JSON.stringify(sold.data));
check("altın arttı", (await profile()).coins === coinsBefore + 10);
check("olmayan malı satamaz",
  (await rpc("sell_item", { p_item_id: "wheat", p_quantity: 99 }, A.token)).data?.message === "insufficient_items");
check("negatif miktar reddedildi",
  (await rpc("sell_item", { p_item_id: "wheat", p_quantity: -5 }, A.token)).data?.message === "invalid_quantity");

const items = await call(`/rest/v1/items?select=id,npc_buy_price,npc_sell_price`, { token: A.token });
const arbitrage = items.data.filter((i) => i.npc_buy_price >= i.npc_sell_price && i.npc_sell_price > 0);
check("al-sat arbitrajı yok (para basılamaz)", arbitrage.length === 0, JSON.stringify(arbitrage));

console.log("\n5) Girdi gerektiren üretim");
await sql(`update public.profiles set level = 5, coins = 50000 where id = '${A.id}';`);
const millSpot = await freeSpot(2);
const mill = await rpc("place_object", { p_type_id: "mill", p_x: millSpot.x, p_y: millSpot.y, p_rotation: 0 }, A.token);
await forward(mill.data.id, 200);
check("hammadde yoksa -> missing_input",
  (await rpc("start_production", { p_object_id: mill.data.id }, A.token)).data?.message === "missing_input");
await rpc("buy_item", { p_item_id: "wheat", p_quantity: 8 }, A.token);
check("hammadde alınınca başladı",
  (await rpc("start_production", { p_object_id: mill.data.id }, A.token)).data?.state === "producing");
check("hammadde tüketildi", (await inventory()).find((i) => i.item_id === "wheat")?.quantity === 0);
await forward(mill.data.id, 250);
check("işlenmiş mal üretildi",
  (await rpc("harvest_object", { p_object_id: mill.data.id }, A.token)).data?.[0]?.item_id === "flour");

console.log("\n6) Sahiplik");
const B = await signUp(`prod-b-${stamp}@ornek.test`);
check("başkasının binasını hasat edemez",
  (await rpc("harvest_object", { p_object_id: id }, B.token)).data?.message === "not_owner");
check("başkasının binasında üretim başlatamaz",
  (await rpc("start_production", { p_object_id: id }, B.token)).data?.message === "not_owner");
const directInv = await call(`/rest/v1/inventory`, {
  token: A.token, method: "POST", body: { user_id: A.id, item_id: "bread", quantity: 9999 },
});
check("envantere doğrudan yazılamıyor", directInv.status >= 400, String(directInv.status));
check("başkasının envanteri görünmüyor",
  ((await call(`/rest/v1/inventory?user_id=eq.${A.id}&select=*`, { token: B.token })).data?.length ?? 0) === 0);

console.log("\n7) Para defteri");
const ledger = await call(`/rest/v1/ledger?user_id=eq.${A.id}&select=reason,amount`, { token: A.token });
const reasons = new Set(ledger.data.map((l) => l.reason));
check("inşaat gideri kaydedildi", reasons.has("build"));
check("satış geliri kaydedildi", reasons.has("npc_sale"));
check("alım gideri kaydedildi", reasons.has("npc_purchase"));
check("giderler negatif", ledger.data.filter((l) => l.reason === "build").every((l) => l.amount < 0));

console.log("\n8) Temizlik");
const mine = await world();
let removed = 0;
for (const o of mine) {
  if ((await rpc("remove_object", { p_object_id: o.id }, A.token)).status === 200) removed++;
}
check("test binaları kaldırıldı", removed === mine.length, `${removed}/${mine.length}`);

console.log(`\n${pass} geçti, ${fail} başarısız.\n`);
process.exit(fail === 0 ? 0 : 1);
