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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string
          display_name: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          after_data: Json | null
          before_data: Json | null
          created_at: string
          group_id: string | null
          id: string
          meeting_id: string | null
          request_id: string | null
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          group_id?: string | null
          id?: string
          meeting_id?: string | null
          request_id?: string | null
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          group_id?: string | null
          id?: string
          meeting_id?: string | null
          request_id?: string | null
          target_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      fa_access_codes: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          group_id: string
          id: string
          is_active: boolean
          meeting_id: string
          rotated_at: string
          updated_at: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          meeting_id: string
          rotated_at?: string
          updated_at?: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          meeting_id?: string
          rotated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fa_access_codes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_access_codes_meeting_id_group_id_fkey"
            columns: ["meeting_id", "group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["meeting_id", "id"]
          },
        ]
      }
      fa_access_attempts: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          group_id: string
          ip_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          group_id: string
          ip_hash: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          group_id?: string
          ip_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fa_access_attempts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      fa_sessions: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string
          id: string
          ip_hash: string | null
          last_seen_at: string
          meeting_id: string
          revoked_at: string | null
          session_hash: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          group_id: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          meeting_id: string
          revoked_at?: string | null
          session_hash: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          meeting_id?: string
          revoked_at?: string | null
          session_hash?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fa_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_sessions_meeting_id_group_id_fkey"
            columns: ["meeting_id", "group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["meeting_id", "id"]
          },
        ]
      }
      issues: {
        Row: {
          action_plan: string
          created_at: string
          deleted_at: string | null
          evaluation: string
          findings: string
          group_id: string
          id: string
          meeting_id: string
          position: number
          proposal: string
          row_version: number
          stakeholder_roles: string
          topic: string
          updated_at: string
        }
        Insert: {
          action_plan?: string
          created_at?: string
          deleted_at?: string | null
          evaluation?: string
          findings?: string
          group_id: string
          id?: string
          meeting_id: string
          position: number
          proposal?: string
          row_version?: number
          stakeholder_roles?: string
          topic?: string
          updated_at?: string
        }
        Update: {
          action_plan?: string
          created_at?: string
          deleted_at?: string | null
          evaluation?: string
          findings?: string
          group_id?: string
          id?: string
          meeting_id?: string
          position?: number
          proposal?: string
          row_version?: number
          stakeholder_roles?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_meeting_id_group_id_fkey"
            columns: ["meeting_id", "group_id"]
            isOneToOne: false
            referencedRelation: "meeting_groups"
            referencedColumns: ["meeting_id", "id"]
          },
        ]
      }
      meeting_groups: {
        Row: {
          created_at: string
          finalized_at: string | null
          group_no: number
          id: string
          meeting_id: string
          name: string
          presenter: string
          row_version: number
          scope: string
          status: Database["public"]["Enums"]["group_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          group_no: number
          id?: string
          meeting_id: string
          name: string
          presenter?: string
          row_version?: number
          scope?: string
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          group_no?: number
          id?: string
          meeting_id?: string
          name?: string
          presenter?: string
          row_version?: number
          scope?: string
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_groups_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          ends_at: string
          fiscal_year: number
          id: string
          location: string
          meeting_date: string
          row_version: number
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          fiscal_year: number
          id?: string
          location?: string
          meeting_date: string
          row_version?: number
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          fiscal_year?: number
          id?: string
          location?: string
          meeting_date?: string
          row_version?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mutation_receipts: {
        Row: {
          created_at: string
          fa_session_id: string | null
          id: string
          mutation_id: string
          result: Json
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fa_session_id?: string | null
          id?: string
          mutation_id: string
          result?: Json
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fa_session_id?: string | null
          id?: string
          mutation_id?: string
          result?: Json
          target_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutation_receipts_fa_session_id_fkey"
            columns: ["fa_session_id"]
            isOneToOne: false
            referencedRelation: "fa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      actor_type: "fa" | "admin" | "system"
      admin_role: "admin"
      group_status: "draft" | "review_ready" | "final"
      meeting_status: "draft" | "active" | "closed"
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
      actor_type: ["fa", "admin", "system"],
      admin_role: ["admin"],
      group_status: ["draft", "review_ready", "final"],
      meeting_status: ["draft", "active", "closed"],
    },
  },
} as const
