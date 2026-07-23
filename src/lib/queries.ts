import { GameError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type {
  InventoryRow,
  Item,
  ObjectLevel,
  ObjectLevelCost,
  ObjectType,
  Parcel,
  Profile,
  StorageStatus,
  WorldObject,
} from "@/types/game";

/** Sorgu anahtarları tek yerde; geçersiz kılma çağrıları buradan okur. */
export const queryKeys = {
  catalog: ["catalog"] as const,
  items: ["items"] as const,
  levels: ["levels"] as const,
  parcel: ["parcel"] as const,
  profile: (userId: string | null) => ["profile", userId] as const,
  inventory: (userId: string | null) => ["inventory", userId] as const,
  storage: (userId: string | null) => ["storage", userId] as const,
  world: ["world"] as const,
};

/**
 * Sahne `world_objects` görünümünden okur: ham satır + zaman uygulanmış
 * `effective_state`, `finishes_at`, `remaining_seconds`.
 */
const WORLD_COLUMNS =
  "id, owner_id, type_id, local_x, local_y, rotation, state, state_since, state_duration, " +
  "last_collected_at, effective_state, finishes_at, remaining_seconds, " +
  "level, pending_level, effective_level, cycle_seconds, cycle_output, cycle_input, " +
  "pending_cycles, pending_qty, cycle_remaining_seconds";

export async function fetchCatalog(): Promise<ObjectType[]> {
  const { data, error } = await getSupabase()
    .from("object_types")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await getSupabase().from("items").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

/**
 * Seviye tabloları. Birkaç yüz satır, nadiren değişir — bir kez çekip
 * önbellekte tutuluyor. Yükseltme paneli buradan besleniyor.
 */
export async function fetchLevels(): Promise<{
  levels: ObjectLevel[];
  costs: ObjectLevelCost[];
}> {
  const supabase = getSupabase();
  const [levels, costs] = await Promise.all([
    supabase.from("object_levels").select("*").order("type_id").order("level"),
    supabase.from("object_level_costs").select("*"),
  ]);
  if (levels.error) throw levels.error;
  if (costs.error) throw costs.error;
  return { levels: levels.data, costs: costs.data };
}

/** Tahıl ve mal ambarlarının doluluk/kapasite durumu. */
export async function fetchStorage(): Promise<StorageStatus[]> {
  const { data, error } = await getSupabase().from("storage_status").select("*");
  if (error) throw error;
  return data;
}

/**
 * `maybeSingle` kullanılıyor: satır yoksa PostgREST'in ham PGRST116 hatası yerine
 * anlamlı bir kod fırlatıyoruz. Bu durum gerçek hayatta oluyor — jeton hâlâ
 * geçerliyken kullanıcı silinirse oturum açık görünür ama profil satırı yoktur.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError("profile_missing");
  return data;
}

export async function fetchInventory(userId: string): Promise<InventoryRow[]> {
  const { data, error } = await getSupabase()
    .from("inventory")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

/** Faz 1: şehirde tek paylaşılan ring-0 parseli var. Faz 3'te çoğalacak. */
export async function fetchParcel(): Promise<Parcel> {
  const { data, error } = await getSupabase()
    .from("parcels")
    .select("*")
    .eq("ring", 0)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError("parcel_missing");
  return data;
}

/**
 * Dünya anlık görüntüsü.
 *
 * `fetchedAt` kritik: geri sayımlar sunucunun verdiği `remaining_seconds`'ı bu
 * ana göre sayıyor. İyimser güncellemeler önbelleği değiştirirken bu alanı
 * OLDUĞU GİBİ taşır — aksi hâlde her yerleştirmede bütün sayaçlar geri sıçrardı.
 */
export interface WorldSnapshot {
  fetchedAt: number;
  objects: WorldObject[];
}

/** Şehrin tamamı — komşuların binaları dahil (paylaşılan şehir). */
export async function fetchWorld(): Promise<WorldSnapshot> {
  const { data, error } = await getSupabase()
    .from("world_objects")
    .select(WORLD_COLUMNS)
    .order("state_since");
  if (error) throw error;
  // supabase-js'in derleme zamanı select ayrıştırıcısı bu kadar uzun kolon
  // listesini çözemiyor; dönüş tipini imzada zaten daraltıyoruz. Kolon adı
  // yanlışsa PostgREST çalışma zamanında hata verir.
  return { fetchedAt: Date.now(), objects: data as unknown as WorldObject[] };
}
