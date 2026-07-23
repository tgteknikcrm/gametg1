import { create } from "zustand";

import { buildOccupancy, EMPTY_OCCUPANCY, type Occupancy } from "@/lib/collision";
import type {
  InventoryRow,
  Item,
  ObjectLevel,
  ObjectLevelCost,
  ObjectType,
  Parcel,
  Profile,
  StorageClass,
  StorageStatus,
  WorldObject,
} from "@/types/game";

/**
 * Dünya durumunun İZDÜŞÜMÜ — kaynak değil.
 *
 * Tek doğruluk kaynağı veritabanı, istemcideki önbelleği ise TanStack Query
 * tutuyor. Bu store yalnızca sahnenin senkron okuyabileceği türetilmiş bir
 * görünüm: R3F'in render döngüsü ve ghost değerlendirmesi `await` edemez.
 *
 * Yazma yetkisi tek bir yerde: `useWorldSync`.
 */
interface WorldState {
  catalog: ObjectType[];
  typesById: Map<string, ObjectType>;
  items: Item[];
  itemsById: Map<string, Item>;
  objects: WorldObject[];
  occupancy: Occupancy;
  /** Nesne listesinin istemciye ulaştığı an — geri sayımın referans noktası. */
  syncedAt: number;
  inventory: Map<string, number>;
  profile: Profile | null;
  parcel: Parcel | null;
  userId: string | null;

  /** "type_id:level" -> o seviyedeki değerler ve o seviyeye çıkma bedeli. */
  levels: Map<string, ObjectLevel>;
  /** "type_id:level" -> o seviyeye çıkmak için gereken malzemeler. */
  levelCosts: Map<string, ObjectLevelCost[]>;
  storage: Map<StorageClass, { stored: number; capacity: number }>;

  setCatalog: (catalog: ObjectType[]) => void;
  setItems: (items: Item[]) => void;
  setObjects: (objects: WorldObject[], syncedAt: number) => void;
  setInventory: (rows: InventoryRow[]) => void;
  setLevels: (data: { levels: ObjectLevel[]; costs: ObjectLevelCost[] }) => void;
  setStorage: (rows: StorageStatus[]) => void;
  setProfile: (profile: Profile | null) => void;
  setParcel: (parcel: Parcel | null) => void;
  setUserId: (userId: string | null) => void;

  levelOf: (typeId: string, level: number) => ObjectLevel | null;
  costsOf: (typeId: string, level: number) => ObjectLevelCost[];

  objectById: (objectId: string | null) => WorldObject | null;
  objectIndexById: (objectId: string | null) => number;
  typeOf: (objectId: string | null) => ObjectType | null;
  quantityOf: (itemId: string | null) => number;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  catalog: [],
  typesById: new Map(),
  items: [],
  itemsById: new Map(),
  objects: [],
  occupancy: EMPTY_OCCUPANCY,
  syncedAt: 0,
  inventory: new Map(),
  profile: null,
  parcel: null,
  userId: null,
  levels: new Map(),
  levelCosts: new Map(),
  storage: new Map(),

  setCatalog: (catalog) => {
    const typesById = new Map(catalog.map((type) => [type.id, type]));
    // Katalog nesnelerden sonra gelebilir; doluluk haritası ikisine de bağlı.
    set({ catalog, typesById, occupancy: buildOccupancy(get().objects, typesById) });
  },

  setItems: (items) => set({ items, itemsById: new Map(items.map((item) => [item.id, item])) }),

  // `syncedAt` çağırandan gelir: sunucudan gelen verinin alındığı an. İyimser
  // güncellemeler bu değeri değiştirmez, yoksa geri sayımlar geri sıçrar.
  setObjects: (objects, syncedAt) =>
    set({ objects, occupancy: buildOccupancy(objects, get().typesById), syncedAt }),

  setInventory: (rows) => set({ inventory: new Map(rows.map((r) => [r.item_id, r.quantity])) }),

  setLevels: ({ levels, costs }) => {
    const byKey = new Map(levels.map((row) => [`${row.type_id}:${row.level}`, row]));
    const costMap = new Map<string, ObjectLevelCost[]>();
    for (const cost of costs) {
      const key = `${cost.type_id}:${cost.level}`;
      const list = costMap.get(key);
      if (list) list.push(cost);
      else costMap.set(key, [cost]);
    }
    set({ levels: byKey, levelCosts: costMap });
  },

  setStorage: (rows) =>
    set({
      storage: new Map(
        rows.map((row) => [
          row.storage_class as StorageClass,
          { stored: row.stored ?? 0, capacity: row.capacity ?? 0 },
        ]),
      ),
    }),

  setProfile: (profile) => set({ profile }),
  setParcel: (parcel) => set({ parcel }),
  setUserId: (userId) => set({ userId }),

  objectById: (objectId) =>
    objectId ? (get().objects.find((object) => object.id === objectId) ?? null) : null,

  objectIndexById: (objectId) =>
    objectId ? get().objects.findIndex((object) => object.id === objectId) : -1,

  typeOf: (objectId) => {
    const object = get().objectById(objectId);
    return object ? (get().typesById.get(object.type_id) ?? null) : null;
  },

  quantityOf: (itemId) => (itemId ? (get().inventory.get(itemId) ?? 0) : 0),

  levelOf: (typeId, level) => get().levels.get(`${typeId}:${level}`) ?? null,
  costsOf: (typeId, level) => get().levelCosts.get(`${typeId}:${level}`) ?? [],
}));

/** Senkron katalog araması — sahne bileşenleri ve ghost değerlendirmesi kullanır. */
export function getObjectType(typeId: string | null): ObjectType | null {
  if (!typeId) return null;
  return useWorldStore.getState().typesById.get(typeId) ?? null;
}
