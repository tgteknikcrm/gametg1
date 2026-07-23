import { create } from "zustand";

import { getObjectType, TYPES_BY_ID } from "@/lib/catalog";
import { buildOccupancy, type Occupancy } from "@/lib/collision";
import { CELL_COUNT } from "@/lib/grid";
import type { GridCell, PlacedObject, PlayerState, Rotation } from "@/types/game";

/**
 * Dünya durumu — Faz 0'da tamamen istemcide, bellekte.
 *
 * Faz 1'de bu store SİLİNECEK: `objects` TanStack Query cache'ine, mutasyonlar
 * `supabase.rpc("place_object" | "move_object" | "remove_object")` çağrılarına taşınacak.
 * Bu yüzden UI store'undan ayrı tutuldu — o zaman tek dosya silinip yerine hook gelecek.
 */
interface WorldState {
  objects: PlacedObject[];
  /** `objects` her değiştiğinde yeniden kurulan doluluk haritası. */
  occupancy: Occupancy;
  player: PlayerState;

  placeObject: (typeId: string, origin: GridCell, rotation: Rotation) => boolean;
  moveObject: (objectId: string, origin: GridCell, rotation: Rotation) => boolean;
  removeObject: (objectId: string) => void;
  objectById: (objectId: string | null) => PlacedObject | null;
  objectIndexById: (objectId: string | null) => number;
}

/** Faz 0 başlangıç cüzdanı — Faz 1'de `profiles` satırından gelecek. */
const INITIAL_PLAYER: PlayerState = {
  coins: 5000,
  energy: 45,
  energy_max: 60,
  level: 3,
  xp: 260,
  xp_to_next: 600,
};

/** Yıkımda maliyetin bu oranı geri verilir — Faz 1'de `object_types`'a taşınacak. */
const REFUND_RATE = 0.5;

let idCounter = 0;
const nextId = () => `obj_${++idCounter}`;

/** Nesne listesi değiştiğinde doluluk haritasını birlikte güncelleyen tek nokta. */
function withObjects(objects: PlacedObject[]) {
  return { objects, occupancy: buildOccupancy(objects, TYPES_BY_ID) };
}

/** XP eşiği aşıldıkça seviye atlatır; eşik her seviyede %60 büyür. */
function applyXp(player: PlayerState, gained: number): PlayerState {
  let { level, xp, xp_to_next } = player;
  xp += gained;
  while (xp >= xp_to_next) {
    xp -= xp_to_next;
    level += 1;
    xp_to_next = Math.round(xp_to_next * 1.6);
  }
  return { ...player, level, xp, xp_to_next };
}

export const useWorldStore = create<WorldState>((set, get) => ({
  objects: [],
  occupancy: new Int32Array(CELL_COUNT),
  player: INITIAL_PLAYER,

  placeObject: (typeId, origin, rotation) => {
    const type = getObjectType(typeId);
    if (!type) return false;

    const { objects, player } = get();
    if (player.coins < type.cost) return false;

    const placed: PlacedObject = {
      id: nextId(),
      type_id: type.id,
      local_x: origin.x,
      local_y: origin.y,
      rotation,
      // Faz 0'da zaman makinesi yok; Faz 2'de "building" + state_since ile başlayacak.
      state: "idle",
    };

    set({
      ...withObjects([...objects, placed]),
      player: applyXp({ ...player, coins: player.coins - type.cost }, Math.round(type.cost / 10)),
    });
    return true;
  },

  moveObject: (objectId, origin, rotation) => {
    const { objects } = get();
    const index = objects.findIndex((object) => object.id === objectId);
    if (index === -1) return false;

    const next = objects.slice();
    next[index] = { ...next[index], local_x: origin.x, local_y: origin.y, rotation };
    set(withObjects(next));
    return true;
  },

  removeObject: (objectId) => {
    const { objects, player } = get();
    const target = objects.find((object) => object.id === objectId);
    if (!target) return;

    const type = getObjectType(target.type_id);
    const refund = type ? Math.round(type.cost * REFUND_RATE) : 0;

    set({
      ...withObjects(objects.filter((object) => object.id !== objectId)),
      player: { ...player, coins: player.coins + refund },
    });
  },

  objectById: (objectId) =>
    objectId ? (get().objects.find((object) => object.id === objectId) ?? null) : null,

  objectIndexById: (objectId) =>
    objectId ? get().objects.findIndex((object) => object.id === objectId) : -1,
}));
