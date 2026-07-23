import { GameError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type {
  InventoryRow,
  Item,
  ObjectType,
  Parcel,
  Profile,
  WorldObject,
} from "@/types/game";

/** Sorgu anahtarları tek yerde; geçersiz kılma çağrıları buradan okur. */
export const queryKeys = {
  catalog: ["catalog"] as const,
  items: ["items"] as const,
  parcel: ["parcel"] as const,
  profile: (userId: string | null) => ["profile", userId] as const,
  inventory: (userId: string | null) => ["inventory", userId] as const,
  world: ["world"] as const,
};

/**
 * Sahne `world_objects` görünümünden okur: ham satır + zaman uygulanmış
 * `effective_state`, `finishes_at`, `remaining_seconds`.
 */
const WORLD_COLUMNS =
  "id, owner_id, type_id, local_x, local_y, rotation, state, state_since, last_collected_at, effective_state, finishes_at, remaining_seconds";

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

/** Şehrin tamamı — komşuların binaları dahil (paylaşılan şehir). */
export async function fetchWorld(): Promise<WorldObject[]> {
  const { data, error } = await getSupabase()
    .from("world_objects")
    .select(WORLD_COLUMNS)
    .order("state_since");
  if (error) throw error;
  return data as WorldObject[];
}
