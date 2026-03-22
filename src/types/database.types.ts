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
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
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
