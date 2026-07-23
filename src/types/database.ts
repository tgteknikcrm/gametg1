// ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
// Kaynak: Supabase şeması. Yeniden üretmek için: npm run gen:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          active_rings: number
          center_x: number
          center_y: number
          created_at: string
          id: string
          mayor_user_id: string | null
          name: string
          population: number
          tax_rate: number
          treasury: number
        }
        Insert: {
          active_rings?: number
          center_x?: number
          center_y?: number
          created_at?: string
          id?: string
          mayor_user_id?: string | null
          name: string
          population?: number
          tax_rate?: number
          treasury?: number
        }
        Update: {
          active_rings?: number
          center_x?: number
          center_y?: number
          created_at?: string
          id?: string
          mayor_user_id?: string | null
          name?: string
          population?: number
          tax_rate?: number
          treasury?: number
        }
        Relationships: [
          {
            foreignKeyName: "cities_mayor_fkey"
            columns: ["mayor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_mayor_fkey"
            columns: ["mayor_user_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_config: {
        Row: {
          description: string | null
          key: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          value?: Json
        }
        Relationships: []
      }
      inventory: {
        Row: {
          item_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          item_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          item_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      items: {
        Row: {
          color: string
          id: string
          name: string
          npc_buy_price: number
          npc_daily_consumption: number
          npc_sell_price: number
          sort_order: number
          storage_class: string
        }
        Insert: {
          color?: string
          id: string
          name: string
          npc_buy_price?: number
          npc_daily_consumption?: number
          npc_sell_price?: number
          sort_order?: number
          storage_class?: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          npc_buy_price?: number
          npc_daily_consumption?: number
          npc_sell_price?: number
          sort_order?: number
          storage_class?: string
        }
        Relationships: []
      }
      ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          detail: string | null
          id: number
          reason: Database["public"]["Enums"]["ledger_reason"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          detail?: string | null
          id?: never
          reason: Database["public"]["Enums"]["ledger_reason"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          detail?: string | null
          id?: never
          reason?: Database["public"]["Enums"]["ledger_reason"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      level_thresholds: {
        Row: {
          level: number
          xp_required: number
        }
        Insert: {
          level: number
          xp_required: number
        }
        Update: {
          level?: number
          xp_required?: number
        }
        Relationships: []
      }
      market_orders: {
        Row: {
          city_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
          seller_id: string
          unit_price: number
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          seller_id: string
          unit_price: number
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          seller_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_orders_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      object_level_costs: {
        Row: {
          item_id: string
          level: number
          quantity: number
          type_id: string
        }
        Insert: {
          item_id: string
          level: number
          quantity: number
          type_id: string
        }
        Update: {
          item_id?: string
          level?: number
          quantity?: number
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_level_costs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_level_costs_type_id_level_fkey"
            columns: ["type_id", "level"]
            isOneToOne: false
            referencedRelation: "object_levels"
            referencedColumns: ["type_id", "level"]
          },
        ]
      }
      object_levels: {
        Row: {
          input_qty: number | null
          level: number
          output_qty: number | null
          population_capacity: number
          produce_seconds: number | null
          storage_capacity: number
          type_id: string
          upgrade_coins: number | null
          upgrade_seconds: number | null
          worker_slots: number
        }
        Insert: {
          input_qty?: number | null
          level: number
          output_qty?: number | null
          population_capacity?: number
          produce_seconds?: number | null
          storage_capacity?: number
          type_id: string
          upgrade_coins?: number | null
          upgrade_seconds?: number | null
          worker_slots?: number
        }
        Update: {
          input_qty?: number | null
          level?: number
          output_qty?: number | null
          population_capacity?: number
          produce_seconds?: number | null
          storage_capacity?: number
          type_id?: string
          upgrade_coins?: number | null
          upgrade_seconds?: number | null
          worker_slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "object_levels_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      object_types: {
        Row: {
          block_height: number
          build_seconds: number
          category: Database["public"]["Enums"]["object_category"]
          color: string
          cost: number
          harvest_xp: number
          height: number
          id: string
          input_item_id: string | null
          input_qty: number | null
          is_active: boolean
          level_required: number
          maintenance_per_hour: number
          max_level: number
          model_key: string
          name: string
          output_item_id: string | null
          output_qty: number | null
          population_capacity: number
          produce_seconds: number | null
          refund_rate: number
          sort_order: number
          storage_class: string | null
          tier: number
          width: number
          worker_slots: number
          xp_reward: number
        }
        Insert: {
          block_height: number
          build_seconds?: number
          category: Database["public"]["Enums"]["object_category"]
          color: string
          cost: number
          harvest_xp?: number
          height: number
          id: string
          input_item_id?: string | null
          input_qty?: number | null
          is_active?: boolean
          level_required?: number
          maintenance_per_hour?: number
          max_level?: number
          model_key: string
          name: string
          output_item_id?: string | null
          output_qty?: number | null
          population_capacity?: number
          produce_seconds?: number | null
          refund_rate?: number
          sort_order?: number
          storage_class?: string | null
          tier?: number
          width: number
          worker_slots?: number
          xp_reward?: number
        }
        Update: {
          block_height?: number
          build_seconds?: number
          category?: Database["public"]["Enums"]["object_category"]
          color?: string
          cost?: number
          harvest_xp?: number
          height?: number
          id?: string
          input_item_id?: string | null
          input_qty?: number | null
          is_active?: boolean
          level_required?: number
          maintenance_per_hour?: number
          max_level?: number
          model_key?: string
          name?: string
          output_item_id?: string | null
          output_qty?: number | null
          population_capacity?: number
          produce_seconds?: number | null
          refund_rate?: number
          sort_order?: number
          storage_class?: string | null
          tier?: number
          width?: number
          worker_slots?: number
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "object_types_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_types_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          base_price: number
          city_id: string
          height: number
          id: string
          owner_id: string | null
          purchased_at: string | null
          ring: number
          width: number
          x: number
          y: number
        }
        Insert: {
          base_price?: number
          city_id: string
          height: number
          id?: string
          owner_id?: string | null
          purchased_at?: string | null
          ring?: number
          width: number
          x: number
          y: number
        }
        Update: {
          base_price?: number
          city_id?: string
          height?: number
          id?: string
          owner_id?: string | null
          purchased_at?: string | null
          ring?: number
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcels_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
        ]
      }
      placed_objects: {
        Row: {
          created_at: string
          footprint: unknown
          footprint_h: number
          footprint_w: number
          id: string
          last_collected_at: string | null
          level: number
          local_x: number
          local_y: number
          owner_id: string
          parcel_id: string
          pending_level: number | null
          produced_since: string | null
          rotation: number
          state: Database["public"]["Enums"]["object_state"]
          state_duration: number
          state_since: string
          type_id: string
          workers_assigned: number
        }
        Insert: {
          created_at?: string
          footprint?: unknown
          footprint_h: number
          footprint_w: number
          id?: string
          last_collected_at?: string | null
          level?: number
          local_x: number
          local_y: number
          owner_id: string
          parcel_id: string
          pending_level?: number | null
          produced_since?: string | null
          rotation?: number
          state?: Database["public"]["Enums"]["object_state"]
          state_duration?: number
          state_since?: string
          type_id: string
          workers_assigned?: number
        }
        Update: {
          created_at?: string
          footprint?: unknown
          footprint_h?: number
          footprint_w?: number
          id?: string
          last_collected_at?: string | null
          level?: number
          local_x?: number
          local_y?: number
          owner_id?: string
          parcel_id?: string
          pending_level?: number | null
          produced_since?: string | null
          rotation?: number
          state?: Database["public"]["Enums"]["object_state"]
          state_duration?: number
          state_since?: string
          type_id?: string
          workers_assigned?: number
        }
        Relationships: [
          {
            foreignKeyName: "placed_objects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placed_objects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "placed_objects_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placed_objects_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city_id: string | null
          coins: number
          created_at: string
          energy: number
          energy_updated_at: string
          gems: number
          id: string
          level: number
          stat_charisma: number
          stat_culture: number
          stat_education: number
          stat_health: number
          username: string
          xp: number
        }
        Insert: {
          city_id?: string | null
          coins?: number
          created_at?: string
          energy?: number
          energy_updated_at?: string
          gems?: number
          id: string
          level?: number
          stat_charisma?: number
          stat_culture?: number
          stat_education?: number
          stat_health?: number
          username: string
          xp?: number
        }
        Update: {
          city_id?: string | null
          coins?: number
          created_at?: string
          energy?: number
          energy_updated_at?: string
          gems?: number
          id?: string
          level?: number
          stat_charisma?: number
          stat_culture?: number
          stat_education?: number
          stat_health?: number
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      money_flow: {
        Row: {
          inflow: number | null
          movements: number | null
          net: number | null
          outflow: number | null
          reason: Database["public"]["Enums"]["ledger_reason"] | null
        }
        Relationships: []
      }
      storage_status: {
        Row: {
          capacity: number | null
          storage_class: string | null
          stored: number | null
          user_id: string | null
        }
        Relationships: []
      }
      world_objects: {
        Row: {
          cycle_input: number | null
          cycle_output: number | null
          cycle_remaining_seconds: number | null
          cycle_seconds: number | null
          effective_level: number | null
          effective_state: Database["public"]["Enums"]["object_state"] | null
          finishes_at: string | null
          id: string | null
          last_collected_at: string | null
          level: number | null
          local_x: number | null
          local_y: number | null
          owner_id: string | null
          pending_cycles: number | null
          pending_level: number | null
          pending_qty: number | null
          produced_since: string | null
          remaining_seconds: number | null
          rotation: number | null
          state: Database["public"]["Enums"]["object_state"] | null
          state_duration: number | null
          state_since: string | null
          type_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placed_objects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placed_objects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "storage_status"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "placed_objects_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      active_parcel: {
        Args: { p_city: string }
        Returns: {
          base_price: number
          city_id: string
          height: number
          id: string
          owner_id: string | null
          purchased_at: string | null
          ring: number
          width: number
          x: number
          y: number
        }
        SetofOptions: {
          from: "*"
          to: "parcels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_to_inventory: {
        Args: { p_item: string; p_quantity: number; p_user: string }
        Returns: undefined
      }
      apply_level_up: { Args: { p_user: string }; Returns: undefined }
      buy_item: {
        Args: { p_item_id: string; p_quantity: number }
        Returns: number
      }
      collect_all: {
        Args: never
        Returns: {
          blocked_full: boolean
          collected: number
          items: Json
        }[]
      }
      effective_state: {
        Args: {
          p_build_seconds: number
          p_produce_seconds: number
          p_state: Database["public"]["Enums"]["object_state"]
          p_state_since: string
        }
        Returns: Database["public"]["Enums"]["object_state"]
      }
      finishes_at: {
        Args: {
          p_build_seconds: number
          p_produce_seconds: number
          p_state: Database["public"]["Enums"]["object_state"]
          p_state_since: string
        }
        Returns: string
      }
      move_object: {
        Args: {
          p_object_id: string
          p_rotation: number
          p_x: number
          p_y: number
        }
        Returns: {
          created_at: string
          footprint: unknown
          footprint_h: number
          footprint_w: number
          id: string
          last_collected_at: string | null
          level: number
          local_x: number
          local_y: number
          owner_id: string
          parcel_id: string
          pending_level: number | null
          produced_since: string | null
          rotation: number
          state: Database["public"]["Enums"]["object_state"]
          state_duration: number
          state_since: string
          type_id: string
          workers_assigned: number
        }
        SetofOptions: {
          from: "*"
          to: "placed_objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      object_stats: {
        Args: { p_level: number; p_type_id: string }
        Returns: {
          input_qty: number
          output_qty: number
          population_capacity: number
          produce_seconds: number
          storage_capacity: number
          worker_slots: number
        }[]
      }
      place_object: {
        Args: {
          p_rotation: number
          p_type_id: string
          p_x: number
          p_y: number
        }
        Returns: {
          created_at: string
          footprint: unknown
          footprint_h: number
          footprint_w: number
          id: string
          last_collected_at: string | null
          level: number
          local_x: number
          local_y: number
          owner_id: string
          parcel_id: string
          pending_level: number | null
          produced_since: string | null
          rotation: number
          state: Database["public"]["Enums"]["object_state"]
          state_duration: number
          state_since: string
          type_id: string
          workers_assigned: number
        }
        SetofOptions: {
          from: "*"
          to: "placed_objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_ledger: {
        Args: {
          p_amount: number
          p_detail?: string
          p_reason: Database["public"]["Enums"]["ledger_reason"]
          p_user: string
        }
        Returns: undefined
      }
      remove_object: { Args: { p_object_id: string }; Returns: number }
      rotated_footprint: {
        Args: { p_height: number; p_rotation: number; p_width: number }
        Returns: Record<string, unknown>
      }
      rush_object: { Args: { p_object_id: string }; Returns: number }
      sell_item: {
        Args: { p_item_id: string; p_quantity: number }
        Returns: number
      }
      storage_capacity: {
        Args: { p_class: string; p_user: string }
        Returns: number
      }
      stored_amount: {
        Args: { p_class: string; p_user: string }
        Returns: number
      }
      upgrade_object: {
        Args: { p_object_id: string }
        Returns: {
          created_at: string
          footprint: unknown
          footprint_h: number
          footprint_w: number
          id: string
          last_collected_at: string | null
          level: number
          local_x: number
          local_y: number
          owner_id: string
          parcel_id: string
          pending_level: number | null
          produced_since: string | null
          rotation: number
          state: Database["public"]["Enums"]["object_state"]
          state_duration: number
          state_since: string
          type_id: string
          workers_assigned: number
        }
        SetofOptions: {
          from: "*"
          to: "placed_objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ledger_reason:
        | "build"
        | "refund"
        | "npc_sale"
        | "npc_purchase"
        | "maintenance"
        | "wages"
        | "tax"
        | "land"
        | "upgrade"
        | "rush"
        | "starting_grant"
      object_category: "production" | "housing" | "civic" | "decor"
      object_state:
        | "building"
        | "idle"
        | "producing"
        | "ready"
        | "needs_workers"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ledger_reason: [
        "build",
        "refund",
        "npc_sale",
        "npc_purchase",
        "maintenance",
        "wages",
        "tax",
        "land",
        "upgrade",
        "rush",
        "starting_grant",
      ],
      object_category: ["production", "housing", "civic", "decor"],
      object_state: ["building", "idle", "producing", "ready", "needs_workers"],
    },
  },
} as const
