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
      auctions: {
        Row: {
          created_at: string
          current_bid: number
          description: string | null
          ends_at: string
          id: string
          opening_bid: number
          property_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_bid?: number
          description?: string | null
          ends_at: string
          id?: string
          opening_bid?: number
          property_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_bid?: number
          description?: string | null
          ends_at?: string
          id?: string
          opening_bid?: number
          property_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          id: string
          lead_list_id: string | null
          name: string
          script: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          lead_list_id?: string | null
          name: string
          script?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          lead_list_id?: string | null
          name?: string
          script?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_lead_list_id_fkey"
            columns: ["lead_list_id"]
            isOneToOne: false
            referencedRelation: "lead_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          confidence: number | null
          contact_type: string
          created_at: string
          do_not_contact: boolean
          id: string
          is_verified: boolean
          notes: string | null
          owner_id: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          confidence?: number | null
          contact_type?: string
          created_at?: string
          do_not_contact?: boolean
          id?: string
          is_verified?: boolean
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          confidence?: number | null
          contact_type?: string
          created_at?: string
          do_not_contact?: boolean
          id?: string
          is_verified?: boolean
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_list_items: {
        Row: {
          created_at: string
          id: string
          lead_list_id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_list_id: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_list_id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_list_items_lead_list_id_fkey"
            columns: ["lead_list_id"]
            isOneToOne: false
            referencedRelation: "lead_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_list_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lists: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          source: string | null
          status: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          source?: string | null
          status?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          metadata: Json
          prompt: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          prompt?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          prompt?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          body: string | null
          campaign_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          response: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          response?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          response?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          entity_type: string | null
          full_name: string
          id: string
          mailing_address: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_zip: string | null
          notes: string | null
          property_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type?: string | null
          full_name: string
          id?: string
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          notes?: string | null
          property_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string | null
          full_name?: string
          id?: string
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          notes?: string | null
          property_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          baths: number | null
          beds: number | null
          city: string | null
          county: string | null
          created_at: string
          equity: number | null
          estimated_value: number | null
          id: string
          is_absentee: boolean
          is_preforeclosure: boolean
          is_vacant: boolean
          lead_score: number | null
          lot_sqft: number | null
          notes: string | null
          parcel_id: string | null
          property_type: string | null
          sqft: number | null
          state: string | null
          updated_at: string
          user_id: string
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address: string
          baths?: number | null
          beds?: number | null
          city?: string | null
          county?: string | null
          created_at?: string
          equity?: number | null
          estimated_value?: number | null
          id?: string
          is_absentee?: boolean
          is_preforeclosure?: boolean
          is_vacant?: boolean
          lead_score?: number | null
          lot_sqft?: number | null
          notes?: string | null
          parcel_id?: string | null
          property_type?: string | null
          sqft?: number | null
          state?: string | null
          updated_at?: string
          user_id: string
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string
          baths?: number | null
          beds?: number | null
          city?: string | null
          county?: string | null
          created_at?: string
          equity?: number | null
          estimated_value?: number | null
          id?: string
          is_absentee?: boolean
          is_preforeclosure?: boolean
          is_vacant?: boolean
          lead_score?: number | null
          lot_sqft?: number | null
          notes?: string | null
          parcel_id?: string | null
          property_type?: string | null
          sqft?: number | null
          state?: string | null
          updated_at?: string
          user_id?: string
          year_built?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          id: string
          property_id: string | null
          render_url: string | null
          script: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          voiceover_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          property_id?: string | null
          render_url?: string | null
          script?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          voiceover_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string | null
          render_url?: string | null
          script?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          voiceover_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
