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
      accounting_entries: {
        Row: {
          amount: number
          category: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_type: string
          gst_included: boolean | null
          gst_rate: number | null
          id: string
          lead_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_type: string
          gst_included?: boolean | null
          gst_rate?: number | null
          id?: string
          lead_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_type?: string
          gst_included?: boolean | null
          gst_rate?: number | null
          id?: string
          lead_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          lead_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          page_url: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_submissions: {
        Row: {
          approval_amount: number | null
          bank_application_id: string | null
          bank_name: string
          created_at: string
          disbursement_date: string | null
          id: string
          lead_id: string
          remarks: string | null
          status: string
          submission_date: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          approval_amount?: number | null
          bank_application_id?: string | null
          bank_name: string
          created_at?: string
          disbursement_date?: string | null
          id?: string
          lead_id: string
          remarks?: string | null
          status?: string
          submission_date?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          approval_amount?: number | null
          bank_application_id?: string | null
          bank_name?: string
          created_at?: string
          disbursement_date?: string | null
          id?: string
          lead_id?: string
          remarks?: string | null
          status?: string
          submission_date?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          company_id: string | null
          content: string
          cover_image: string | null
          created_at: string
          display_order: number | null
          excerpt: string | null
          id: string
          meta_description: string | null
          meta_keywords: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          company_id?: string | null
          content: string
          cover_image?: string | null
          created_at?: string
          display_order?: number | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          company_id?: string | null
          content?: string
          cover_image?: string | null
          created_at?: string
          display_order?: number | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_duration: number | null
          call_type: string | null
          caller_id: string
          company_id: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          outcome: string | null
        }
        Insert: {
          call_duration?: number | null
          call_type?: string | null
          caller_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          outcome?: string | null
        }
        Update: {
          call_duration?: number | null
          call_type?: string | null
          caller_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          custom_domain: string | null
          email: string | null
          google_analytics_id: string | null
          gst_rate: number
          id: string
          invoice_prefix: string | null
          is_active: boolean | null
          logo_url: string | null
          meta_pixel_id: string | null
          monthly_fee: number | null
          name: string
          phone: string | null
          primary_color: string | null
          royalty_per_lead: number | null
          royalty_percentage: number
          royalty_type: string
          secondary_color: string | null
          setup_fee: number | null
          setup_fee_paid: boolean | null
          slug: string
          updated_at: string
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          custom_domain?: string | null
          email?: string | null
          google_analytics_id?: string | null
          gst_rate?: number
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          meta_pixel_id?: string | null
          monthly_fee?: number | null
          name: string
          phone?: string | null
          primary_color?: string | null
          royalty_per_lead?: number | null
          royalty_percentage?: number
          royalty_type?: string
          secondary_color?: string | null
          setup_fee?: number | null
          setup_fee_paid?: boolean | null
          slug: string
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          custom_domain?: string | null
          email?: string | null
          google_analytics_id?: string | null
          gst_rate?: number
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          meta_pixel_id?: string | null
          monthly_fee?: number | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          royalty_per_lead?: number | null
          royalty_percentage?: number
          royalty_type?: string
          secondary_color?: string | null
          setup_fee?: number | null
          setup_fee_paid?: boolean | null
          slug?: string
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      company_integrations: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          service_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          service_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          service_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_owner: boolean | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_owner?: boolean | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_owner?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          lead_id: string
          remarks: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          lead_id: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          lead_id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_leaves_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_owner_companies: {
        Row: {
          company_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_owner_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_invoices: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          lead_id: string | null
          payment_id: string | null
          status: string
          total_amount: number
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          gst_amount: number
          id?: string
          invoice_date?: string
          invoice_number: string
          lead_id?: string | null
          payment_id?: string | null
          status?: string
          total_amount: number
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          lead_id?: string | null
          payment_id?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "gst_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gst_invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gst_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_members: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chats: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          lead_id: string
          reason: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id: string
          reason?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          assigned_count: number
          created_at: string
          id: string
          last_assigned_at: string | null
          telecaller_id: string
          updated_at: string
        }
        Insert: {
          assigned_count?: number
          created_at?: string
          id?: string
          last_assigned_at?: string | null
          telecaller_id: string
          updated_at?: string
        }
        Update: {
          assigned_count?: number
          created_at?: string
          id?: string
          last_assigned_at?: string | null
          telecaller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_scores: {
        Row: {
          activity_score: number | null
          created_at: string
          engagement_score: number | null
          id: string
          last_calculated_at: string | null
          lead_id: string
          profile_score: number | null
          score: number
          updated_at: string
        }
        Insert: {
          activity_score?: number | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          last_calculated_at?: string | null
          lead_id: string
          profile_score?: number | null
          score?: number
          updated_at?: string
        }
        Update: {
          activity_score?: number | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          last_calculated_at?: string | null
          lead_id?: string
          profile_score?: number | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          application_id: string | null
          assigned_to: string | null
          cibil_score_range: string | null
          city: string
          company_id: string | null
          created_at: string
          current_monthly_emi: number | null
          email: string
          emi_amount: number | null
          emi_bounce_last_6_months: boolean | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          follow_up_date: string | null
          follow_up_notes: string | null
          full_name: string
          id: string
          interest_rate: number | null
          is_interested: boolean | null
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          meta_fbc: string | null
          meta_fbp: string | null
          monthly_income: number
          phone: string
          pincode: string | null
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tenure_months: number | null
          transfer_reason: string | null
          transferred_at: string | null
          transferred_from: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          application_id?: string | null
          assigned_to?: string | null
          cibil_score_range?: string | null
          city: string
          company_id?: string | null
          created_at?: string
          current_monthly_emi?: number | null
          email: string
          emi_amount?: number | null
          emi_bounce_last_6_months?: boolean | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          follow_up_date?: string | null
          follow_up_notes?: string | null
          full_name: string
          id?: string
          interest_rate?: number | null
          is_interested?: boolean | null
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          meta_fbc?: string | null
          meta_fbp?: string | null
          monthly_income: number
          phone: string
          pincode?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenure_months?: number | null
          transfer_reason?: string | null
          transferred_at?: string | null
          transferred_from?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          application_id?: string | null
          assigned_to?: string | null
          cibil_score_range?: string | null
          city?: string
          company_id?: string | null
          created_at?: string
          current_monthly_emi?: number | null
          email?: string
          emi_amount?: number | null
          emi_bounce_last_6_months?: boolean | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          follow_up_date?: string | null
          follow_up_notes?: string | null
          full_name?: string
          id?: string
          interest_rate?: number | null
          is_interested?: boolean | null
          loan_amount?: number
          loan_type?: Database["public"]["Enums"]["loan_type"]
          meta_fbc?: string | null
          meta_fbp?: string | null
          monthly_income?: number
          phone?: string
          pincode?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenure_months?: number | null
          transfer_reason?: string | null
          transferred_at?: string | null
          transferred_from?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          id: string
          leave_type_id: string
          pending_days: number
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          leave_type_id: string
          pending_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          leave_type_id?: string
          pending_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          color: string | null
          created_at: string
          days_per_year: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_paid: boolean | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          days_per_year?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          days_per_year?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          name?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instagram_account_id: string | null
          is_active: boolean | null
          page_access_token: string | null
          page_id: string
          page_name: string | null
          platform: Database["public"]["Enums"]["message_platform"]
          updated_at: string
          webhook_subscribed: boolean | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          page_access_token?: string | null
          page_id: string
          page_name?: string | null
          platform: Database["public"]["Enums"]["message_platform"]
          updated_at?: string
          webhook_subscribed?: boolean | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          page_access_token?: string | null
          page_id?: string
          page_name?: string | null
          platform?: Database["public"]["Enums"]["message_platform"]
          updated_at?: string
          webhook_subscribed?: boolean | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number | null
          created_at: string
          expires_at: string
          hashed_code: string | null
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          expires_at: string
          hashed_code?: string | null
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          expires_at?: string
          hashed_code?: string | null
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          collected_by: string | null
          company_id: string | null
          created_at: string
          gst_amount: number
          id: string
          lead_id: string
          payment_date: string | null
          payment_source: Database["public"]["Enums"]["payment_source"]
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          total_amount: number
        }
        Insert: {
          amount: number
          collected_by?: string | null
          company_id?: string | null
          created_at?: string
          gst_amount: number
          id?: string
          lead_id: string
          payment_date?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          total_amount: number
        }
        Update: {
          amount?: number
          collected_by?: string | null
          company_id?: string | null
          created_at?: string
          gst_amount?: number
          id?: string
          lead_id?: string
          payment_date?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          is_optional: boolean | null
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_optional?: boolean | null
          name: string
          year?: number
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_optional?: boolean | null
          name?: string
          year?: number
        }
        Relationships: []
      }
      remarketing_cycles: {
        Row: {
          company_id: string | null
          created_at: string
          end_date: string
          id: string
          last_sms_sent_at: string | null
          lead_id: string
          sms_sent_count: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          last_sms_sent_at?: string | null
          lead_id: string
          sms_sent_count?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          last_sms_sent_at?: string | null
          lead_id?: string
          sms_sent_count?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_cycles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      royalty_transactions: {
        Row: {
          collected_at: string | null
          company_id: string
          created_at: string
          due_date: string | null
          gst_amount: number
          id: string
          invoice_number: string | null
          lead_count: number
          lead_id: string | null
          month_year: string | null
          monthly_fee: number
          notes: string | null
          other_charges: number
          other_charges_description: string | null
          payment_id: string | null
          revenue_amount: number
          royalty_amount: number
          royalty_type: string
          sms_charges: number
          status: string
          total_amount: number
          updated_at: string
          whatsapp_charges: number
        }
        Insert: {
          collected_at?: string | null
          company_id: string
          created_at?: string
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_number?: string | null
          lead_count?: number
          lead_id?: string | null
          month_year?: string | null
          monthly_fee?: number
          notes?: string | null
          other_charges?: number
          other_charges_description?: string | null
          payment_id?: string | null
          revenue_amount?: number
          royalty_amount?: number
          royalty_type?: string
          sms_charges?: number
          status?: string
          total_amount?: number
          updated_at?: string
          whatsapp_charges?: number
        }
        Update: {
          collected_at?: string | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_number?: string | null
          lead_count?: number
          lead_id?: string | null
          month_year?: string | null
          monthly_fee?: number
          notes?: string | null
          other_charges?: number
          other_charges_description?: string | null
          payment_id?: string | null
          revenue_amount?: number
          royalty_amount?: number
          royalty_type?: string
          sms_charges?: number
          status?: string
          total_amount?: number
          updated_at?: string
          whatsapp_charges?: number
        }
        Relationships: [
          {
            foreignKeyName: "royalty_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "royalty_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "royalty_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_slips: {
        Row: {
          allowance_description: string | null
          approved_at: string | null
          approved_by: string | null
          attendance_salary: number | null
          base_salary: number | null
          bonus: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          days_absent: number | null
          days_present: number | null
          deduction_description: string | null
          deductions: number | null
          gross_salary: number | null
          id: string
          incentive_rate: number | null
          lead_incentive: number | null
          leads_count: number | null
          month: number
          net_salary: number | null
          notes: string | null
          other_allowances: number | null
          paid_at: string | null
          per_day_rate: number | null
          status: string | null
          total_hours_worked: number | null
          total_working_days: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          allowance_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_salary?: number | null
          base_salary?: number | null
          bonus?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_absent?: number | null
          days_present?: number | null
          deduction_description?: string | null
          deductions?: number | null
          gross_salary?: number | null
          id?: string
          incentive_rate?: number | null
          lead_incentive?: number | null
          leads_count?: number | null
          month: number
          net_salary?: number | null
          notes?: string | null
          other_allowances?: number | null
          paid_at?: string | null
          per_day_rate?: number | null
          status?: string | null
          total_hours_worked?: number | null
          total_working_days?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          allowance_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_salary?: number | null
          base_salary?: number | null
          bonus?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_absent?: number | null
          days_present?: number | null
          deduction_description?: string | null
          deductions?: number | null
          gross_salary?: number | null
          id?: string
          incentive_rate?: number | null
          lead_incentive?: number | null
          leads_count?: number | null
          month?: number
          net_salary?: number | null
          notes?: string | null
          other_allowances?: number | null
          paid_at?: string | null
          per_day_rate?: number | null
          status?: string | null
          total_hours_worked?: number | null
          total_working_days?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_slips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          company_id: string | null
          cost_credits: number | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          message: string
          phone: string
          provider: string | null
          provider_response: Json | null
          sent_at: string | null
          sms_type: string
          status: string
          template_id: string | null
        }
        Insert: {
          company_id?: string | null
          cost_credits?: number | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message: string
          phone: string
          provider?: string | null
          provider_response?: Json | null
          sent_at?: string | null
          sms_type: string
          status?: string
          template_id?: string | null
        }
        Update: {
          company_id?: string | null
          cost_credits?: number | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message?: string
          phone?: string
          provider?: string | null
          provider_response?: Json | null
          sent_at?: string | null
          sms_type?: string
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          user_id: string
          work_duration_minutes: number | null
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
          work_duration_minutes?: number | null
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
          work_duration_minutes?: number | null
        }
        Relationships: []
      }
      staff_module_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      unified_messages: {
        Row: {
          account_id: string | null
          attachment_url: string | null
          content: string
          created_at: string
          delivered_at: string | null
          direction: string
          external_id: string | null
          id: string
          is_read: boolean | null
          lead_id: string | null
          message_type: string | null
          metadata: Json | null
          page_id: string | null
          platform: Database["public"]["Enums"]["message_platform"]
          read_at: string | null
          sender_id: string
          sender_name: string | null
          sender_profile_pic: string | null
          status: string | null
        }
        Insert: {
          account_id?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          is_read?: boolean | null
          lead_id?: string | null
          message_type?: string | null
          metadata?: Json | null
          page_id?: string | null
          platform: Database["public"]["Enums"]["message_platform"]
          read_at?: string | null
          sender_id: string
          sender_name?: string | null
          sender_profile_pic?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          is_read?: boolean | null
          lead_id?: string | null
          message_type?: string | null
          metadata?: Json | null
          page_id?: string | null
          platform?: Database["public"]["Enums"]["message_platform"]
          read_at?: string | null
          sender_id?: string
          sender_name?: string | null
          sender_profile_pic?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_messages_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_accounts: {
        Row: {
          chatbot_enabled: boolean | null
          company_id: string | null
          connection_type: string
          created_at: string
          created_by: string | null
          id: string
          last_connected_at: string | null
          meta_access_token: string | null
          meta_business_id: string | null
          meta_phone_id: string | null
          name: string
          phone_number: string | null
          session_data: Json | null
          status: string
          updated_at: string
          verified_name: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          chatbot_enabled?: boolean | null
          company_id?: string | null
          connection_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_connected_at?: string | null
          meta_access_token?: string | null
          meta_business_id?: string | null
          meta_phone_id?: string | null
          name: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          verified_name?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          chatbot_enabled?: boolean | null
          company_id?: string | null
          connection_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_connected_at?: string | null
          meta_access_token?: string | null
          meta_business_id?: string | null
          meta_phone_id?: string | null
          name?: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          verified_name?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_api_logs: {
        Row: {
          account_id: string | null
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          request_data: Json | null
          response_data: Json | null
          status: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_api_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_auto_responses: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          response_message: string
          trigger_keyword: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          response_message: string
          trigger_keyword: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          response_message?: string
          trigger_keyword?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_auto_responses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          delivered_count: number | null
          executed_at: string | null
          id: string
          message_template: string
          name: string
          scheduled_at: string | null
          sent_count: number | null
          status: string
          target_date_from: string | null
          target_date_to: string | null
          target_status: string[] | null
          template_name: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          executed_at?: string | null
          id?: string
          message_template: string
          name: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_date_from?: string | null
          target_date_to?: string | null
          target_status?: string[] | null
          template_name?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          executed_at?: string | null
          id?: string
          message_template?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_date_from?: string | null
          target_date_to?: string | null
          target_status?: string[] | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_dnd: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          phone: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          phone: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          phone?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_dnd_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          account_id: string | null
          campaign_id: string | null
          contact_name: string | null
          content: string
          cost_credits: number | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_details: string | null
          error_message: string | null
          id: string
          is_starred: boolean | null
          last_retry_at: string | null
          lead_id: string | null
          media_mime_type: string | null
          media_url: string | null
          message_source: string | null
          message_type: string
          needs_agent: boolean | null
          phone_number: string
          read_at: string | null
          retry_count: number
          retry_eligible: boolean
          sent_at: string | null
          status: string | null
          wamid: string | null
        }
        Insert: {
          account_id?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          content: string
          cost_credits?: number | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_details?: string | null
          error_message?: string | null
          id?: string
          is_starred?: boolean | null
          last_retry_at?: string | null
          lead_id?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_source?: string | null
          message_type?: string
          needs_agent?: boolean | null
          phone_number: string
          read_at?: string | null
          retry_count?: number
          retry_eligible?: boolean
          sent_at?: string | null
          status?: string | null
          wamid?: string | null
        }
        Update: {
          account_id?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          content?: string
          cost_credits?: number | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_details?: string | null
          error_message?: string | null
          id?: string
          is_starred?: boolean | null
          last_retry_at?: string | null
          lead_id?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_source?: string | null
          message_type?: string
          needs_agent?: boolean | null
          phone_number?: string
          read_at?: string | null
          retry_count?: number
          retry_eligible?: boolean
          sent_at?: string | null
          status?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_scheduled_messages: {
        Row: {
          account_id: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          message: string | null
          metadata: Json | null
          phone_number: string
          scheduled_at: string
          sent_at: string | null
          sequence_number: number
          status: string
          template_id: string | null
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          metadata?: Json | null
          phone_number: string
          scheduled_at: string
          sent_at?: string | null
          sequence_number?: number
          status?: string
          template_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          metadata?: Json | null
          phone_number?: string
          scheduled_at?: string
          sent_at?: string | null
          sequence_number?: number
          status?: string
          template_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_scheduled_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          account_id: string | null
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          header_type: string | null
          header_url: string | null
          id: string
          is_active: boolean
          language: string | null
          meta_status: string | null
          meta_template_id: string | null
          meta_variables_count: number | null
          name: string
          stable_header_image_url: string | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          header_type?: string | null
          header_url?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          meta_status?: string | null
          meta_template_id?: string | null
          meta_variables_count?: number | null
          name: string
          stable_header_image_url?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          account_id?: string | null
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          header_type?: string | null
          header_url?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          meta_status?: string | null
          meta_template_id?: string | null
          meta_variables_count?: number | null
          name?: string
          stable_header_image_url?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_actions: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          id: string
          sequence_order: number | null
          workflow_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          id?: string
          sequence_order?: number | null
          workflow_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          id?: string
          sequence_order?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_actions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_logs: {
        Row: {
          actions_executed: Json | null
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          lead_id: string | null
          phone_number: string
          status: string | null
          trigger_type: string
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          actions_executed?: Json | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          lead_id?: string | null
          phone_number: string
          status?: string | null
          trigger_type: string
          workflow_id?: string | null
          workflow_name: string
        }
        Update: {
          actions_executed?: Json | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          lead_id?: string | null
          phone_number?: string
          status?: string | null
          trigger_type?: string
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflows: {
        Row: {
          account_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflows_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_logs: {
        Row: {
          actions_executed: Json | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          lead_id: string | null
          lead_name: string | null
          status: string
          trigger_type: string
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          actions_executed?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          status?: string
          trigger_type: string
          workflow_id?: string | null
          workflow_name: string
        }
        Update: {
          actions_executed?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          status?: string
          trigger_type?: string
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_scheduled_actions: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          lead_id: string
          node_id: string
          remaining_nodes: Json
          scheduled_at: string
          status: string
          workflow_id: string
          workflow_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id: string
          node_id: string
          remaining_nodes?: Json
          scheduled_at: string
          status?: string
          workflow_id: string
          workflow_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string
          node_id?: string
          remaining_nodes?: Json
          scheduled_at?: string
          status?: string
          workflow_id?: string
          workflow_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_scheduled_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          actions: Json
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_system_settings: {
        Row: {
          key: string | null
          value: string | null
        }
        Insert: {
          key?: string | null
          value?: string | null
        }
        Update: {
          key?: string | null
          value?: string | null
        }
        Relationships: []
      }
      royalty_monthly_summary: {
        Row: {
          collected: number | null
          company_id: string | null
          company_name: string | null
          earliest_due_date: string | null
          gst_amount: number | null
          id: string | null
          invoice_number: string | null
          last_transaction_at: string | null
          month_year: string | null
          monthly_fee: number | null
          other_charges: number | null
          other_charges_description: string | null
          pending: number | null
          revenue_amount: number | null
          sms_charges: number | null
          status: string | null
          total_amount: number | null
          total_royalty: number | null
          transaction_count: number | null
          whatsapp_charges: number | null
        }
        Relationships: [
          {
            foreignKeyName: "royalty_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_lead_score: { Args: { p_lead_id: string }; Returns: number }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      collect_royalties_bulk: {
        Args: { p_company_id: string; p_month_year: string }
        Returns: number
      }
      generate_invoice_number: {
        Args: { p_company_id?: string }
        Returns: string
      }
      generate_royalty_invoice_number: {
        Args: { p_company_id: string; p_month_year: string }
        Returns: string
      }
      get_agency_company_stats: {
        Args: never
        Returns: {
          collected_royalty: number
          company_id: string
          paid_leads: number
          pending_royalty: number
          total_leads: number
          total_revenue: number
        }[]
      }
      get_analytics_counts: {
        Args: { p_company_id?: string; p_end: string; p_start: string }
        Returns: {
          pageviews: number
          visitors: number
        }[]
      }
      get_company_whatsapp_account: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_franchise_owner_company: {
        Args: { _user_id: string }
        Returns: string
      }
      get_owned_companies: { Args: { _user_id: string }; Returns: string[] }
      get_sms_stats: {
        Args: { end_date?: string; p_company_id?: string; start_date?: string }
        Returns: {
          by_error: Json
          by_type: Json
          delivered_count: number
          delivered_segments: number
          failed_count: number
          pending_count: number
          rejected_count: number
          sent_count: number
          submitted_count: number
          total_cost: number
          total_count: number
          total_segments: number
        }[]
      }
      get_sms_stats_by_company: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          company_id: string
          delivered_count: number
          delivered_segments: number
          failed_count: number
          other_count: number
          otp_count: number
          pending_count: number
          remarketing_count: number
          total_sent_count: number
        }[]
      }
      get_uploaded_document_types: {
        Args: { _lead_id: string }
        Returns: {
          document_type: string
        }[]
      }
      get_user_companies: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_chat_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_franchise_owner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lead_exists: { Args: { _lead_id: string }; Returns: boolean }
      lookup_company_by_domain: {
        Args: { _domain: string }
        Returns: {
          custom_domain: string
          email: string
          google_analytics_id: string
          id: string
          logo_url: string
          meta_pixel_id: string
          name: string
          phone: string
          primary_color: string
          secondary_color: string
          slug: string
          website_url: string
          whatsapp_number: string
        }[]
      }
      lookup_lead_by_id: {
        Args: { _lead_id: string }
        Returns: {
          application_id: string
          city: string
          company_id: string
          created_at: string
          email: string
          emi_amount: number
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id: string
          interest_rate: number
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          phone: string
          pincode: string
          source: string
          state: string
          status: Database["public"]["Enums"]["lead_status"]
          tenure_months: number
        }[]
      }
      lookup_leads_by_phone: {
        Args: { _phone: string }
        Returns: {
          application_id: string
          city: string
          company_id: string
          created_at: string
          email: string
          emi_amount: number
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id: string
          interest_rate: number
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          phone: string
          pincode: string
          source: string
          state: string
          status: Database["public"]["Enums"]["lead_status"]
          tenure_months: number
        }[]
      }
      refresh_monthly_royalty_invoice: {
        Args: { p_company_id: string; p_month_year: string }
        Returns: undefined
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "telecaller"
        | "verification"
        | "login_team"
        | "manager"
        | "ads"
        | "finance"
        | "gst"
        | "franchise_owner"
      document_status: "pending" | "uploaded" | "verified" | "rejected"
      employment_type: "salaried" | "self_employed" | "business_owner"
      lead_status:
        | "unpaid"
        | "paid"
        | "verification"
        | "documents_pending"
        | "documents_uploaded"
        | "verified"
        | "rejected"
        | "processing"
        | "approved"
        | "disbursed"
        | "lost"
      loan_type:
        | "home"
        | "business"
        | "personal"
        | "education"
        | "vehicle"
        | "gold"
        | "marriage"
      message_platform: "whatsapp" | "facebook" | "instagram"
      payment_source:
        | "direct"
        | "telecaller"
        | "manual"
        | "marketing"
        | "whatsapp"
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
        "admin",
        "telecaller",
        "verification",
        "login_team",
        "manager",
        "ads",
        "finance",
        "gst",
        "franchise_owner",
      ],
      document_status: ["pending", "uploaded", "verified", "rejected"],
      employment_type: ["salaried", "self_employed", "business_owner"],
      lead_status: [
        "unpaid",
        "paid",
        "verification",
        "documents_pending",
        "documents_uploaded",
        "verified",
        "rejected",
        "processing",
        "approved",
        "disbursed",
        "lost",
      ],
      loan_type: [
        "home",
        "business",
        "personal",
        "education",
        "vehicle",
        "gold",
        "marriage",
      ],
      message_platform: ["whatsapp", "facebook", "instagram"],
      payment_source: [
        "direct",
        "telecaller",
        "manual",
        "marketing",
        "whatsapp",
      ],
    },
  },
} as const
