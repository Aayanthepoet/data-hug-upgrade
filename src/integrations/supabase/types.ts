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
      arv_estimates: {
        Row: {
          arv: number
          arv_high: number
          arv_low: number
          comp_count: number
          computed_at: string
          confidence: number
          created_at: string
          id: string
          method: string
          price_per_sqft: number | null
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arv: number
          arv_high: number
          arv_low: number
          comp_count: number
          computed_at?: string
          confidence: number
          created_at?: string
          id?: string
          method?: string
          price_per_sqft?: number | null
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arv?: number
          arv_high?: number
          arv_low?: number
          comp_count?: number
          computed_at?: string
          confidence?: number
          created_at?: string
          id?: string
          method?: string
          price_per_sqft?: number | null
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arv_estimates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          created_at: string
          current_bid: number
          description: string | null
          ended_at: string | null
          ends_at: string
          id: string
          opening_bid: number
          property_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
          winner_id: string | null
          winning_bid_id: string | null
        }
        Insert: {
          created_at?: string
          current_bid?: number
          description?: string | null
          ended_at?: string | null
          ends_at: string
          id?: string
          opening_bid?: number
          property_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          winner_id?: string | null
          winning_bid_id?: string | null
        }
        Update: {
          created_at?: string
          current_bid?: number
          description?: string | null
          ended_at?: string | null
          ends_at?: string
          id?: string
          opening_bid?: number
          property_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          winner_id?: string | null
          winning_bid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_winning_bid_id_fkey"
            columns: ["winning_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          record_count: number
          resource_ids: string[]
          resource_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          record_count?: number
          resource_ids?: string[]
          resource_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          record_count?: number
          resource_ids?: string[]
          resource_type?: string
          user_id?: string
        }
        Relationships: []
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
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_digest_reads: {
        Row: {
          digest_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          digest_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          digest_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_digest_reads_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "compliance_digests"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_digests: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          stats: Json
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          stats?: Json
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          stats?: Json
        }
        Relationships: []
      }
      comps: {
        Row: {
          address: string
          baths: number | null
          beds: number | null
          city: string | null
          created_at: string
          distance_miles: number | null
          id: string
          property_type: string | null
          sale_date: string
          sale_price: number
          similarity_score: number | null
          source_provider: string
          source_record_id: string | null
          sqft: number | null
          state: string | null
          subject_property_id: string
          user_id: string
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address: string
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          distance_miles?: number | null
          id?: string
          property_type?: string | null
          sale_date: string
          sale_price: number
          similarity_score?: number | null
          source_provider?: string
          source_record_id?: string | null
          sqft?: number | null
          state?: string | null
          subject_property_id: string
          user_id: string
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          distance_miles?: number | null
          id?: string
          property_type?: string | null
          sale_date?: string
          sale_price?: number
          similarity_score?: number | null
          source_provider?: string
          source_record_id?: string | null
          sqft?: number | null
          state?: string | null
          subject_property_id?: string
          user_id?: string
          year_built?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comps_subject_property_id_fkey"
            columns: ["subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      contracts: {
        Row: {
          buyer_email: string | null
          buyer_name: string
          closing_date: string
          created_at: string
          error_message: string | null
          id: string
          pdf_storage_path: string | null
          property_id: string
          purchase_price: number
          seller_email: string | null
          seller_name: string
          signed_at: string | null
          signed_pdf_url: string | null
          signwell_document_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_name: string
          closing_date: string
          created_at?: string
          error_message?: string | null
          id?: string
          pdf_storage_path?: string | null
          property_id: string
          purchase_price: number
          seller_email?: string | null
          seller_name: string
          signed_at?: string | null
          signed_pdf_url?: string | null
          signwell_document_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string
          closing_date?: string
          created_at?: string
          error_message?: string | null
          id?: string
          pdf_storage_path?: string | null
          property_id?: string
          purchase_price?: number
          seller_email?: string | null
          seller_name?: string
          signed_at?: string | null
          signed_pdf_url?: string | null
          signwell_document_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      distress_events: {
        Row: {
          amount: number | null
          created_at: string
          event_date: string
          event_type: Database["public"]["Enums"]["distress_type"]
          id: string
          note: string | null
          property_id: string
          source_provider: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event_date?: string
          event_type: Database["public"]["Enums"]["distress_type"]
          id?: string
          note?: string | null
          property_id: string
          source_provider?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          event_date?: string
          event_type?: Database["public"]["Enums"]["distress_type"]
          id?: string
          note?: string | null
          property_id?: string
          source_provider?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distress_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      lead_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_emails: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          recipient_email: string
          recipient_id: string | null
          sent_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          recipient_email: string
          recipient_id?: string | null
          sent_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          recipient_email?: string
          recipient_id?: string | null
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      lead_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
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
          assigned_to?: string | null
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
          assigned_to?: string | null
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
          error: string | null
          id: string
          metadata: Json
          owner_id: string | null
          prompt: string | null
          property_id: string | null
          provider: string | null
          source_image_url: string | null
          status: string
          storage_path: string | null
          style: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          owner_id?: string | null
          prompt?: string | null
          property_id?: string | null
          provider?: string | null
          source_image_url?: string | null
          status?: string
          storage_path?: string | null
          style?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          owner_id?: string | null
          prompt?: string | null
          property_id?: string | null
          provider?: string | null
          source_image_url?: string | null
          status?: string
          storage_path?: string | null
          style?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel_in_app: boolean
          channel_sms: boolean
          created_at: string
          on_auction_activity: boolean
          on_lead_reply: boolean
          on_new_lead: boolean
          quiet_enabled: boolean
          quiet_end_local: string
          quiet_start_local: string
          sms_phone: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_in_app?: boolean
          channel_sms?: boolean
          created_at?: string
          on_auction_activity?: boolean
          on_lead_reply?: boolean
          on_new_lead?: boolean
          quiet_enabled?: boolean
          quiet_end_local?: string
          quiet_start_local?: string
          sms_phone?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_in_app?: boolean
          channel_sms?: boolean
          created_at?: string
          on_auction_activity?: boolean
          on_lead_reply?: boolean
          on_new_lead?: boolean
          quiet_enabled?: boolean
          quiet_end_local?: string
          quiet_start_local?: string
          sms_phone?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
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
          error: string | null
          id: string
          owner_id: string | null
          provider: string | null
          provider_message_id: string | null
          replied_at: string | null
          response: string | null
          sent_at: string | null
          status: string
          subject: string | null
          to_value: string | null
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
          error?: string | null
          id?: string
          owner_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          replied_at?: string | null
          response?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_value?: string | null
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
          error?: string | null
          id?: string
          owner_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          replied_at?: string | null
          response?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_value?: string | null
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
          {
            foreignKeyName: "outreach_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
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
          skip_trace_last_run_at: string | null
          skip_trace_status: string
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
          skip_trace_last_run_at?: string | null
          skip_trace_status?: string
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
          skip_trace_last_run_at?: string | null
          skip_trace_status?: string
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
          auction_date: string | null
          baths: number | null
          beds: number | null
          city: string | null
          county: string | null
          created_at: string
          days_on_market: number | null
          distress_type: Database["public"]["Enums"]["distress_type"]
          equity: number | null
          estimated_value: number | null
          id: string
          is_absentee: boolean
          is_preforeclosure: boolean
          is_vacant: boolean
          last_synced_at: string | null
          lead_score: number | null
          lien_amount: number | null
          list_date: string | null
          list_price: number | null
          listing_status: Database["public"]["Enums"]["listing_status"] | null
          lot_sqft: number | null
          notes: string | null
          parcel_id: string | null
          property_type: string | null
          source_provider: string | null
          source_record_id: string | null
          sqft: number | null
          state: string | null
          tax_owed: number | null
          updated_at: string
          user_id: string
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address: string
          auction_date?: string | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          county?: string | null
          created_at?: string
          days_on_market?: number | null
          distress_type?: Database["public"]["Enums"]["distress_type"]
          equity?: number | null
          estimated_value?: number | null
          id?: string
          is_absentee?: boolean
          is_preforeclosure?: boolean
          is_vacant?: boolean
          last_synced_at?: string | null
          lead_score?: number | null
          lien_amount?: number | null
          list_date?: string | null
          list_price?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"] | null
          lot_sqft?: number | null
          notes?: string | null
          parcel_id?: string | null
          property_type?: string | null
          source_provider?: string | null
          source_record_id?: string | null
          sqft?: number | null
          state?: string | null
          tax_owed?: number | null
          updated_at?: string
          user_id: string
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string
          auction_date?: string | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          county?: string | null
          created_at?: string
          days_on_market?: number | null
          distress_type?: Database["public"]["Enums"]["distress_type"]
          equity?: number | null
          estimated_value?: number | null
          id?: string
          is_absentee?: boolean
          is_preforeclosure?: boolean
          is_vacant?: boolean
          last_synced_at?: string | null
          lead_score?: number | null
          lien_amount?: number | null
          list_date?: string | null
          list_price?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"] | null
          lot_sqft?: number | null
          notes?: string | null
          parcel_id?: string | null
          property_type?: string | null
          source_provider?: string | null
          source_record_id?: string | null
          sqft?: number | null
          state?: string | null
          tax_owed?: number | null
          updated_at?: string
          user_id?: string
          year_built?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_scheduled: boolean
          last_match_count: number | null
          last_run_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_scheduled?: boolean
          last_match_count?: number | null
          last_run_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_scheduled?: boolean
          last_match_count?: number | null
          last_run_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_opt_outs: {
        Row: {
          created_at: string
          id: string
          keyword: string | null
          notes: string | null
          opted_out_at: string
          phone: string
          reason: string | null
          restored_at: string | null
          restored_by: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword?: string | null
          notes?: string | null
          opted_out_at?: string
          phone: string
          reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string | null
          notes?: string | null
          opted_out_at?: string
          phone?: string
          reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      vision_source_photos: {
        Row: {
          byte_size: number
          content_type: string
          created_at: string
          crop_aspect: string | null
          crop_max_edge: number | null
          filename: string
          id: string
          original_byte_size: number | null
          original_filename: string | null
          storage_path: string
          updated_at: string
          user_id: string
          was_cropped: boolean
        }
        Insert: {
          byte_size: number
          content_type: string
          created_at?: string
          crop_aspect?: string | null
          crop_max_edge?: number | null
          filename: string
          id?: string
          original_byte_size?: number | null
          original_filename?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
          was_cropped?: boolean
        }
        Update: {
          byte_size?: number
          content_type?: string
          created_at?: string
          crop_aspect?: string | null
          crop_max_edge?: number | null
          filename?: string
          id?: string
          original_byte_size?: number | null
          original_filename?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
          was_cropped?: boolean
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          address: string
          alert_deed_transfer: boolean
          alert_foreclosure: boolean
          alert_lis_pendens: boolean
          city: string | null
          county: string | null
          created_at: string
          id: string
          notes: string | null
          property_key: string
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          alert_deed_transfer?: boolean
          alert_foreclosure?: boolean
          alert_lis_pendens?: boolean
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_key: string
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          alert_deed_transfer?: boolean
          alert_foreclosure?: boolean
          alert_lis_pendens?: boolean
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_key?: string
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_auction_if_expired: {
        Args: { _auction_id: string }
        Returns: boolean
      }
      close_expired_auctions: { Args: { _limit?: number }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dispatch_notification: {
        Args: {
          _body: string
          _link: string
          _metadata: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_quiet_hours: {
        Args: {
          _pref: Database["public"]["Tables"]["notification_preferences"]["Row"]
        }
        Returns: boolean
      }
      is_phone_suppressed: { Args: { _phone: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_phone: { Args: { _phone: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_notify_vault: {
        Args: { _secret: string; _url: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      distress_type:
        | "reo"
        | "preforeclosure"
        | "auction"
        | "tax_lien"
        | "tax_delinquent"
        | "fsbo_stale"
        | "vacant"
        | "absentee"
        | "none"
      listing_status:
        | "active"
        | "pending"
        | "sold"
        | "off_market"
        | "auction_scheduled"
        | "foreclosed"
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
      distress_type: [
        "reo",
        "preforeclosure",
        "auction",
        "tax_lien",
        "tax_delinquent",
        "fsbo_stale",
        "vacant",
        "absentee",
        "none",
      ],
      listing_status: [
        "active",
        "pending",
        "sold",
        "off_market",
        "auction_scheduled",
        "foreclosed",
      ],
    },
  },
} as const
