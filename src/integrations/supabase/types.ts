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
      accounts: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          name: string
          org_id: string
          preferences: Json
          requirements: Json
          status: string
          tier: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          name: string
          org_id: string
          preferences?: Json
          requirements?: Json
          status?: string
          tier?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          name?: string
          org_id?: string
          preferences?: Json
          requirements?: Json
          status?: string
          tier?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_constraints: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          org_id: string
          rule_definition: Json
          scope: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          org_id: string
          rule_definition?: Json
          scope?: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          rule_definition?: Json
          scope?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          org_id: string
          region: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          org_id: string
          region?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          org_id?: string
          region?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          created_at: string
          id: string
          metric: string
          name: string
          org_id: string
          scope: string
          type: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          name: string
          org_id: string
          scope?: string
          type: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          name?: string
          org_id?: string
          scope?: string
          type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          actual_result: Json
          expected_result: Json
          id: string
          org_id: string
          recommendation_id: string | null
          recorded_at: string
          variance: Json
          work_item_id: string | null
        }
        Insert: {
          actual_result?: Json
          expected_result?: Json
          id?: string
          org_id: string
          recommendation_id?: string | null
          recorded_at?: string
          variance?: Json
          work_item_id?: string | null
        }
        Update: {
          actual_result?: Json
          expected_result?: Json
          id?: string
          org_id?: string
          recommendation_id?: string | null
          recorded_at?: string
          variance?: Json
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          industry: string | null
          name: string
          org_id: string
          rules: Json
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          org_id: string
          rules?: Json
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          org_id?: string
          rules?: Json
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          alternatives: Json
          approval_level: number
          confidence_score: number
          context: Json
          created_at: string
          id: string
          impact_assessment: Json
          options: Json
          org_id: string
          reasoning: Json
          risks: Json
          selected_option: Json
          status: string
          trigger: string
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          alternatives?: Json
          approval_level?: number
          confidence_score?: number
          context?: Json
          created_at?: string
          id?: string
          impact_assessment?: Json
          options?: Json
          org_id: string
          reasoning?: Json
          risks?: Json
          selected_option?: Json
          status?: string
          trigger: string
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          alternatives?: Json
          approval_level?: number
          confidence_score?: number
          context?: Json
          created_at?: string
          id?: string
          impact_assessment?: Json
          options?: Json
          org_id?: string
          reasoning?: Json
          risks?: Json
          selected_option?: Json
          status?: string
          trigger?: string
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          created_at: string
          description: string
          id: string
          org_id: string
          type: string
          value: Json
          weight: number
          work_item_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          org_id: string
          type: string
          value?: Json
          weight?: number
          work_item_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          org_id?: string
          type?: string
          value?: Json
          weight?: number
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          org_id: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          org_id: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          org_id?: string
          resource_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_availability_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          capacity: number
          cost_rate: number
          created_at: string
          id: string
          location_id: string | null
          metadata: Json
          name: string
          org_id: string
          skills: string[]
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          cost_rate?: number
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          name: string
          org_id: string
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          cost_rate?: number
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          name?: string
          org_id?: string
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          account_id: string | null
          assigned_resource_id: string | null
          created_at: string
          deadline: string | null
          duration_minutes: number
          id: string
          location_id: string | null
          metadata: Json
          org_id: string
          priority: number
          required_skills: string[]
          scheduled_start: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_resource_id?: string | null
          created_at?: string
          deadline?: string | null
          duration_minutes?: number
          id?: string
          location_id?: string | null
          metadata?: Json
          org_id: string
          priority?: number
          required_skills?: string[]
          scheduled_start?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_resource_id?: string | null
          created_at?: string
          deadline?: string | null
          duration_minutes?: number
          id?: string
          location_id?: string | null
          metadata?: Json
          org_id?: string
          priority?: number
          required_skills?: string[]
          scheduled_start?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_assigned_resource_id_fkey"
            columns: ["assigned_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
