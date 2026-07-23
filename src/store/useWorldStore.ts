import { create } from "zustand";

import { buildOccupancy, EMPTY_OCCUPANCY, type Occupancy } from "@/lib/collision";
import type { ObjectType, Parcel, Profile, WorldObject } from "@/types/game";

/**
 * Dünya durumunun İZDÜŞÜMÜ — kaynak değil.
 *
 * Faz 1'de tek doğruluk kaynağı veritabanı, istemcideki önbelleği ise TanStack
 * Query tutuyor. Bu store yalnızca sahnenin senkron okuyabileceği türetilmiş bir
 * görünüm: R3F'in `useFrame` döngüsü ve ghost değerlendirmesi `await` edemez.
 *
 * Yazma yetkisi tek bir yerde: <WorldSync/>. Başka hiçbir bileşen buraya yazmaz.
 * Mutasyonlar `useWorldMutations` üzerinden RPC'ye gider.
 */
interface WorldState {
  catalog: ObjectType[];
  typesById: Map<string, ObjectType>;
  objects: WorldObject[];
  occupancy: Occupancy;
  profile: Profile | null;
  parcel: Parcel | null;
  userId: string | null;

  setCatalog: (catalog: ObjectType[]) => void;
  setObjects: (objects: WorldObject[]) => void;
  setProfile: (profile: Profile | null) => void;
  setParcel: (parcel: Parcel | null) => void;
  setUserId: (userId: string | null) => void;

  objectById: (objectId: string | null) => WorldObject | null;
  objectIndexById: (objectId: string | null) => number;
  typeOf: (objectId: string | null) => ObjectType | null;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  catalog: [],
  typesById: new Map(),
  objects: [],
  occupancy: EMPTY_OCCUPANCY,
  profile: null,
  parcel: null,
  userId: null,

  setCatalog: (catalog) => {
    const typesById = new Map(catalog.map((type) => [type.id, type]));
    // Katalog nesnelerden sonra gelebilir; doluluk haritası ikisine de bağlı.
    set({ catalog, typesById, occupancy: buildOccupancy(get().objects, typesById) });
  },

  setObjects: (objects) => set({ objects, occupancy: buildOccupancy(objects, get().typesById) }),

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
}));

/** Senkron katalog araması — sahne bileşenleri ve ghost değerlendirmesi kullanır. */
export function getObjectType(typeId: string | null): ObjectType | null {
  if (!typeId) return null;
  return useWorldStore.getState().typesById.get(typeId) ?? null;
}
