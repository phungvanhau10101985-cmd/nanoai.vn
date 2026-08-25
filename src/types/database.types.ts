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
          english_coach_job: string | null
          english_coach_city: string | null
          english_coach_age: number | null
          english_coach_gender: string | null
          gender: string | null
          birth_date: string | null
          /** nanoai | customer_website | partner_website */
          signup_source: string | null
          signup_partner_id: string | null
          signup_partner_slug: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string | null
          english_coach_job?: string | null
          english_coach_city?: string | null
          english_coach_age?: number | null
          english_coach_gender?: string | null
          gender?: string | null
          birth_date?: string | null
          signup_source?: string | null
          signup_partner_id?: string | null
          signup_partner_slug?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          role?: string | null
          english_coach_job?: string | null
          english_coach_city?: string | null
          english_coach_age?: number | null
          english_coach_gender?: string | null
          gender?: string | null
          birth_date?: string | null
          signup_source?: string | null
          signup_partner_id?: string | null
          signup_partner_slug?: string | null
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
          guest_account_id: string | null
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
          guest_account_id?: string | null
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
          guest_account_id?: string | null
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
          landing_source_url: string | null
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
          landing_source_url?: string | null
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
          landing_source_url?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customer_care_consulted_products: {
        Row: {
          conversation_id: string
          source_message_id: string
          product_url_key: string
          consulted_at: string
        }
        Insert: {
          conversation_id: string
          source_message_id: string
          product_url_key: string
          consulted_at?: string
        }
        Update: {
          conversation_id?: string
          source_message_id?: string
          product_url_key?: string
          consulted_at?: string
        }
        Relationships: []
      }
      messaging_partners: {
        Row: {
          id: string
          slug: string
          display_name: string
          industry_key: 'fashion' | 'hotel' | 'food' | 'other' | null
          brand_name: string | null
          logo_url: string | null
          owner_user_id: string | null
          embed_key: string
          is_active: boolean
          purge_at: string | null
          deletion_requested_at: string | null
          facebook_pixel_id: string | null
          facebook_capi_access_token: string | null
          ga4_measurement_id: string | null
          google_ads_id: string | null
          tiktok_pixel_id: string | null
          gtm_container_id: string | null
          default_currency: string
          contact_phone: string | null
          contact_zalo_url: string | null
          contact_messenger_url: string | null
          contact_instagram_url: string | null
          partner_capabilities: unknown
          external_shop_origin: string | null
          external_shop_login_path: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          display_name: string
          industry_key?: 'fashion' | 'hotel' | 'food' | 'other' | null
          brand_name?: string | null
          logo_url?: string | null
          owner_user_id?: string | null
          embed_key?: string
          is_active?: boolean
          purge_at?: string | null
          deletion_requested_at?: string | null
          facebook_pixel_id?: string | null
          facebook_capi_access_token?: string | null
          ga4_measurement_id?: string | null
          google_ads_id?: string | null
          tiktok_pixel_id?: string | null
          gtm_container_id?: string | null
          default_currency?: string
          contact_phone?: string | null
          contact_zalo_url?: string | null
          contact_messenger_url?: string | null
          contact_instagram_url?: string | null
          partner_capabilities?: unknown
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          display_name?: string
          industry_key?: 'fashion' | 'hotel' | 'food' | 'other' | null
          brand_name?: string | null
          logo_url?: string | null
          owner_user_id?: string | null
          embed_key?: string
          is_active?: boolean
          purge_at?: string | null
          deletion_requested_at?: string | null
          facebook_pixel_id?: string | null
          facebook_capi_access_token?: string | null
          ga4_measurement_id?: string | null
          google_ads_id?: string | null
          tiktok_pixel_id?: string | null
          gtm_container_id?: string | null
          default_currency?: string
          contact_phone?: string | null
          contact_zalo_url?: string | null
          contact_messenger_url?: string | null
          contact_instagram_url?: string | null
          partner_capabilities?: unknown
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_custom_domains: {
        Row: {
          id: string
          partner_id: string
          hostname: string
          verification_token: string
          dns_verified_at: string | null
          ssl_status: 'pending' | 'dns_ok' | 'ssl_active' | 'error'
          ssl_provisioned_at: string | null
          ssl_last_error: string | null
          use_for_chat: boolean
          use_for_site: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          hostname: string
          verification_token: string
          dns_verified_at?: string | null
          ssl_status?: 'pending' | 'dns_ok' | 'ssl_active' | 'error'
          ssl_provisioned_at?: string | null
          ssl_last_error?: string | null
          use_for_chat?: boolean
          use_for_site?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          hostname?: string
          verification_token?: string
          dns_verified_at?: string | null
          ssl_status?: 'pending' | 'dns_ok' | 'ssl_active' | 'error'
          ssl_provisioned_at?: string | null
          ssl_last_error?: string | null
          use_for_chat?: boolean
          use_for_site?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_members: {
        Row: {
          id: string
          partner_id: string
          member_user_id: string
          invited_by: string | null
          permissions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          member_user_id: string
          invited_by?: string | null
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          member_user_id?: string
          invited_by?: string | null
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_marketing_campaigns: {
        Row: {
          id: string
          partner_id: string
          created_by_user_id: string
          status: string
          channel_chat: boolean
          channel_email: boolean
          segment_json: Json
          template_subject: string | null
          template_body_chat: string
          template_body_email: string | null
          offer_percent: number | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          total_queued: number
          sent_chat: number
          sent_email: number
          skipped: number
          failed: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          created_by_user_id: string
          status?: string
          channel_chat?: boolean
          channel_email?: boolean
          segment_json?: Json
          template_subject?: string | null
          template_body_chat?: string
          template_body_email?: string | null
          offer_percent?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          total_queued?: number
          sent_chat?: number
          sent_email?: number
          skipped?: number
          failed?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          created_by_user_id?: string
          status?: string
          channel_chat?: boolean
          channel_email?: boolean
          segment_json?: Json
          template_subject?: string | null
          template_body_chat?: string
          template_body_email?: string | null
          offer_percent?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          total_queued?: number
          sent_chat?: number
          sent_email?: number
          skipped?: number
          failed?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_marketing_deliveries: {
        Row: {
          id: string
          campaign_id: string
          partner_id: string
          conversation_id: string | null
          recipient_key: string
          email: string | null
          status: string
          skip_reason: string | null
          rendered_body_chat: string | null
          rendered_body_email: string | null
          sent_chat_at: string | null
          sent_email_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          partner_id: string
          conversation_id?: string | null
          recipient_key: string
          email?: string | null
          status?: string
          skip_reason?: string | null
          rendered_body_chat?: string | null
          rendered_body_email?: string | null
          sent_chat_at?: string | null
          sent_email_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          partner_id?: string
          conversation_id?: string | null
          recipient_key?: string
          email?: string | null
          status?: string
          skip_reason?: string | null
          rendered_body_chat?: string | null
          rendered_body_email?: string | null
          sent_chat_at?: string | null
          sent_email_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_marketing_sent_slots: {
        Row: {
          id: string
          partner_id: string
          recipient_key: string
          campaign_key: string
          sent_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          recipient_key: string
          campaign_key: string
          sent_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          recipient_key?: string
          campaign_key?: string
          sent_at?: string
        }
        Relationships: []
      }
      messaging_partner_marketing_opt_out: {
        Row: {
          id: string
          partner_id: string
          recipient_key: string
          email_normalized: string | null
          opted_out_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          recipient_key: string
          email_normalized?: string | null
          opted_out_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          recipient_key?: string
          email_normalized?: string | null
          opted_out_at?: string
        }
        Relationships: []
      }
      messaging_guest_accounts: {
        Row: {
          id: string
          partner_id: string
          email_raw: string
          email_normalized: string
          first_verified_at: string
          last_login_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          email_raw: string
          email_normalized: string
          first_verified_at?: string
          last_login_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          email_raw?: string
          email_normalized?: string
          first_verified_at?: string
          last_login_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_guest_identities: {
        Row: {
          id: string
          partner_id: string
          guest_account_id: string
          provider: 'google' | 'email_otp'
          provider_subject: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          guest_account_id: string
          provider: 'google' | 'email_otp'
          provider_subject: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          guest_account_id?: string
          provider?: 'google' | 'email_otp'
          provider_subject?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_guest_email_challenges: {
        Row: {
          id: string
          partner_id: string
          email_normalized: string
          session_id: string
          code_hash: string
          magic_token_hash: string
          expires_at: string
          attempt_count: number
          consumed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          email_normalized: string
          session_id: string
          code_hash: string
          magic_token_hash: string
          expires_at: string
          attempt_count?: number
          consumed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          email_normalized?: string
          session_id?: string
          code_hash?: string
          magic_token_hash?: string
          expires_at?: string
          attempt_count?: number
          consumed_at?: string | null
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
      messaging_partner_deletion_otps: {
        Row: {
          id: string
          partner_id: string
          owner_user_id: string
          otp_hash: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          owner_user_id: string
          otp_hash: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          owner_user_id?: string
          otp_hash?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      vision_warehouse_runner: {
        Row: {
          id: number
          pending_work: boolean
          analyze_operation: string
          index_operation: string
          warehouse_location: string
          updated_at: string
          assets_import_busy: boolean
          assets_import_busy_at: string | null
          assets_import_owner: string | null
          assets_import_heartbeat_at: string | null
          assets_import_operation: string
          assets_import_operation_started_at: string | null
        }
        Insert: {
          id?: number
          pending_work?: boolean
          analyze_operation?: string
          index_operation?: string
          warehouse_location?: string
          updated_at?: string
          assets_import_busy?: boolean
          assets_import_busy_at?: string | null
          assets_import_owner?: string | null
          assets_import_heartbeat_at?: string | null
          assets_import_operation?: string
          assets_import_operation_started_at?: string | null
        }
        Update: {
          id?: number
          pending_work?: boolean
          analyze_operation?: string
          index_operation?: string
          warehouse_location?: string
          updated_at?: string
          assets_import_busy?: boolean
          assets_import_busy_at?: string | null
          assets_import_owner?: string | null
          assets_import_heartbeat_at?: string | null
          assets_import_operation?: string
          assets_import_operation_started_at?: string | null
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
          product_consultation_context: string
          append_ai_disclosure: boolean
          disclosure_suffix: string
          vision_product_search_enabled: boolean
          vision_location: string
          vision_shop_country: string | null
          vision_product_category: string
          vision_gcs_bucket: string
          vision_index_ready: boolean
          vision_index_synced_at: string | null
          vision_index_error: string
          image_search_api_enabled: boolean
          image_search_api_secret: string | null
          vision_bg_sync_status: string
          vision_bg_sync_resume_after_id: string | null
          vision_bg_sync_rounds: number
          vision_bg_sync_imported: number
          vision_bg_sync_removed: number
          vision_bg_sync_started_at: string | null
          vision_bg_sync_finished_at: string | null
          vision_bg_sync_error: string
          vision_bg_sync_report: string
          guest_purchase_flow: string
          guest_external_cart_url_template: string | null
          shop_checkout_login_required: boolean
          after_sales_return_address: string
          shipping_lookup_url: string
          shipping_lookup_api_key: string | null
          updated_at: string
        }
        Insert: {
          partner_id: string
          enabled?: boolean
          reply_delay_seconds?: number
          typing_pause_min_ms?: number
          typing_pause_max_ms?: number
          product_consultation_context?: string
          append_ai_disclosure?: boolean
          disclosure_suffix?: string
          vision_product_search_enabled?: boolean
          vision_location?: string
          vision_shop_country?: string | null
          vision_product_category?: string
          vision_gcs_bucket?: string
          vision_index_ready?: boolean
          vision_index_synced_at?: string | null
          vision_index_error?: string
          image_search_api_enabled?: boolean
          image_search_api_secret?: string | null
          vision_bg_sync_status?: string
          vision_bg_sync_resume_after_id?: string | null
          vision_bg_sync_rounds?: number
          vision_bg_sync_imported?: number
          vision_bg_sync_removed?: number
          vision_bg_sync_started_at?: string | null
          vision_bg_sync_finished_at?: string | null
          vision_bg_sync_error?: string
          vision_bg_sync_report?: string
          guest_purchase_flow?: string
          guest_external_cart_url_template?: string | null
          shop_checkout_login_required?: boolean
          after_sales_return_address?: string
          shipping_lookup_url?: string
          shipping_lookup_api_key?: string | null
          updated_at?: string
        }
        Update: {
          partner_id?: string
          enabled?: boolean
          reply_delay_seconds?: number
          typing_pause_min_ms?: number
          typing_pause_max_ms?: number
          product_consultation_context?: string
          append_ai_disclosure?: boolean
          disclosure_suffix?: string
          vision_product_search_enabled?: boolean
          vision_location?: string
          vision_shop_country?: string | null
          vision_product_category?: string
          vision_gcs_bucket?: string
          vision_index_ready?: boolean
          vision_index_synced_at?: string | null
          vision_index_error?: string
          image_search_api_enabled?: boolean
          image_search_api_secret?: string | null
          vision_bg_sync_status?: string
          vision_bg_sync_resume_after_id?: string | null
          vision_bg_sync_rounds?: number
          vision_bg_sync_imported?: number
          vision_bg_sync_removed?: number
          vision_bg_sync_started_at?: string | null
          vision_bg_sync_finished_at?: string | null
          vision_bg_sync_error?: string
          vision_bg_sync_report?: string
          guest_purchase_flow?: string
          guest_external_cart_url_template?: string | null
          shop_checkout_login_required?: boolean
          after_sales_return_address?: string
          shipping_lookup_url?: string
          shipping_lookup_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messaging_partner_order_lines: {
        Row: {
          id: string
          order_id: string
          product_inventory_id: string | null
          product_name: string
          product_image_url: string
          product_url: string
          unit_price: number
          quantity: number
          line_subtotal: number
          variant_color: string
          variant_size: string
          variant_image_urls: string
          note: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_inventory_id?: string | null
          product_name?: string
          product_image_url?: string
          product_url?: string
          unit_price?: number
          quantity?: number
          line_subtotal?: number
          variant_color?: string
          variant_size?: string
          variant_image_urls?: string
          note?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_inventory_id?: string | null
          product_name?: string
          product_image_url?: string
          product_url?: string
          unit_price?: number
          quantity?: number
          line_subtotal?: number
          variant_color?: string
          variant_size?: string
          variant_image_urls?: string
          note?: string
          sort_order?: number
          created_at?: string
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
          answer_i18n: Json
          is_active: boolean
          preset_key: string | null
          custom_title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          sort_order?: number
          trigger_keywords?: string
          answer: string
          answer_i18n?: Json
          is_active?: boolean
          preset_key?: string | null
          custom_title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          sort_order?: number
          trigger_keywords?: string
          answer?: string
          answer_i18n?: Json
          is_active?: boolean
          preset_key?: string | null
          custom_title?: string
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
          stock_qty: number
          price_hint: string
          image_url: string
          product_url: string
          product_video_url: string
          consult_note: string
          remarketing_id: string
          material_note: string
          material_detail_image_url: string
          real_use_image_url: string
          real_use_image_url_2: string
          is_active: boolean
          price_amount: number | null
          price_currency: string
          sale_price_amount: number | null
          sale_starts_at: string | null
          sale_ends_at: string | null
          image_embedding_json: number[] | null
          image_embedding_vec: string | null
          image_embedding_model: string | null
          image_embedding_dims: number | null
          image_embedding_fingerprint: string | null
          image_embedding_updated_at: string | null
          image_embedding_error: string | null
          text_embedding_json: number[] | null
          text_embedding_vec: string | null
          text_embedding_model: string | null
          text_embedding_dims: number | null
          text_embedding_fingerprint: string | null
          text_embedding_updated_at: string | null
          text_embedding_error: string | null
          vision_catalog_checksum: string | null
          vision_catalog_synced_at: string | null
          vision_catalog_excluded: boolean
          consult_link_opening_text: string | null
          consult_link_opening_input_fingerprint: string | null
          colors_json: { name: string; img: string }[] | null
          sizes_json: string[] | null
          gallery_urls: string[]
          detail_image_urls: string[]
          product_studio_meta: Json | null
          origin: string | null
          product_studio_job_id: string | null
          catalog_json: Json | null
          brand_name: string | null
          source_origin: string | null
          chinese_name: string | null
          deposit_required: boolean
          category_l1: string | null
          category_l2: string | null
          category_l3: string | null
          likes_count: number
          purchases_count: number
          reviews_count: number
          questions_count: number
          rating_score: number
          catalog_slug: string | null
          style: string | null
          color_summary: string | null
          occasion: string | null
          weight: string | null
          features_json: string[] | null
          product_info_json: Json | null
          source_shop_name: string | null
          source_shop_id: string | null
          source_shop_name_chinese: string | null
          price_low_hint: string | null
          price_high_hint: string | null
          rating_group_id: number | null
          question_group_id: number | null
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
          stock_qty?: number
          price_hint?: string
          image_url?: string
          product_url?: string
          product_video_url?: string
          consult_note?: string
          remarketing_id?: string
          material_note?: string
          material_detail_image_url?: string
          real_use_image_url?: string
          real_use_image_url_2?: string
          is_active?: boolean
          price_amount?: number | null
          price_currency?: string
          sale_price_amount?: number | null
          sale_starts_at?: string | null
          sale_ends_at?: string | null
          image_embedding_json?: number[] | null
          image_embedding_vec?: string | null
          image_embedding_model?: string | null
          image_embedding_dims?: number | null
          image_embedding_fingerprint?: string | null
          image_embedding_updated_at?: string | null
          image_embedding_error?: string | null
          text_embedding_json?: number[] | null
          text_embedding_vec?: string | null
          text_embedding_model?: string | null
          text_embedding_dims?: number | null
          text_embedding_fingerprint?: string | null
          text_embedding_updated_at?: string | null
          text_embedding_error?: string | null
          vision_catalog_checksum?: string | null
          vision_catalog_synced_at?: string | null
          vision_catalog_excluded?: boolean
          consult_link_opening_text?: string | null
          consult_link_opening_input_fingerprint?: string | null
          colors_json?: { name: string; img: string }[] | null
          sizes_json?: string[] | null
          gallery_urls?: string[]
          detail_image_urls?: string[]
          product_studio_meta?: Json | null
          origin?: string | null
          product_studio_job_id?: string | null
          catalog_json?: Json | null
          brand_name?: string | null
          source_origin?: string | null
          chinese_name?: string | null
          deposit_required?: boolean
          category_l1?: string | null
          category_l2?: string | null
          category_l3?: string | null
          likes_count?: number
          purchases_count?: number
          reviews_count?: number
          questions_count?: number
          rating_score?: number
          catalog_slug?: string | null
          style?: string | null
          color_summary?: string | null
          occasion?: string | null
          weight?: string | null
          features_json?: string[] | null
          product_info_json?: Json | null
          source_shop_name?: string | null
          source_shop_id?: string | null
          source_shop_name_chinese?: string | null
          price_low_hint?: string | null
          price_high_hint?: string | null
          rating_group_id?: number | null
          question_group_id?: number | null
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
          stock_qty?: number
          price_hint?: string
          image_url?: string
          product_url?: string
          product_video_url?: string
          consult_note?: string
          remarketing_id?: string
          material_note?: string
          material_detail_image_url?: string
          real_use_image_url?: string
          real_use_image_url_2?: string
          is_active?: boolean
          price_amount?: number | null
          price_currency?: string
          sale_price_amount?: number | null
          sale_starts_at?: string | null
          sale_ends_at?: string | null
          image_embedding_json?: number[] | null
          image_embedding_vec?: string | null
          image_embedding_model?: string | null
          image_embedding_dims?: number | null
          image_embedding_fingerprint?: string | null
          image_embedding_updated_at?: string | null
          image_embedding_error?: string | null
          text_embedding_json?: number[] | null
          text_embedding_vec?: string | null
          text_embedding_model?: string | null
          text_embedding_dims?: number | null
          text_embedding_fingerprint?: string | null
          text_embedding_updated_at?: string | null
          text_embedding_error?: string | null
          vision_catalog_checksum?: string | null
          vision_catalog_synced_at?: string | null
          vision_catalog_excluded?: boolean
          consult_link_opening_text?: string | null
          consult_link_opening_input_fingerprint?: string | null
          colors_json?: { name: string; img: string }[] | null
          sizes_json?: string[] | null
          gallery_urls?: string[]
          detail_image_urls?: string[]
          product_studio_meta?: Json | null
          origin?: string | null
          product_studio_job_id?: string | null
          catalog_json?: Json | null
          brand_name?: string | null
          source_origin?: string | null
          chinese_name?: string | null
          deposit_required?: boolean
          category_l1?: string | null
          category_l2?: string | null
          category_l3?: string | null
          likes_count?: number
          purchases_count?: number
          reviews_count?: number
          questions_count?: number
          rating_score?: number
          catalog_slug?: string | null
          style?: string | null
          color_summary?: string | null
          occasion?: string | null
          weight?: string | null
          features_json?: string[] | null
          product_info_json?: Json | null
          source_shop_name?: string | null
          source_shop_id?: string | null
          source_shop_name_chinese?: string | null
          price_low_hint?: string | null
          price_high_hint?: string | null
          rating_group_id?: number | null
          question_group_id?: number | null
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
      messaging_partner_ai_token_usage: {
        Row: {
          id: string
          partner_id: string
          provider: string
          model: string
          prompt_tokens: number | null
          completion_tokens: number | null
          total_tokens: number | null
          conversation_id: string | null
          ai_job_id: string | null
          usage_kind: string | null
          created_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          provider?: string
          model: string
          prompt_tokens?: number | null
          completion_tokens?: number | null
          total_tokens?: number | null
          conversation_id?: string | null
          ai_job_id?: string | null
          usage_kind?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          model?: string
          provider?: string
          prompt_tokens?: number | null
          completion_tokens?: number | null
          total_tokens?: number | null
          conversation_id?: string | null
          ai_job_id?: string | null
          usage_kind?: string | null
          created_at?: string
        }
        Relationships: []
      }
      messaging_partner_image_embed_usage: {
        Row: {
          id: string
          partner_id: string
          source: 'inventory_sync' | 'guest_image_search'
          model: string
          prompt_tokens: number
          total_tokens: number
          inventory_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          source: 'inventory_sync' | 'guest_image_search'
          model: string
          prompt_tokens?: number
          total_tokens?: number
          inventory_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          source?: 'inventory_sync' | 'guest_image_search'
          model?: string
          prompt_tokens?: number
          total_tokens?: number
          inventory_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      messaging_partner_text_embed_usage: {
        Row: {
          id: string
          partner_id: string
          source: 'inventory_sync' | 'customer_query'
          model: string
          prompt_tokens: number
          total_tokens: number
          inventory_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          source: 'inventory_sync' | 'customer_query'
          model: string
          prompt_tokens?: number
          total_tokens?: number
          inventory_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          source?: 'inventory_sync' | 'customer_query'
          model?: string
          prompt_tokens?: number
          total_tokens?: number
          inventory_id?: string | null
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
    Functions: Record<string, { Args: Record<string, never>; Returns: unknown }> & {
      messaging_partner_ai_token_stats_by_model: {
        Args: { p_partner_id: string; p_since: string }
        Returns: {
          provider: string
          model: string
          call_count: number
          sum_prompt_tokens: number
          sum_completion_tokens: number
          sum_total_tokens: number
        }[]
      }
      vision_warehouse_try_acquire_import_lock: {
        Args: { p_stale_seconds?: number; p_owner?: string }
        Returns: boolean
      }
      vision_warehouse_heartbeat_import_lock: {
        Args: { p_owner: string }
        Returns: boolean
      }
      vision_warehouse_release_import_lock: {
        Args: { p_owner?: string }
        Returns: null
      }
      match_messaging_partner_inventory_by_embedding: {
        Args: {
          p_partner_id: string
          p_query: string
          p_limit?: number
          p_min_score?: number
        }
        Returns: {
          inventory_id: string
          name: string
          sku: string | null
          image_url: string
          product_url: string | null
          score: number
        }[]
      }
      match_messaging_partner_inventory_by_text_embedding: {
        Args: {
          p_partner_id: string
          p_query: string
          p_limit?: number
          p_min_score?: number
        }
        Returns: {
          inventory_id: string
          name: string
          sku: string | null
          image_url: string
          product_url: string | null
          score: number
        }[]
      }
    }
  }
}
