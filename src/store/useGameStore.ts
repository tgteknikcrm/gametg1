import { create } from "zustand";

import { errorMessage, type GameErrorCode } from "@/lib/errors";
import { originToCursor, rotatedFootprint, stepRotation } from "@/lib/grid";
import { evaluatePlacement, type PlacementPlan } from "@/lib/placement";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";
import { asRotation, type GridCell, type Mode, type Rotation } from "@/types/game";

/** Kısa ömürlü kullanıcı bildirimi (ekranın alt ortasında belirir). */
export interface Notice {
  id: number;
  text: string;
  tone: "error" | "success";
}

/**
 * Ghost'u işleyecek mutasyonlar. Store'un kendisi ağa çıkmaz; niyeti hesaplar,
 * çağıran bileşen `useWorldMutations()` ile gelen işleyiciyi verir.
 */
export interface GhostExecutor {
  place: (typeId: string, origin: GridCell, rotation: Rotation) => void;
  move: (objectId: string, origin: GridCell, rotation: Rotation) => void;
}

/**
 * Oyun arayüz durumu. Brief madde 8'de istenen alanlar birebir burada.
 *
 * `ghostValid` / `ghostReason` `ghostPlan`'in türevidir; üçü de her zaman tek bir
 * `set()` içinde birlikte yazılır. Ayrı tutulmalarının sebebi bileşenlerin
 * yalnızca ihtiyaç duydukları alana abone olabilmesi.
 */
interface GameUiState {
  mode: Mode;
  placingTypeId: string | null;
  selectedObjectId: string | null;

  /** İmlecin üzerinde durduğu hücre — hem hover vurgusu hem ghost bunu kullanır. */
  ghostPosition: GridCell | null;
  ghostRotation: Rotation;
  ghostValid: boolean;
  ghostReason: GameErrorCode | null;
  ghostPlan: PlacementPlan | null;

  notice: Notice | null;

  startPlacing: (typeId: string) => void;
  startMoving: (objectId: string) => void;
  setGhostPosition: (cell: GridCell | null) => void;
  rotateGhost: (dir: 1 | -1) => void;
  commitGhost: (executor: GhostExecutor) => void;
  selectObject: (objectId: string | null) => void;
  cancel: () => void;
  notify: (text: string, tone: Notice["tone"]) => void;
  dismissNotice: (id: number) => void;
}

/** Ghost'la ilgili türev alanları sıfırlar; imleç hücresi korunur. */
function clearedPlan(cursor: GridCell | null) {
  return { ghostPosition: cursor, ghostValid: false, ghostReason: null, ghostPlan: null };
}

type GhostInputs = Pick<
  GameUiState,
  "mode" | "placingTypeId" | "selectedObjectId" | "ghostRotation"
>;

/**
 * Ghost'u yeniden değerlendirir. Mod, hücre veya rotasyon değiştiğinde çağrılır.
 *
 * Bu yalnızca ANLIK GÖRSEL geri bildirimdir. Aynı kontroller `place_object` /
 * `move_object` fonksiyonlarında tekrarlanır ve son sözü sunucu söyler.
 */
function evaluate(state: GhostInputs, cursor: GridCell | null) {
  if (!cursor || state.mode === "navigate") return clearedPlan(cursor);

  const world = useWorldStore.getState();
  const moving = state.mode === "move" ? world.objectById(state.selectedObjectId) : null;
  const typeId = state.mode === "move" ? (moving?.type_id ?? null) : state.placingTypeId;
  const type = getObjectType(typeId);
  if (!type) return clearedPlan(cursor);

  const plan = evaluatePlacement({
    type,
    cursor,
    rotation: state.ghostRotation,
    occupancy: world.occupancy,
    ignoreIndex: moving ? world.objectIndexById(moving.id) : -1,
    coins: world.profile?.coins ?? 0,
    level: world.profile?.level ?? 1,
    chargeCost: state.mode === "place",
  });

  return { ghostPosition: cursor, ghostValid: plan.valid, ghostReason: plan.reason, ghostPlan: plan };
}

let noticeCounter = 0;

export const useGameStore = create<GameUiState>((set, get) => ({
  mode: "navigate",
  placingTypeId: null,
  selectedObjectId: null,
  ghostPosition: null,
  ghostRotation: 0,
  ghostValid: false,
  ghostReason: null,
  ghostPlan: null,
  notice: null,

  startPlacing: (typeId) => {
    const base: GhostInputs = {
      mode: "place",
      placingTypeId: typeId,
      selectedObjectId: null,
      ghostRotation: 0,
    };
    set({ ...base, ...evaluate(base, get().ghostPosition) });
  },

  startMoving: (objectId) => {
    const world = useWorldStore.getState();
    const object = world.objectById(objectId);
    const type = getObjectType(object?.type_id ?? null);
    if (!object || !type) return;

    const rotation = asRotation(object.rotation);
    const { w, h } = rotatedFootprint(type.width, type.height, rotation);
    const base: GhostInputs = {
      mode: "move",
      placingTypeId: null,
      selectedObjectId: objectId,
      ghostRotation: rotation,
    };
    // Ghost'u nesnenin mevcut yerinde başlat ki fare oynayana kadar ortada dursun.
    const cursor = originToCursor({ x: object.local_x, y: object.local_y }, w, h);
    set({ ...base, ...evaluate(base, cursor) });
  },

  setGhostPosition: (cell) => {
    const state = get();
    const current = state.ghostPosition;
    // Aynı hücrede kaldıysak hiç yazma: fare hareketi saniyede 60 render tetiklemesin.
    if (cell && current && cell.x === current.x && cell.y === current.y) return;
    if (!cell && !current) return;
    set(evaluate(state, cell));
  },

  rotateGhost: (dir) => {
    const state = get();
    if (state.mode === "navigate") return;
    const ghostRotation = stepRotation(state.ghostRotation, dir);
    set({ ghostRotation, ...evaluate({ ...state, ghostRotation }, state.ghostPosition) });
  },

  commitGhost: (executor) => {
    const state = get();
    const plan = state.ghostPlan;
    if (!plan) return;

    if (!plan.valid) {
      state.notify(errorMessage(plan.reason), "error");
      return;
    }

    if (state.mode === "place" && state.placingTypeId) {
      executor.place(state.placingTypeId, plan.origin, state.ghostRotation);
      // Zincirleme inşaat için modda kalıyoruz; çıkış Escape ile.
      set(evaluate(get(), state.ghostPosition));
      return;
    }

    if (state.mode === "move" && state.selectedObjectId) {
      executor.move(state.selectedObjectId, plan.origin, state.ghostRotation);
      set({ mode: "navigate", ...clearedPlan(state.ghostPosition) });
    }
  },

  selectObject: (objectId) => set({ selectedObjectId: objectId }),

  cancel: () =>
    set((state) => ({
      mode: "navigate",
      placingTypeId: null,
      selectedObjectId: null,
      ...clearedPlan(state.ghostPosition),
    })),

  notify: (text, tone) => set({ notice: { id: ++noticeCounter, text, tone } }),

  dismissNotice: (id) => set((state) => (state.notice?.id === id ? { notice: null } : state)),
}));
