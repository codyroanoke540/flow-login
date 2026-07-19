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
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_duration_minutes: number
          id: string
          location_id: string | null
          metadata: Json
          name: string
          notes: string | null
          org_id: string
          preferences: Json
          required_skills: string[]
          requirements: Json
          status: string
          tier: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_duration_minutes?: number
          id?: string
          location_id?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          org_id: string
          preferences?: Json
          required_skills?: string[]
          requirements?: Json
          status?: string
          tier?: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_duration_minutes?: number
          id?: string
          location_id?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          org_id?: string
          preferences?: Json
          required_skills?: string[]
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
      approvals: {
        Row: {
          approved_at: string | null
          approved_candidate_id: string | null
          approver_role: string | null
          approver_user_id: string | null
          created_at: string
          id: string
          org_id: string
          reason: string | null
          recommendation_id: string
          rejected_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_candidate_id?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          reason?: string | null
          recommendation_id: string
          rejected_at?: string | null
          status: string
        }
        Update: {
          approved_at?: string | null
          approved_candidate_id?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          recommendation_id?: string
          rejected_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approved_candidate_id_fkey"
            columns: ["approved_candidate_id"]
            isOneToOne: false
            referencedRelation: "recommendation_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          model_version: string | null
          new_state: Json | null
          org_id: string
          pipeline_version: string | null
          policy_version_id: string | null
          previous_state: Json | null
          reason: string | null
          recommendation_id: string | null
          scoring_configuration_version: string | null
          source: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          model_version?: string | null
          new_state?: Json | null
          org_id: string
          pipeline_version?: string | null
          policy_version_id?: string | null
          previous_state?: Json | null
          reason?: string | null
          recommendation_id?: string | null
          scoring_configuration_version?: string | null
          source?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          model_version?: string | null
          new_state?: Json | null
          org_id?: string
          pipeline_version?: string | null
          policy_version_id?: string | null
          previous_state?: Json | null
          reason?: string | null
          recommendation_id?: string | null
          scoring_configuration_version?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
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
      org_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          feature_flags: Json
          industry: string
          onboarding_completed_at: string | null
          org_id: string
          scoring_config: Json
          terminology: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_flags?: Json
          industry?: string
          onboarding_completed_at?: string | null
          org_id: string
          scoring_config?: Json
          terminology?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_flags?: Json
          industry?: string
          onboarding_completed_at?: string | null
          org_id?: string
          scoring_config?: Json
          terminology?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
          active_organization_id: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_organization_id?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_organization_id?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifications: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_candidates: {
        Row: {
          created_at: string
          disqualification_reasons: Json
          eligible: boolean
          explanation: string | null
          factor_scores: Json
          id: string
          org_id: string
          rank: number | null
          recommendation_id: string
          resource_id: string | null
          resource_name: string
          weighted_score: number | null
        }
        Insert: {
          created_at?: string
          disqualification_reasons?: Json
          eligible: boolean
          explanation?: string | null
          factor_scores?: Json
          id?: string
          org_id: string
          rank?: number | null
          recommendation_id: string
          resource_id?: string | null
          resource_name: string
          weighted_score?: number | null
        }
        Update: {
          created_at?: string
          disqualification_reasons?: Json
          eligible?: boolean
          explanation?: string | null
          factor_scores?: Json
          id?: string
          org_id?: string
          rank?: number | null
          recommendation_id?: string
          resource_id?: string | null
          resource_name?: string
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_candidates_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_candidates_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
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
      resource_qualifications: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          issued_on: string | null
          metadata: Json
          org_id: string
          qualification_code: string
          resource_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          metadata?: Json
          org_id: string
          qualification_code: string
          resource_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          metadata?: Json
          org_id?: string
          qualification_code?: string
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_qualifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_qualifications_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_skills: {
        Row: {
          created_at: string
          id: string
          org_id: string
          proficiency: number | null
          resource_id: string
          skill: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          proficiency?: number | null
          resource_id: string
          skill: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          proficiency?: number | null
          resource_id?: string
          skill?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_skills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_skills_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          org_id: string
          reason: string | null
          resource_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          org_id: string
          reason?: string | null
          resource_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          resource_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_time_off_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_time_off_resource_id_fkey"
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
          deactivated_at: string | null
          email: string | null
          id: string
          location_id: string | null
          metadata: Json
          name: string
          notes: string | null
          org_id: string
          skills: string[]
          status: string
          type: string
          updated_at: string
          weekly_capacity_hours: number
        }
        Insert: {
          capacity?: number
          cost_rate?: number
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          org_id: string
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
          weekly_capacity_hours?: number
        }
        Update: {
          capacity?: number
          cost_rate?: number
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          org_id?: string
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
          weekly_capacity_hours?: number
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
      service_authorizations: {
        Row: {
          account_id: string
          authorized_units: number
          created_at: string
          end_date: string
          id: string
          notes: string | null
          org_id: string
          service_code: string
          start_date: string
          status: string
          updated_at: string
          used_units: number
        }
        Insert: {
          account_id: string
          authorized_units?: number
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          org_id: string
          service_code: string
          start_date: string
          status?: string
          updated_at?: string
          used_units?: number
        }
        Update: {
          account_id?: string
          authorized_units?: number
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          org_id?: string
          service_code?: string
          start_date?: string
          status?: string
          updated_at?: string
          used_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_authorizations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_authorizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_requirements: {
        Row: {
          created_at: string
          hard: boolean
          id: string
          kind: string
          org_id: string
          requirement: string
          weight: number | null
          work_item_id: string
        }
        Insert: {
          created_at?: string
          hard?: boolean
          id?: string
          kind: string
          org_id: string
          requirement: string
          weight?: number | null
          work_item_id: string
        }
        Update: {
          created_at?: string
          hard?: boolean
          id?: string
          kind?: string
          org_id?: string
          requirement?: string
          weight?: number | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_requirements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_requirements_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
          notes: string | null
          org_id: string
          priority: number
          required_qualifications: string[]
          required_skills: string[]
          scheduled_end: string | null
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
          notes?: string | null
          org_id: string
          priority?: number
          required_qualifications?: string[]
          required_skills?: string[]
          scheduled_end?: string | null
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
          notes?: string | null
          org_id?: string
          priority?: number
          required_qualifications?: string[]
          required_skills?: string[]
          scheduled_end?: string | null
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
      has_org_role: {
        Args: { _org_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      is_active_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
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
