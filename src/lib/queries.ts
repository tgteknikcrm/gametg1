import { getSupabase } from "@/lib/supabase/client";
import type { ObjectType, Parcel, Profile, WorldObject } from "@/types/game";

/** Sorgu anahtarları tek yerde; geçersiz kılma çağrıları buradan okur. */
export const queryKeys = {
  catalog: ["catalog"] as const,
  parcel: ["parcel"] as const,
  profile: (userId: string | null) => ["profile", userId] as const,
  world: ["world"] as const,
};

/** Sahnenin ihtiyaç duyduğu kolonlar — `footprint` gibi sunucu alanları çekilmez. */
const WORLD_COLUMNS = "id, owner_id, type_id, local_x, local_y, rotation, state, state_since";

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

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
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
    .single();
  if (error) throw error;
  return data;
}

/** Şehrin tamamı — komşuların binaları dahil (paylaşılan şehir). */
export async function fetchWorld(): Promise<WorldObject[]> {
  const { data, error } = await getSupabase()
    .from("placed_objects")
    .select(WORLD_COLUMNS)
    .order("created_at");
  if (error) throw error;
  return data;
}
