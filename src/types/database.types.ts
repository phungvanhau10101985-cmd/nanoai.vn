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
        }
        Insert: {
          id?: string
          user_id: string
          original_image_url: string
          garment_image_url: string
          result_image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          original_image_url?: string
          garment_image_url?: string
          result_image_url?: string | null
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
      }
    }
  }
}
