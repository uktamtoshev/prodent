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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_analytics: {
        Row: {
          campaign_id: string
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          page_url: string | null
          referrer_url: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          amount_paid: number
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          doctor_id: string | null
          end_date: string
          id: string
          package_id: string
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          priority: number | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid: number
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          doctor_id?: string | null
          end_date: string
          id?: string
          package_id: string
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          priority?: number | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          doctor_id?: string | null
          end_date?: string
          id?: string
          package_id?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          priority?: number | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ad_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_packages: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          max_slots: number | null
          name: string
          name_en: string | null
          name_uz: string | null
          package_type: string
          price: number
          target_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean | null
          max_slots?: number | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          package_type: string
          price: number
          target_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          max_slots?: number | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          package_type?: string
          price?: number
          target_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      add_on_pricing: {
        Row: {
          add_on_id: string
          created_at: string
          duration_days: number
          id: string
          is_active: boolean | null
          price: number
        }
        Insert: {
          add_on_id: string
          created_at?: string
          duration_days: number
          id?: string
          is_active?: boolean | null
          price: number
        }
        Update: {
          add_on_id?: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "add_on_pricing_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_on_services"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_purchases: {
        Row: {
          add_on_id: string
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          duration_days: number
          end_date: string
          id: string
          is_active: boolean | null
          price_paid: number
          start_date: string
          transaction_id: string | null
        }
        Insert: {
          add_on_id: string
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          duration_days: number
          end_date: string
          id?: string
          is_active?: boolean | null
          price_paid: number
          start_date?: string
          transaction_id?: string | null
        }
        Update: {
          add_on_id?: string
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          duration_days?: number
          end_date?: string
          id?: string
          is_active?: boolean | null
          price_paid?: number
          start_date?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "add_on_purchases_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_on_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_purchases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_purchases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_purchases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "virtual_account_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_services: {
        Row: {
          bg_color: string | null
          color: string | null
          created_at: string
          description: string | null
          description_en: string | null
          description_uz: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          service_type: string
          target_type: string
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          service_type: string
          target_type: string
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          service_type?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string | null
          discount: number | null
          id: string
          price: number
          quantity: number | null
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          discount?: number | null
          id?: string
          price: number
          quantity?: number | null
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          discount?: number | null
          id?: string
          price?: number
          quantity?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          clinic_id: string | null
          created_at: string | null
          doctor_id: string
          guest_patient_id: string | null
          id: string
          notes: string | null
          patient_id: string | null
          price: number | null
          room_id: string | null
          service: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          clinic_id?: string | null
          created_at?: string | null
          doctor_id: string
          guest_patient_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          price?: number | null
          room_id?: string | null
          service: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string
          guest_patient_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          price?: number | null
          room_id?: string | null
          service?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_guest_patient_id_fkey"
            columns: ["guest_patient_id"]
            isOneToOne: false
            referencedRelation: "guest_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments_queue: {
        Row: {
          appointment_id: string
          arrival_time: string | null
          called_time: string | null
          clinic_id: string | null
          completed_time: string | null
          created_at: string | null
          doctor_id: string
          id: string
          patient_id: string
          queue_number: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id: string
          arrival_time?: string | null
          called_time?: string | null
          clinic_id?: string | null
          completed_time?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          patient_id: string
          queue_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string
          arrival_time?: string | null
          called_time?: string | null
          clinic_id?: string | null
          completed_time?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          patient_id?: string
          queue_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_queue_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_queue_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_id?: string | null
        }
        Relationships: []
      }
      badge_assignments: {
        Row: {
          assigned_by: string | null
          badge_id: string
          clinic_id: string | null
          created_at: string | null
          doctor_id: string | null
          end_date: string
          id: string
          is_active: boolean | null
          notes: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          badge_id: string
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          badge_id?: string
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badge_assignments_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_assignments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_assignments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          bg_color: string
          color: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          target_type: string
          updated_at: string | null
        }
        Insert: {
          bg_color?: string
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          target_type?: string
          updated_at?: string | null
        }
        Update: {
          bg_color?: string
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          target_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          cover_image: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          published: boolean | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          published?: boolean | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          published?: boolean | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_register: {
        Row: {
          clinic_id: string
          closed_by: string | null
          closing_balance: number | null
          created_at: string
          currency: string | null
          date: string
          id: string
          notes: string | null
          opening_balance: number
          status: string | null
          total_expense: number | null
          total_income: number | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          status?: string | null
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          status?: string | null
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_applications: {
        Row: {
          additional_documents: string[] | null
          address: string
          city: string
          created_at: string | null
          description: string | null
          director_name: string
          district: string | null
          email: string
          id: string
          license_document_url: string
          license_number: string
          logo_url: string | null
          name: string
          phone: string
          registration_document_url: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          additional_documents?: string[] | null
          address: string
          city: string
          created_at?: string | null
          description?: string | null
          director_name: string
          district?: string | null
          email: string
          id?: string
          license_document_url: string
          license_number: string
          logo_url?: string | null
          name: string
          phone: string
          registration_document_url: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          additional_documents?: string[] | null
          address?: string
          city?: string
          created_at?: string | null
          description?: string | null
          director_name?: string
          district?: string | null
          email?: string
          id?: string
          license_document_url?: string
          license_number?: string
          logo_url?: string | null
          name?: string
          phone?: string
          registration_document_url?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      clinic_doctor_services: {
        Row: {
          clinic_id: string
          created_at: string | null
          custom_price: number | null
          doctor_id: string
          id: string
          is_active: boolean | null
          service_id: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          custom_price?: number | null
          doctor_id: string
          id?: string
          is_active?: boolean | null
          service_id: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          custom_price?: number | null
          doctor_id?: string
          id?: string
          is_active?: boolean | null
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_doctor_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_doctor_services_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_doctor_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_followers: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_followers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_member_permissions: {
        Row: {
          can_edit: boolean
          can_manage: boolean
          can_view: boolean
          clinic_id: string
          created_at: string | null
          id: string
          module: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_manage?: boolean
          can_view?: boolean
          clinic_id: string
          created_at?: string | null
          id?: string
          module: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_manage?: boolean
          can_view?: boolean
          clinic_id?: string
          created_at?: string | null
          id?: string
          module?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_member_permissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          assigned_doctor_id: string | null
          clinic_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_doctor_id?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_doctor_id?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_portfolio: {
        Row: {
          after_image_url: string | null
          before_image_url: string | null
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          media_url: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          after_image_url?: string | null
          before_image_url?: string | null
          clinic_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          media_url?: string | null
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          after_image_url?: string | null
          before_image_url?: string | null
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          media_url?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_portfolio_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_post_media: {
        Row: {
          created_at: string | null
          id: string
          order_index: number | null
          post_id: string
          thumbnail_url: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          post_id: string
          thumbnail_url?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          post_id?: string
          thumbnail_url?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "clinic_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_posts: {
        Row: {
          clinic_id: string
          comments_count: number | null
          content: string | null
          created_at: string | null
          id: string
          is_published: boolean | null
          likes_count: number | null
          post_type: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          likes_count?: number | null
          post_type?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          likes_count?: number | null
          post_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_posts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_reviews: {
        Row: {
          clinic_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          patient_id: string
          rating: number
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          patient_id: string
          rating: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          patient_id?: string
          rating?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          appointment_duration: number
          auto_confirm_appointments: boolean | null
          clinic_id: string
          created_at: string
          email_notifications: boolean | null
          id: string
          max_advance_booking_days: number
          online_booking_enabled: boolean | null
          queue_enabled: boolean | null
          settings_json: Json | null
          sms_notifications: boolean | null
          updated_at: string
        }
        Insert: {
          appointment_duration?: number
          auto_confirm_appointments?: boolean | null
          clinic_id: string
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          max_advance_booking_days?: number
          online_booking_enabled?: boolean | null
          queue_enabled?: boolean | null
          settings_json?: Json | null
          sms_notifications?: boolean | null
          updated_at?: string
        }
        Update: {
          appointment_duration?: number
          auto_confirm_appointments?: boolean | null
          clinic_id?: string
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          max_advance_booking_days?: number
          online_booking_enabled?: boolean | null
          queue_enabled?: boolean | null
          settings_json?: Json | null
          sms_notifications?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_tasks: {
        Row: {
          assigned_to: string
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_appointment_id: string | null
          related_patient_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_appointment_id?: string | null
          related_patient_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_appointment_id?: string | null
          related_patient_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_tasks_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_tasks_related_patient_id_fkey"
            columns: ["related_patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string
          appointments_reset_at: string | null
          city: string
          cover_image: string | null
          created_at: string | null
          description: string | null
          district: string | null
          email: string | null
          id: string
          images: string[] | null
          landmark: string | null
          latitude: number | null
          longitude: number | null
          monthly_appointments_count: number | null
          name: string
          phone: string
          subscription_expires_at: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          address: string
          appointments_reset_at?: string | null
          city: string
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          email?: string | null
          id?: string
          images?: string[] | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          monthly_appointments_count?: number | null
          name: string
          phone: string
          subscription_expires_at?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string
          appointments_reset_at?: string | null
          city?: string
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          email?: string | null
          id?: string
          images?: string[] | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          monthly_appointments_count?: number | null
          name?: string
          phone?: string
          subscription_expires_at?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      dental_chart: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          diagnosis: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string | null
          tooth_number: number
          treatment_plan: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string | null
          tooth_number: number
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string | null
          tooth_number?: number
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dental_chart_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_chart_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          region_id: string
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          region_id: string
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          region_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_applications: {
        Row: {
          additional_documents: string[] | null
          bio: string | null
          certifications: string[]
          clinic_affiliation: string | null
          created_at: string | null
          diploma_document_url: string
          education: string
          email: string
          experience_years: number
          full_name: string
          id: string
          license_document_url: string
          license_number: string
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialty: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_documents?: string[] | null
          bio?: string | null
          certifications: string[]
          clinic_affiliation?: string | null
          created_at?: string | null
          diploma_document_url: string
          education: string
          email: string
          experience_years: number
          full_name: string
          id?: string
          license_document_url: string
          license_number: string
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_documents?: string[] | null
          bio?: string | null
          certifications?: string[]
          clinic_affiliation?: string | null
          created_at?: string | null
          diploma_document_url?: string
          education?: string
          email?: string
          experience_years?: number
          full_name?: string
          id?: string
          license_document_url?: string
          license_number?: string
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      doctor_awards: {
        Row: {
          created_at: string | null
          description: string | null
          doctor_id: string
          id: string
          image_url: string | null
          issue_date: string | null
          issuer: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          doctor_id: string
          id?: string
          image_url?: string | null
          issue_date?: string | null
          issuer?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          id?: string
          image_url?: string | null
          issue_date?: string | null
          issuer?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_awards_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_clinic_affiliations: {
        Row: {
          clinic_id: string
          contract_number: string | null
          cooperation_type: string
          created_at: string | null
          doctor_id: string
          end_date: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          notes: string | null
          rental_fee: number | null
          rental_period: string | null
          salary_percent: number | null
          start_date: string | null
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          clinic_id: string
          contract_number?: string | null
          cooperation_type?: string
          created_at?: string | null
          doctor_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          rental_fee?: number | null
          rental_period?: string | null
          salary_percent?: number | null
          start_date?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          clinic_id?: string
          contract_number?: string | null
          cooperation_type?: string
          created_at?: string | null
          doctor_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          rental_fee?: number | null
          rental_period?: string | null
          salary_percent?: number | null
          start_date?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_clinic_affiliations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_clinic_affiliations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_clinic_requests: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          invited_by: string | null
          message: string | null
          rejection_reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          invited_by?: string | null
          message?: string | null
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          invited_by?: string | null
          message?: string | null
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_clinic_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_clinic_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_clinic_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_followers: {
        Row: {
          created_at: string | null
          doctor_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_followers_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_messages: {
        Row: {
          content: string | null
          created_at: string | null
          doctor_id: string
          file_type: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          patient_id: string | null
          recipient_doctor_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          doctor_id: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          patient_id?: string | null
          recipient_doctor_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          doctor_id?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          patient_id?: string | null
          recipient_doctor_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_messages_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_messages_recipient_doctor_id_fkey"
            columns: ["recipient_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_portfolio: {
        Row: {
          after_image_url: string | null
          before_image_url: string | null
          created_at: string | null
          description: string | null
          doctor_id: string
          id: string
          is_featured: boolean | null
          media_url: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          after_image_url?: string | null
          before_image_url?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id: string
          id?: string
          is_featured?: boolean | null
          media_url?: string | null
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          after_image_url?: string | null
          before_image_url?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          id?: string
          is_featured?: boolean | null
          media_url?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_portfolio_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "doctor_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "doctor_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_post_media: {
        Row: {
          created_at: string | null
          id: string
          order_index: number | null
          post_id: string
          thumbnail_url: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          post_id: string
          thumbnail_url?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          post_id?: string
          thumbnail_url?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "doctor_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_posts: {
        Row: {
          comments_count: number | null
          content: string | null
          created_at: string | null
          doctor_id: string
          id: string
          is_published: boolean | null
          likes_count: number | null
          post_type: string
          updated_at: string | null
        }
        Insert: {
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          is_published?: boolean | null
          likes_count?: number | null
          post_type?: string
          updated_at?: string | null
        }
        Update: {
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          is_published?: boolean | null
          likes_count?: number | null
          post_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_posts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_salaries: {
        Row: {
          bonus: number | null
          calculated_salary: number
          clinic_id: string
          created_at: string
          currency: string | null
          deductions: number | null
          doctor_id: string
          final_salary: number
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          salary_percent: number
          status: string
          total_revenue: number
          updated_at: string
        }
        Insert: {
          bonus?: number | null
          calculated_salary?: number
          clinic_id: string
          created_at?: string
          currency?: string | null
          deductions?: number | null
          doctor_id: string
          final_salary?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          salary_percent?: number
          status?: string
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          bonus?: number | null
          calculated_salary?: number
          clinic_id?: string
          created_at?: string
          currency?: string | null
          deductions?: number | null
          doctor_id?: string
          final_salary?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          salary_percent?: number
          status?: string
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_salaries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_salaries_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_services: {
        Row: {
          category: string
          created_at: string | null
          currency: string
          description: string | null
          description_en: string | null
          description_uz: string | null
          doctor_id: string
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          price: number
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          doctor_id: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          price: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          doctor_id?: string
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_services_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          address: string | null
          appointments_reset_at: string | null
          bio: string | null
          category: string | null
          certifications: string[] | null
          clinic_id: string | null
          cooperation_type: string | null
          cover_image: string | null
          created_at: string | null
          education: string | null
          experience_years: number
          hide_contacts: boolean | null
          id: string
          images: string[] | null
          is_visible: boolean | null
          languages: string[] | null
          latitude: number | null
          longitude: number | null
          moderation_reviews: boolean | null
          monthly_appointments_count: number | null
          price_from: number
          rating: number | null
          reviews_count: number | null
          salary_percent: number | null
          specialty: string
          subscription_expires_at: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          video_url: string | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          appointments_reset_at?: string | null
          bio?: string | null
          category?: string | null
          certifications?: string[] | null
          clinic_id?: string | null
          cooperation_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          education?: string | null
          experience_years?: number
          hide_contacts?: boolean | null
          id?: string
          images?: string[] | null
          is_visible?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          longitude?: number | null
          moderation_reviews?: boolean | null
          monthly_appointments_count?: number | null
          price_from: number
          rating?: number | null
          reviews_count?: number | null
          salary_percent?: number | null
          specialty: string
          subscription_expires_at?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          video_url?: string | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          appointments_reset_at?: string | null
          bio?: string | null
          category?: string | null
          certifications?: string[] | null
          clinic_id?: string | null
          cooperation_type?: string | null
          cover_image?: string | null
          created_at?: string | null
          education?: string | null
          experience_years?: number
          hide_contacts?: boolean | null
          id?: string
          images?: string[] | null
          is_visible?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          longitude?: number | null
          moderation_reviews?: boolean | null
          monthly_appointments_count?: number | null
          price_from?: number
          rating?: number | null
          reviews_count?: number | null
          salary_percent?: number | null
          specialty?: string
          subscription_expires_at?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          video_url?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verifications: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string | null
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          phone?: string | null
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string | null
          clinic_id: string | null
          created_at: string | null
          date: string | null
          description: string | null
          doctor_id: string
          id: string
          patient_id: string | null
          type: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          doctor_id: string
          id?: string
          patient_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string | null
          clinic_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          doctor_id?: string
          id?: string
          patient_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_patients: {
        Row: {
          clinic_id: string | null
          comment: string | null
          converted_to_profile_id: string | null
          created_at: string
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          name: string
          phone: string
          sms_consent: boolean | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          comment?: string | null
          converted_to_profile_id?: string | null
          created_at?: string
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name: string
          phone: string
          sms_consent?: boolean | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          comment?: string | null
          converted_to_profile_id?: string | null
          created_at?: string
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name?: string
          phone?: string
          sms_consent?: boolean | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_patients_converted_to_profile_id_fkey"
            columns: ["converted_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string
          category_id: string | null
          clinic_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          min_quantity: number | null
          name: string
          name_en: string | null
          name_uz: string | null
          notes: string | null
          price_per_unit: number | null
          quantity: number
          supplier: string | null
          supplier_id: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_suppliers: {
        Row: {
          address: string | null
          clinic_id: string
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          inn: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          clinic_id: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          clinic_id?: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string | null
          id: string
          inventory_id: string
          quantity: number
          reason: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          inventory_id: string
          quantity: number
          reason?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          inventory_id?: string
          quantity?: number
          reason?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          clinic_id: string
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          discount_percent: number | null
          doctor_id: string | null
          final_amount: number
          id: string
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          patient_id: string
          payment_method: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          doctor_id?: string | null
          final_amount: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          payment_method?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          doctor_id?: string | null
          final_amount?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          payment_method?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_order_items: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          description: string
          id: string
          item_type: string
          material: string | null
          notes: string | null
          order_id: string
          quantity: number | null
          status: string | null
          tooth_number: number | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          description: string
          id?: string
          item_type: string
          material?: string | null
          notes?: string | null
          order_id: string
          quantity?: number | null
          status?: string | null
          tooth_number?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          description?: string
          id?: string
          item_type?: string
          material?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number | null
          status?: string | null
          tooth_number?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_order_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laboratory_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratory_orders: {
        Row: {
          clinic_id: string
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          description: string
          doctor_id: string
          files: string[] | null
          id: string
          notes: string | null
          order_number: string | null
          patient_id: string
          price: number | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description: string
          doctor_id: string
          files?: string[] | null
          id?: string
          notes?: string | null
          order_number?: string | null
          patient_id: string
          price?: number | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string
          doctor_id?: string
          files?: string[] | null
          id?: string
          notes?: string | null
          order_number?: string | null
          patient_id?: string
          price?: number | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laboratory_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          before_after: boolean | null
          created_at: string | null
          description: string | null
          doctor_id: string
          id: string
          order_index: number | null
          thumbnail_url: string | null
          title: string | null
          type: string
          url: string
        }
        Insert: {
          before_after?: boolean | null
          created_at?: string | null
          description?: string | null
          doctor_id: string
          id?: string
          order_index?: number | null
          thumbnail_url?: string | null
          title?: string | null
          type: string
          url: string
        }
        Update: {
          before_after?: boolean | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          id?: string
          order_index?: number | null
          thumbnail_url?: string | null
          title?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_access_requests: {
        Row: {
          created_at: string
          doctor_consent: boolean
          doctor_consent_at: string | null
          doctor_id: string
          expires_at: string | null
          id: string
          message: string | null
          patient_consent: boolean | null
          patient_consent_at: string | null
          patient_id: string
          request_type: string
          responded_at: string | null
          response_message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_consent?: boolean
          doctor_consent_at?: string | null
          doctor_id: string
          expires_at?: string | null
          id?: string
          message?: string | null
          patient_consent?: boolean | null
          patient_consent_at?: string | null
          patient_id: string
          request_type?: string
          responded_at?: string | null
          response_message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_consent?: boolean
          doctor_consent_at?: string | null
          doctor_id?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          patient_consent?: boolean | null
          patient_consent_at?: string | null
          patient_id?: string
          request_type?: string
          responded_at?: string | null
          response_message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_access_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_access_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_record_access: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          granted_by: string | null
          id: string
          patient_consent: boolean | null
          patient_consent_at: string | null
          patient_id: string
          reason: string
          source: string
          status: string
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          granted_by?: string | null
          id?: string
          patient_consent?: boolean | null
          patient_consent_at?: string | null
          patient_id: string
          reason: string
          source: string
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          granted_by?: string | null
          id?: string
          patient_consent?: boolean | null
          patient_consent_at?: string | null
          patient_id?: string
          reason?: string
          source?: string
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_record_access_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_record_access_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          chief_complaint: string | null
          clinic_id: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          examination: string | null
          id: string
          next_visit_date: string | null
          notes: string | null
          patient_id: string
          recommendations: string | null
          treatment_provided: string | null
          updated_at: string | null
          visit_date: string
          voice_notes: string[] | null
        }
        Insert: {
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          examination?: string | null
          id?: string
          next_visit_date?: string | null
          notes?: string | null
          patient_id: string
          recommendations?: string | null
          treatment_provided?: string | null
          updated_at?: string | null
          visit_date?: string
          voice_notes?: string[] | null
        }
        Update: {
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          examination?: string | null
          id?: string
          next_visit_date?: string | null
          notes?: string | null
          patient_id?: string
          recommendations?: string | null
          treatment_provided?: string | null
          updated_at?: string | null
          visit_date?: string
          voice_notes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_add_requests: {
        Row: {
          clinic_id: string
          created_at: string
          doctor_id: string | null
          id: string
          message: string | null
          patient_id: string
          requested_by: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doctor_id?: string | null
          id?: string
          message?: string | null
          patient_id: string
          requested_by: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doctor_id?: string | null
          id?: string
          message?: string | null
          patient_id?: string
          requested_by?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_add_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_add_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_add_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_add_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_balances: {
        Row: {
          balance: number
          clinic_id: string
          created_at: string | null
          id: string
          last_payment_date: string | null
          notes: string | null
          patient_id: string
          total_debt: number | null
          total_prepaid: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number
          clinic_id: string
          created_at?: string | null
          id?: string
          last_payment_date?: string | null
          notes?: string | null
          patient_id: string
          total_debt?: number | null
          total_prepaid?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number
          clinic_id?: string
          created_at?: string | null
          id?: string
          last_payment_date?: string | null
          notes?: string | null
          patient_id?: string
          total_debt?: number | null
          total_prepaid?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_balances_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_family_members: {
        Row: {
          birth_date: string | null
          created_at: string | null
          family_member_id: string | null
          full_name: string
          gender: string | null
          id: string
          is_active: boolean | null
          main_patient_id: string
          notes: string | null
          phone: string | null
          relationship: string
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          family_member_id?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          main_patient_id: string
          notes?: string | null
          phone?: string | null
          relationship: string
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          family_member_id?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          main_patient_id?: string
          notes?: string | null
          phone?: string | null
          relationship?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_family_members_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_family_members_main_patient_id_fkey"
            columns: ["main_patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_files: {
        Row: {
          comments: string | null
          created_at: string | null
          description: string | null
          doctor_id: string | null
          file_type: string
          file_url: string
          id: string
          patient_id: string
          thumbnail_url: string | null
          title: string | null
          uploaded_by: string | null
          visit_date: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string | null
          file_type: string
          file_url: string
          id?: string
          patient_id: string
          thumbnail_url?: string | null
          title?: string | null
          uploaded_by?: string | null
          visit_date?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string | null
          file_type?: string
          file_url?: string
          id?: string
          patient_id?: string
          thumbnail_url?: string | null
          title?: string | null
          uploaded_by?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_health_index: {
        Row: {
          assessment_date: string | null
          clinic_id: string | null
          created_at: string | null
          doctor_id: string | null
          gum_health: number | null
          hygiene_score: number | null
          id: string
          next_assessment_date: string | null
          notes: string | null
          overall_score: number
          patient_id: string
          teeth_condition: number | null
          updated_at: string | null
        }
        Insert: {
          assessment_date?: string | null
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          gum_health?: number | null
          hygiene_score?: number | null
          id?: string
          next_assessment_date?: string | null
          notes?: string | null
          overall_score: number
          patient_id: string
          teeth_condition?: number | null
          updated_at?: string | null
        }
        Update: {
          assessment_date?: string | null
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string | null
          gum_health?: number | null
          hygiene_score?: number | null
          id?: string
          next_assessment_date?: string | null
          notes?: string | null
          overall_score?: number
          patient_id?: string
          teeth_condition?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_health_index_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_health_index_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_health_index_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_messages: {
        Row: {
          clinic_id: string
          content: string | null
          created_at: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          patient_id: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          clinic_id: string
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          patient_id: string
          sender_id: string
          sender_type: string
        }
        Update: {
          clinic_id?: string
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          patient_id?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_payment_notes: {
        Row: {
          amount: number
          clinic_name: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_resolved: boolean | null
          patient_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          clinic_name?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_resolved?: boolean | null
          patient_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          clinic_name?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_resolved?: boolean | null
          patient_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      patient_recommendations: {
        Row: {
          clinic_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string
          doctor_id: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          patient_id: string
          priority: string | null
          recommendation_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description: string
          doctor_id?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          patient_id: string
          priority?: string | null
          recommendation_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string
          doctor_id?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          patient_id?: string
          priority?: string | null
          recommendation_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_recommendations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_recommendations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_recommendations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_settings: {
        Row: {
          created_at: string | null
          id: string
          language: string | null
          notification_email: boolean | null
          notification_sms: boolean | null
          notification_telegram: boolean | null
          patient_id: string
          privacy_mode: boolean | null
          reminder_brush_teeth: boolean | null
          reminder_time: string | null
          telegram_connected: boolean | null
          telegram_username: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string | null
          notification_email?: boolean | null
          notification_sms?: boolean | null
          notification_telegram?: boolean | null
          patient_id: string
          privacy_mode?: boolean | null
          reminder_brush_teeth?: boolean | null
          reminder_time?: string | null
          telegram_connected?: boolean | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string | null
          notification_email?: boolean | null
          notification_sms?: boolean | null
          notification_telegram?: boolean | null
          patient_id?: string
          privacy_mode?: boolean | null
          reminder_brush_teeth?: boolean | null
          reminder_time?: string | null
          telegram_connected?: boolean | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_tags: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          patient_id: string
          tag: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          patient_id: string
          tag: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          patient_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_tags_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_teeth_status: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          formula_type: string
          id: string
          images: string[] | null
          materials: string | null
          notes: string | null
          patient_id: string
          recommendations: string | null
          status: string
          tooth_number: number
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          formula_type?: string
          id?: string
          images?: string[] | null
          materials?: string | null
          notes?: string | null
          patient_id: string
          recommendations?: string | null
          status?: string
          tooth_number: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          formula_type?: string
          id?: string
          images?: string[] | null
          materials?: string | null
          notes?: string | null
          patient_id?: string
          recommendations?: string | null
          status?: string
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_teeth_status_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_teeth_status_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_teeth_status_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_converted: number | null
          clinic_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          doctor_id: string | null
          exchange_rate: number | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          payment_method: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          amount_converted?: number | null
          clinic_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          doctor_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          amount_converted?: number | null
          clinic_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          doctor_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string | null
          expires_at: string
          full_name: string
          id: string
          phone: string
          user_role: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          full_name: string
          id?: string
          phone: string
          user_role: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string
          user_role?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          country: string | null
          created_at: string | null
          district: string | null
          email: string | null
          email_verified: boolean | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          middle_name: string | null
          notes: string | null
          password_set: boolean | null
          phone: string | null
          phone_verified: boolean | null
          region: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          verification_method: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          middle_name?: string | null
          notes?: string | null
          password_set?: boolean | null
          phone?: string | null
          phone_verified?: boolean | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          verification_method?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          middle_name?: string | null
          notes?: string | null
          password_set?: boolean | null
          phone?: string | null
          phone_verified?: boolean | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          verification_method?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          category: string
          clinic_id: string | null
          created_at: string
          description: string
          discount: number
          doctor_id: string | null
          id: string
          image_url: string | null
          old_price: number
          price: number
          title: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          active?: boolean
          category: string
          clinic_id?: string | null
          created_at?: string
          description: string
          discount: number
          doctor_id?: string | null
          id?: string
          image_url?: string | null
          old_price: number
          price: number
          title: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          active?: boolean
          category?: string
          clinic_id?: string | null
          created_at?: string
          description?: string
          discount?: number
          doctor_id?: string | null
          id?: string
          image_url?: string | null
          old_price?: number
          price?: number
          title?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          country_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string | null
          currency: string | null
          doctor_id: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_date: string
          payment_method: string | null
          period_end: string
          period_start: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string | null
          currency?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_date?: string
          payment_method?: string | null
          period_end: string
          period_start: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string | null
          currency?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_date?: string
          payment_method?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_at: string | null
          doctor_id: string
          id: string
          patient_id: string
          rating: number
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          patient_id: string
          rating: number
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          patient_id?: string
          rating?: number
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary: {
        Row: {
          base_salary: number | null
          bonus: number | null
          clinic_id: string
          created_at: string | null
          deductions: number | null
          doctor_id: string
          doctor_rate: number | null
          id: string
          month: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          procedures_count: number | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          base_salary?: number | null
          bonus?: number | null
          clinic_id: string
          created_at?: string | null
          deductions?: number | null
          doctor_id: string
          doctor_rate?: number | null
          id?: string
          month: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          procedures_count?: number | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          base_salary?: number | null
          bonus?: number | null
          clinic_id?: string
          created_at?: string | null
          deductions?: number | null
          doctor_id?: string
          doctor_rate?: number | null
          id?: string
          month?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          procedures_count?: number | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          clinic_id: string
          created_at: string | null
          currency: string | null
          description: string | null
          description_en: string | null
          description_uz: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          name_uz: string | null
          price: number
          updated_at: string | null
        }
        Insert: {
          category: string
          clinic_id: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          name_uz?: string | null
          price: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_en?: string | null
          description_uz?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          name_uz?: string | null
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          appointment_limit: number | null
          created_at: string | null
          entity_type: string
          features: Json | null
          has_analytics: boolean | null
          has_badge: boolean | null
          has_finance: boolean | null
          has_laboratory: boolean | null
          has_priority_search: boolean | null
          has_special_frame: boolean | null
          has_warehouse: boolean | null
          id: string
          name: string
          name_ru: string
          price: number
          updated_at: string | null
        }
        Insert: {
          appointment_limit?: number | null
          created_at?: string | null
          entity_type: string
          features?: Json | null
          has_analytics?: boolean | null
          has_badge?: boolean | null
          has_finance?: boolean | null
          has_laboratory?: boolean | null
          has_priority_search?: boolean | null
          has_special_frame?: boolean | null
          has_warehouse?: boolean | null
          id: string
          name: string
          name_ru: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          appointment_limit?: number | null
          created_at?: string | null
          entity_type?: string
          features?: Json | null
          has_analytics?: boolean | null
          has_badge?: boolean | null
          has_finance?: boolean | null
          has_laboratory?: boolean | null
          has_priority_search?: boolean | null
          has_special_frame?: boolean | null
          has_warehouse?: boolean | null
          id?: string
          name?: string
          name_ru?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tooth_attachments: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string | null
          doctor_id: string | null
          file_type: string
          file_url: string
          id: string
          patient_id: string
          tooth_numbers: number[]
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          doctor_id?: string | null
          file_type: string
          file_url: string
          id?: string
          patient_id: string
          tooth_numbers?: number[]
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          doctor_id?: string | null
          file_type?: string
          file_url?: string
          id?: string
          patient_id?: string
          tooth_numbers?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "tooth_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_attachments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_history: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          id: string
          images: string[] | null
          notes: string | null
          patient_id: string
          procedure_name: string | null
          status_after: string
          status_before: string | null
          tooth_number: number
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          patient_id: string
          procedure_name?: string | null
          status_after: string
          status_before?: string | null
          tooth_number: number
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          patient_id?: string
          procedure_name?: string | null
          status_after?: string
          status_before?: string | null
          tooth_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tooth_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_history_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_predictions: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          next_checkup_date: string | null
          patient_id: string
          predicted_status: string | null
          recommended_action: string | null
          risk_level: string
          tooth_number: number
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          next_checkup_date?: string | null
          patient_id: string
          predicted_status?: string | null
          recommended_action?: string | null
          risk_level?: string
          tooth_number: number
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          next_checkup_date?: string | null
          patient_id?: string
          predicted_status?: string | null
          recommended_action?: string | null
          risk_level?: string
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_predictions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_surfaces: {
        Row: {
          id: string
          notes: string | null
          patient_id: string
          status: string
          surface: string
          tooth_number: number
          updated_at: string
        }
        Insert: {
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          surface: string
          tooth_number: number
          updated_at?: string
        }
        Update: {
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          surface?: string
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_surfaces_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_material_usage: {
        Row: {
          clinic_id: string
          deducted_at: string
          deducted_by: string | null
          id: string
          inventory_id: string
          quantity: number
          treatment_item_id: string
        }
        Insert: {
          clinic_id: string
          deducted_at?: string
          deducted_by?: string | null
          id?: string
          inventory_id: string
          quantity?: number
          treatment_item_id: string
        }
        Update: {
          clinic_id?: string
          deducted_at?: string
          deducted_by?: string | null
          id?: string
          inventory_id?: string
          quantity?: number
          treatment_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_material_usage_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_material_usage_deducted_by_fkey"
            columns: ["deducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_material_usage_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_material_usage_treatment_item_id_fkey"
            columns: ["treatment_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          completed_at: string | null
          description: string
          description_kz: string | null
          description_kg: string | null
          description_ru: string | null
          description_tj: string | null
          description_uz: string | null
          description_uz_cyrl: string | null
          id: string
          notes: string | null
          quantity: number
          service_id: string | null
          sort_order: number | null
          stage_name: string | null
          status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          tooth_number: number | null
          total_price: number
          treatment_plan_id: string
          unit_price: number
        }
        Insert: {
          completed_at?: string | null
          description: string
          description_kz?: string | null
          description_kg?: string | null
          description_ru?: string | null
          description_tj?: string | null
          description_uz?: string | null
          description_uz_cyrl?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          sort_order?: number | null
          stage_name?: string | null
          status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          tooth_number?: number | null
          total_price: number
          treatment_plan_id: string
          unit_price: number
        }
        Update: {
          completed_at?: string | null
          description?: string
          description_kz?: string | null
          description_kg?: string | null
          description_ru?: string | null
          description_tj?: string | null
          description_uz?: string | null
          description_uz_cyrl?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          sort_order?: number | null
          stage_name?: string | null
          status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          tooth_number?: number | null
          total_price?: number
          treatment_plan_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinic_id: string
          created_at: string
          currency: string | null
          description: string | null
          description_kz: string | null
          description_kg: string | null
          description_ru: string | null
          description_tj: string | null
          description_uz: string | null
          description_uz_cyrl: string | null
          doctor_id: string
          discount_amount: number
          discount_comment: string | null
          discount_type: "PERCENT" | "FIXED"
          discount_value: number
          id: string
          patient_id: string
          patient_consent_confirmed_at: string | null
          patient_consent_confirmed_by: string | null
          status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          title: string
          title_kz: string | null
          title_kg: string | null
          title_ru: string | null
          title_tj: string | null
          title_uz: string | null
          title_uz_cyrl: string | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          description_kz?: string | null
          description_kg?: string | null
          description_ru?: string | null
          description_tj?: string | null
          description_uz?: string | null
          description_uz_cyrl?: string | null
          doctor_id: string
          discount_amount?: number
          discount_comment?: string | null
          discount_type?: "PERCENT" | "FIXED"
          discount_value?: number
          id?: string
          patient_id: string
          patient_consent_confirmed_at?: string | null
          patient_consent_confirmed_by?: string | null
          status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          title: string
          title_kz?: string | null
          title_kg?: string | null
          title_ru?: string | null
          title_tj?: string | null
          title_uz?: string | null
          title_uz_cyrl?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          description_kz?: string | null
          description_kg?: string | null
          description_ru?: string | null
          description_tj?: string | null
          description_uz?: string | null
          description_uz_cyrl?: string | null
          doctor_id?: string
          discount_amount?: number
          discount_comment?: string | null
          discount_type?: "PERCENT" | "FIXED"
          discount_value?: number
          id?: string
          patient_id?: string
          patient_consent_confirmed_at?: string | null
          patient_consent_confirmed_by?: string | null
          status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
          title?: string
          title_kz?: string | null
          title_kg?: string | null
          title_ru?: string | null
          title_tj?: string | null
          title_uz?: string | null
          title_uz_cyrl?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          id: string
          images: string[] | null
          materials_used: string[] | null
          notes: string | null
          patient_id: string
          price: number | null
          procedure: string
          status: string | null
          tooth_number: number | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          id?: string
          images?: string[] | null
          materials_used?: string[] | null
          notes?: string | null
          patient_id: string
          price?: number | null
          procedure: string
          status?: string | null
          tooth_number?: number | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          images?: string[] | null
          materials_used?: string[] | null
          notes?: string | null
          patient_id?: string
          price?: number | null
          procedure?: string
          status?: string | null
          tooth_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_account_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          payment_provider: string | null
          payment_status: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_accounts: {
        Row: {
          balance: number
          clinic_id: string | null
          created_at: string
          currency: string
          doctor_id: string | null
          id: string
          is_active: boolean
          owner_type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          clinic_id?: string | null
          created_at?: string
          currency?: string
          doctor_id?: string | null
          id?: string
          is_active?: boolean
          owner_type: string
          updated_at?: string
        }
        Update: {
          balance?: number
          clinic_id?: string | null
          created_at?: string
          currency?: string
          doctor_id?: string | null
          id?: string
          is_active?: boolean
          owner_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_accounts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_purchase_add_on: {
        Args: {
          p_add_on_id: string
          p_entity_id: string
          p_entity_type: string
        }
        Returns: Json
      }
      check_appointment_limit: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: Json
      }
      cleanup_expired_verifications: { Args: never; Returns: undefined }
      expire_add_on_purchases: { Args: never; Returns: undefined }
      expire_medical_access: { Args: never; Returns: undefined }
      extend_add_on_purchase: {
        Args: {
          p_add_on_id: string
          p_additional_days: number
          p_entity_id: string
          p_entity_type: string
          p_price: number
          p_transaction_id: string
        }
        Returns: Json
      }
      find_patient_by_phone: {
        Args: { p_clinic_id: string; p_phone: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
          patient_type: string
          phone: string
        }[]
      }
      get_active_add_ons: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          add_on_id: string
          bg_color: string
          color: string
          end_date: string
          icon: string
          name: string
          service_type: string
        }[]
      }
      get_add_on_remaining_days: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_service_type: string
        }
        Returns: number
      }
      get_doctor_clinics: {
        Args: { p_user_id: string }
        Returns: {
          clinic_id: string
          clinic_name: string
          cooperation_type: string
          is_primary: boolean
          salary_percent: number
        }[]
      }
      get_doctor_cooperation_type: {
        Args: { p_clinic_id: string; p_doctor_id: string }
        Returns: string
      }
      get_doctor_salary_percent: {
        Args: { p_clinic_id: string; p_doctor_id: string }
        Returns: number
      }
      get_entity_badges: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          badge_bg_color: string
          badge_color: string
          badge_icon: string
          badge_name: string
        }[]
      }
      get_plan_features: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: Json
      }
      get_user_clinic_id: { Args: never; Returns: string }
      get_user_clinic_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_add_on: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_service_type: string
        }
        Returns: boolean
      }
      has_clinic_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_medical_access: {
        Args: {
          p_clinic_id?: string
          p_doctor_id?: string
          p_patient_id: string
        }
        Returns: boolean
      }
      has_module_permission: {
        Args: {
          p_clinic_id: string
          p_level?: string
          p_module: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_profile_frame: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinic_admin_for_clinic: {
        Args: { check_clinic_id: string; check_user_id: string }
        Returns: boolean
      }
      is_doctor_affiliated_with_clinic: {
        Args: { p_clinic_id: string; p_doctor_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "moderator"
        | "doctor"
        | "patient"
        | "clinic_admin"
        | "assistant"
        | "accountant"
        | "clinic_manager"
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      subscription_plan:
        | "free"
        | "basic"
        | "premium"
        | "top"
        | "standard"
        | "gold"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
      user_role: "patient" | "doctor" | "admin" | "clinic"
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
      app_role: [
        "super_admin",
        "admin",
        "moderator",
        "doctor",
        "patient",
        "clinic_admin",
        "assistant",
        "accountant",
        "clinic_manager",
      ],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      subscription_plan: [
        "free",
        "basic",
        "premium",
        "top",
        "standard",
        "gold",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
      user_role: ["patient", "doctor", "admin", "clinic"],
    },
  },
} as const
