/**
 * Faz 0 matematik doğrulaması — `npm run verify`
 *
 * Grid dönüşümleri, çok hücreli ayak izi, rotasyon ve çarpışma mantığı tarayıcı
 * açmadan burada sınanır. Faz 1'de aynı senaryolar pgTAP ile veritabanı tarafında
 * tekrarlanacak; bu dosya istemci tarafındaki ön kontrolün referansı olarak kalacak.
 */
import { buildOccupancy, occupiedCells } from "@/lib/collision";
import { TYPES_BY_ID } from "@/lib/catalog";
import {
  GRID_SIZE,
  cellToWorld,
  footprintCenterWorld,
  footprintCells,
  footprintOrigin,
  originToCursor,
  rotatedFootprint,
  stepRotation,
  worldToCell,
} from "@/lib/grid";
import { evaluatePlacement } from "@/lib/placement";
import type { PlacedObject } from "@/types/game";

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

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
  const field: PlacedObject = { id: "a", type_id: "quarry", local_x: 5, local_y: 5, rotation: 0, state: "idle" };
  const occupancy = buildOccupancy([field], TYPES_BY_ID);
  const type = TYPES_BY_ID.get("quarry")!;

  check("taş ocağı 3x2 = 6 hücre", occupiedCells(field, type).length === 6);
  check("dolu hücre sayısı 6", occupancy.reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0) === 6);

  const wallet = { coins: 99999, level: 9 };

  const overlap = evaluatePlacement({ type, cursor: { x: 6, y: 6 }, rotation: 0, occupancy, ...wallet });
  check("üst üste yerleştirme reddedildi", !overlap.valid && overlap.reason === "cell_occupied");

  const beside = evaluatePlacement({ type, cursor: { x: 6, y: 8 }, rotation: 0, occupancy, ...wallet });
  check("bitişik hücreye yerleştirme kabul edildi", beside.valid);

  const rotatedOverlap = evaluatePlacement({ type, cursor: { x: 6, y: 7 }, rotation: 90, occupancy, ...wallet });
  check("90° döndürülmüş hâli çakışmayı yakalar", !rotatedOverlap.valid);

  const edge = evaluatePlacement({ type, cursor: { x: 19, y: 19 }, rotation: 0, occupancy, ...wallet });
  check("grid dışına taşma reddedildi", !edge.valid && edge.reason === "out_of_bounds");

  const selfMove = evaluatePlacement({
    type, cursor: { x: 7, y: 6 }, rotation: 0, occupancy, ignoreIndex: 0, ...wallet,
  });
  check("kendi üzerine kayan taşıma serbest", selfMove.valid);

  const blockedMove = evaluatePlacement({
    type, cursor: { x: 6, y: 6 }, rotation: 0, occupancy, ignoreIndex: 1, ...wallet,
  });
  check("başkasının indeksiyle taşıma engellenir", !blockedMove.valid);
}

console.log("\n5) Ekonomi ve seviye kapıları");
{
  const occupancy = buildOccupancy([], TYPES_BY_ID);
  const townHall = TYPES_BY_ID.get("town_hall")!;

  const poor = evaluatePlacement({
    type: townHall, cursor: { x: 10, y: 10 }, rotation: 0, occupancy, coins: 10, level: 9,
  });
  check("parası yetmeyen reddedildi", !poor.valid && poor.reason === "insufficient_funds");

  const lowLevel = evaluatePlacement({
    type: townHall, cursor: { x: 10, y: 10 }, rotation: 0, occupancy, coins: 999999, level: 1,
  });
  check("seviyesi yetmeyen reddedildi", !lowLevel.valid && lowLevel.reason === "level_required");

  const free = evaluatePlacement({
    type: townHall, cursor: { x: 10, y: 10 }, rotation: 0, occupancy, coins: 0, level: 9, chargeCost: false,
  });
  check("taşımada maliyet aranmaz", free.valid);
}

console.log(failures === 0 ? "\nTüm kontroller geçti.\n" : `\n${failures} kontrol başarısız.\n`);
process.exit(failures === 0 ? 0 : 1);
