export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          /** admin | user — RLS / quản trị */
          role: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string | null
        }
        Relationships: []
      }
      credits: {
        Row: {
          user_id: string
          balance: number
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_care_conversations: {
        Row: {
          id: string
          partner_id: string
          channel: 'facebook' | 'zalo' | 'internal' | 'widget'
          external_thread_id: string
          channel_external_ref: string | null
          linked_user_id: string | null
          customer_name: string | null
          customer_avatar_url: string | null
          metadata: Json
          status: 'open' | 'archived'
          last_message_at: string | null
          last_message_preview: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          channel: 'facebook' | 'zalo' | 'internal' | 'widget'
          external_thread_id: string
          channel_external_ref?: string | null
          linked_user_id?: string | null
          customer_name?: string | null
          customer_avatar_url?: string | null
          metadata?: Json
          status?: 'open' | 'archived'
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          channel?: 'facebook' | 'zalo' | 'internal' | 'widget'
          external_thread_id?: string
          channel_external_ref?: string | null
          linked_user_id?: string | null
          customer_name?: string | null
          customer_avatar_url?: string | null
          metadata?: Json
          status?: 'open' | 'archived'
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_care_messages: {
        Row: {
          id: string
          conversation_id: string
          direction: 'inbound' | 'outbound'
          body: string
          raw_payload: Json | null
          sender_admin_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          direction: 'inbound' | 'outbound'
          body: string
          raw_payload?: Json | null
          sender_admin_id?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          direction?: 'inbound' | 'outbound'
          body?: string
          raw_payload?: Json | null
          sender_admin_id?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      messaging_partners: {
        Row: {
          id: string
          slug: string
          display_name: string
          owner_user_id: string | null
          embed_key: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          display_name: string
          owner_user_id?: string | null
          embed_key?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          display_name?: string
          owner_user_id?: string | null
          embed_key?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_channels: {
        Row: {
          id: string
          partner_id: string
          provider: 'facebook_messenger' | 'zalo_oa'
          external_page_id: string
          page_access_token: string | null
          webhook_verify_token: string | null
          zalo_access_token: string | null
          zalo_webhook_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          provider: 'facebook_messenger' | 'zalo_oa'
          external_page_id: string
          page_access_token?: string | null
          webhook_verify_token?: string | null
          zalo_access_token?: string | null
          zalo_webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          provider?: 'facebook_messenger' | 'zalo_oa'
          external_page_id?: string
          page_access_token?: string | null
          webhook_verify_token?: string | null
          zalo_access_token?: string | null
          zalo_webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_ai_settings: {
        Row: {
          partner_id: string
          enabled: boolean
          reply_delay_seconds: number
          typing_pause_min_ms: number
          typing_pause_max_ms: number
          shop_policy: string
          tone_instructions: string
          append_ai_disclosure: boolean
          disclosure_suffix: string
          updated_at: string
        }
        Insert: {
          partner_id: string
          enabled?: boolean
          reply_delay_seconds?: number
          typing_pause_min_ms?: number
          typing_pause_max_ms?: number
          shop_policy?: string
          tone_instructions?: string
          append_ai_disclosure?: boolean
          disclosure_suffix?: string
          updated_at?: string
        }
        Update: {
          partner_id?: string
          enabled?: boolean
          reply_delay_seconds?: number
          typing_pause_min_ms?: number
          typing_pause_max_ms?: number
          shop_policy?: string
          tone_instructions?: string
          append_ai_disclosure?: boolean
          disclosure_suffix?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_faq: {
        Row: {
          id: string
          partner_id: string
          sort_order: number
          trigger_keywords: string
          answer: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          sort_order?: number
          trigger_keywords?: string
          answer: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          sort_order?: number
          trigger_keywords?: string
          answer?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_inventory: {
        Row: {
          id: string
          partner_id: string
          sort_order: number
          sku: string | null
          name: string
          description: string
          stock_note: string
          price_hint: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          sort_order?: number
          sku?: string | null
          name: string
          description?: string
          stock_note?: string
          price_hint?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          sort_order?: number
          sku?: string | null
          name?: string
          description?: string
          stock_note?: string
          price_hint?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_ai_jobs: {
        Row: {
          id: string
          partner_id: string
          conversation_id: string
          trigger_message_id: string
          run_at: string
          status: 'pending' | 'processing' | 'done' | 'cancelled' | 'failed'
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          conversation_id: string
          trigger_message_id: string
          run_at: string
          status?: 'pending' | 'processing' | 'done' | 'cancelled' | 'failed'
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          conversation_id?: string
          trigger_message_id?: string
          run_at?: string
          status?: 'pending' | 'processing' | 'done' | 'cancelled' | 'failed'
          error?: string | null
          created_at?: string
        }
        Relationships: []
      }
      partner_try_on_clients: {
        Row: {
          id: string
          name: string
          key_hash: string
          billing_user_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          key_hash: string
          billing_user_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          key_hash?: string
          billing_user_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: 'deposit' | 'usage'
          status: 'pending' | 'completed' | 'failed'
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: 'deposit' | 'usage'
          status?: 'pending' | 'completed' | 'failed'
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: 'deposit' | 'usage'
          status?: 'pending' | 'completed' | 'failed'
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      try_on_history: {
        Row: {
          id: string
          user_id: string
          original_image_url: string
          garment_image_url: string
          result_image_url: string | null
          status: 'processing' | 'completed' | 'failed'
          created_at: string
          batch_id?: string | null
          error_message?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_image_url: string
          garment_image_url: string
          result_image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
          batch_id?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_image_url?: string
          garment_image_url?: string
          result_image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
          batch_id?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      translate_jobs: {
        Row: {
          id: string
          user_id: string
          history_id: string
          retry_round: number | null
          source_lang: string | null
          source_lang_2: string | null
          target_lang: string | null
          image_quality: string | null
          cost: number | null
          status: string
          processing_started_at: string | null
          created_at: string
          error_message: string | null
        }
        Insert: {
          id?: string
          user_id: string
          history_id: string
          retry_round?: number | null
          source_lang?: string | null
          source_lang_2?: string | null
          target_lang?: string | null
          image_quality?: string | null
          cost?: number | null
          status?: string
          processing_started_at?: string | null
          created_at?: string
          error_message?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          history_id?: string
          retry_round?: number | null
          source_lang?: string | null
          source_lang_2?: string | null
          target_lang?: string | null
          image_quality?: string | null
          cost?: number | null
          status?: string
          processing_started_at?: string | null
          created_at?: string
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>
    Functions: Record<string, { Args: Record<string, never>; Returns: unknown }>
  }
}
