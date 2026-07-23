/**
 * Grid ve yerleştirme matematiği doğrulaması — `npm run verify`
 *
 * Yalnızca saf fonksiyonları sınar; veritabanı veya tarayıcı gerekmez.
 * Sunucu tarafındaki karşılığı `scripts/db-contract-test.mjs` ile ayrıca test edilir.
 */
import { buildOccupancy, occupiedCells } from "@/lib/collision";
import { formatDuration, formatDurationLong } from "@/lib/duration";
import { GameError, isFatalSessionError, toGameErrorCode, toGameErrorMessage } from "@/lib/errors";
import { isStale, localProgress, localRemainingSeconds, localState } from "@/lib/production";
import {
  GRID_SIZE,
  cellToWorld,
  footprintCells,
  footprintCenterWorld,
  footprintOrigin,
  originToCursor,
  rotatedFootprint,
  stepRotation,
  worldToCell,
} from "@/lib/grid";
import { evaluatePlacement } from "@/lib/placement";
import type { ObjectType, WorldObject } from "@/types/game";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Test sabiti — katalog artık veritabanında olduğu için burada fixture kuruyoruz. */
function makeType(overrides: Partial<ObjectType> & Pick<ObjectType, "id" | "width" | "height">): ObjectType {
  return {
    category: "production",
    name: overrides.id,
    model_key: overrides.id,
    cost: 100,
    build_seconds: 0,
    produce_seconds: null,
    input_item_id: null,
    input_qty: null,
    output_item_id: null,
    output_qty: null,
    worker_slots: 0,
    population_capacity: 0,
    maintenance_per_hour: 0,
    level_required: 1,
    refund_rate: 0.5,
    xp_reward: 10,
    harvest_xp: 5,
    color: "#ffffff",
    block_height: 1,
    sort_order: 0,
    is_active: true,
    ...overrides,
  };
}

const QUARRY = makeType({ id: "quarry", width: 3, height: 2, cost: 520, level_required: 3 });
const TOWN_HALL = makeType({ id: "town_hall", width: 4, height: 4, cost: 2500, level_required: 6 });
const TYPES = new Map<string, ObjectType>([
  [QUARRY.id, QUARRY],
  [TOWN_HALL.id, TOWN_HALL],
]);

console.log("\n1) Dünya <-> hücre dönüşümü");
{
  let roundTripOk = true;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const [wx, wz] = cellToWorld(x, y);
      const back = worldToCell(wx, wz);
      if (!back || back.x !== x || back.y !== y) roundTripOk = false;
    }
  }
  check("400 hücrenin tamamı gidiş-dönüş tutarlı", roundTripOk);
  check("grid dışı -X reddedildi", worldToCell(-11, 0) === null);
  check("grid dışı +Z reddedildi", worldToCell(0, 11) === null);
  check("sol-üst köşe (0,0)", JSON.stringify(worldToCell(-9.9, -9.9)) === '{"x":0,"y":0}');
  check("sağ-alt köşe (19,19)", JSON.stringify(worldToCell(9.9, 9.9)) === '{"x":19,"y":19}');
}

console.log("\n2) Rotasyon");
{
  check("0° -> 3x2", JSON.stringify(rotatedFootprint(3, 2, 0)) === '{"w":3,"h":2}');
  check("90° -> 2x3", JSON.stringify(rotatedFootprint(3, 2, 90)) === '{"w":2,"h":3}');
  check("180° -> 3x2", JSON.stringify(rotatedFootprint(3, 2, 180)) === '{"w":3,"h":2}');
  check("270° -> 2x3", JSON.stringify(rotatedFootprint(3, 2, 270)) === '{"w":2,"h":3}');
  check("E ile 270 -> 0", stepRotation(270, 1) === 0);
  check("Q ile 0 -> 270", stepRotation(0, -1) === 270);
}

console.log("\n3) Ayak izi (imlece ortalanmış)");
{
  const origin = footprintOrigin({ x: 10, y: 10 }, 3, 2);
  check("3x2 imleçte ortalanır -> (9,10)", origin.x === 9 && origin.y === 10);
  check("ters dönüşüm imleci geri verir", JSON.stringify(originToCursor(origin, 3, 2)) === '{"x":10,"y":10}');

  const cells = footprintCells(origin, 3, 2);
  check("3x2 tam altı hücre kaplar", cells.length === 6 && cells.every((c) => c >= 0));
  check("hücreler beklenen indekslerde", cells.join(",") === "209,210,211,229,230,231");

  const [cx, cz] = footprintCenterWorld(origin, 3, 2);
  check("merkez dünya koordinatı doğru", cx === 0.5 && cz === 1);

  const outside = footprintCells({ x: 19, y: 19 }, 2, 2);
  check("grid taşması -1 ile işaretlenir", outside.filter((c) => c === -1).length === 3);
}

console.log("\n4) Çarpışma ve doluluk haritası");
{
  const field: WorldObject = {
    id: "a", owner_id: "u", type_id: "quarry",
    local_x: 5, local_y: 5, rotation: 0, state: "idle", state_since: "",
    last_collected_at: null, effective_state: "idle", finishes_at: null, remaining_seconds: 0,
  };
  const occupancy = buildOccupancy([field], TYPES);

  check("taş ocağı 3x2 = 6 hücre", occupiedCells(field, QUARRY).length === 6);
  check("dolu hücre sayısı 6", occupancy.reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0) === 6);

  const wallet = { coins: 99999, level: 9 };
  const at = (x: number, y: number, rotation: 0 | 90 = 0, extra = {}) =>
    evaluatePlacement({ type: QUARRY, cursor: { x, y }, rotation, occupancy, ...wallet, ...extra });

  check("üst üste yerleştirme reddedildi", at(6, 6).reason === "cell_occupied");
  check("bitişik hücreye yerleştirme kabul edildi", at(6, 8).valid);
  check("90° döndürülmüş hâli çakışmayı yakalar", !at(6, 7, 90).valid);
  check("grid dışına taşma reddedildi", at(19, 19).reason === "out_of_bounds");
  check("kendi üzerine kayan taşıma serbest", at(7, 6, 0, { ignoreIndex: 0 }).valid);
  check("başkasının indeksiyle taşıma engellenir", !at(6, 6, 0, { ignoreIndex: 1 }).valid);
}

console.log("\n5) Ekonomi ve seviye kapıları");
{
  const occupancy = buildOccupancy([], TYPES);
  const at = (coins: number, level: number, chargeCost = true) =>
    evaluatePlacement({
      type: TOWN_HALL, cursor: { x: 10, y: 10 }, rotation: 0, occupancy, coins, level, chargeCost,
    });

  check("parası yetmeyen reddedildi", at(10, 9).reason === "insufficient_funds");
  check("seviyesi yetmeyen reddedildi", at(999999, 1).reason === "level_required");
  check("taşımada maliyet aranmaz", at(0, 9, false).valid);
}

console.log("\n6) Hata eşlemesi");
{
  // Sunucunun fırlattığı exception adı doğrudan koda çevrilmeli.
  check("PL/pgSQL exception adı tanınıyor", toGameErrorCode({ message: "cell_occupied" }) === "cell_occupied");
  check("bilinmeyen mesaj -> unknown", toGameErrorCode({ message: "bir şeyler ters gitti" }) === "unknown");

  // Jeton geçerliyken profil satırı yoksa PostgREST bunu döner.
  check("PGRST116 -> not_found", toGameErrorCode({ code: "PGRST116", message: "Cannot coerce" }) === "not_found");
  check("yetki hatası -> not_authenticated", toGameErrorCode({ code: "42501", message: "denied" }) === "not_authenticated");
  check("ağ hatası -> network", toGameErrorCode(new TypeError("Failed to fetch")) === "network");

  // İstemcinin kendi fırlattığı kodlu hata.
  check("GameError kodunu taşıyor", toGameErrorCode(new GameError("profile_missing")) === "profile_missing");
  check("profil eksikse oturum kurtarılamaz", isFatalSessionError("profile_missing"));
  check("dolu hücre oturumu bozmaz", !isFatalSessionError("cell_occupied"));
  check("her kodun Türkçe karşılığı var", toGameErrorMessage(new GameError("parcel_missing")).length > 0);
}

console.log("\n7) Süre biçimleme (saniye → hafta)");
{
  check("saniye", formatDuration(45) === "45sn", formatDuration(45));
  check("dakika + saniye", formatDuration(200) === "3dk 20sn", formatDuration(200));
  check("tam dakika", formatDuration(120) === "2dk", formatDuration(120));
  check("saat + dakika", formatDuration(3900) === "1sa 5dk", formatDuration(3900));
  check("gün + saat", formatDuration(187200) === "2g 4sa", formatDuration(187200));
  check("hafta + gün", formatDuration(864000) === "1h 3g", formatDuration(864000));
  check("sıfır -> hazır", formatDuration(0) === "hazır");
  check("negatif kırılmıyor", formatDuration(-10) === "hazır");
  check("uzun biçim", formatDurationLong(3900) === "1 saat 5 dakika", formatDurationLong(3900));
}

console.log("\n8) Üretim zamanı (istemci sayacı)");
{
  const t0 = 1_000_000;
  const producing: WorldObject = {
    id: "p", owner_id: "u", type_id: "wheat_field", local_x: 0, local_y: 0, rotation: 0,
    state: "producing", state_since: "", last_collected_at: null,
    effective_state: "producing", finishes_at: null, remaining_seconds: 120,
  };

  check("hemen sonra 120 sn kaldı", localRemainingSeconds(producing, t0, t0) === 120);
  check("30 sn sonra 90 kaldı", localRemainingSeconds(producing, t0, t0 + 30_000) === 90);
  check("süre dolunca 0", localRemainingSeconds(producing, t0, t0 + 200_000) === 0);
  check("geriye giden saat şişirmiyor", localRemainingSeconds(producing, t0, t0 - 50_000) === 120);

  check("dolmadan hâlâ 'producing'", localState(producing, t0, t0 + 60_000) === "producing");
  check("dolunca yerel olarak 'ready'", localState(producing, t0, t0 + 130_000) === "ready");
  check("sunucu bayat kaldıysa yakalanıyor", isStale(producing, t0, t0 + 130_000));
  check("henüz bitmediyse bayat değil", !isStale(producing, t0, t0 + 10_000));

  check("ilerleme yarıda %50", localProgress(producing, 120, t0, t0 + 60_000) === 0.5);
  check("ilerleme sonda %100", localProgress(producing, 120, t0, t0 + 130_000) === 1);

  const building: WorldObject = { ...producing, state: "building", effective_state: "building", remaining_seconds: 20 };
  check("inşaat bitince 'idle'", localState(building, t0, t0 + 25_000) === "idle");

  const idle: WorldObject = { ...producing, state: "idle", effective_state: "idle", remaining_seconds: 0 };
  check("boştaki bina bayat sayılmaz", !isStale(idle, t0, t0 + 999_000));
}

console.log(failures === 0 ? "\nTüm kontroller geçti.\n" : `\n${failures} kontrol başarısız.\n`);
process.exit(failures === 0 ? 0 : 1);
