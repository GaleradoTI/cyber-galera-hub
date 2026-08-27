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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          description: string
          display_order: number
          icon_name: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      community_profiles: {
        Row: {
          community_role: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          professional_story: string | null
          profile_type: string
          role_title: string | null
          social_links: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          community_role?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          professional_story?: string | null
          profile_type: string
          role_title?: string | null
          social_links?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          community_role?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          professional_story?: string | null
          profile_type?: string
          role_title?: string | null
          social_links?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      drop_interests: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          amount_cents: number
          created_at: string
          delivery_method: string | null
          drop_id: string
          email: string
          full_name: string
          id: string
          linked_user_id: string | null
          note: string | null
          phone: string | null
          size: string | null
          status: string
          updated_at: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          amount_cents?: number
          created_at?: string
          delivery_method?: string | null
          drop_id: string
          email: string
          full_name: string
          id?: string
          linked_user_id?: string | null
          note?: string | null
          phone?: string | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          amount_cents?: number
          created_at?: string
          delivery_method?: string | null
          drop_id?: string
          email?: string
          full_name?: string
          id?: string
          linked_user_id?: string | null
          note?: string | null
          phone?: string | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_interests_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_interests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "drop_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_variants: {
        Row: {
          available_sizes: string[]
          created_at: string
          display_order: number
          drop_id: string
          id: string
          images: string[]
          is_active: boolean
          material: string | null
          name: string
          price_cents: number | null
          size_measurements: Json
          updated_at: string
        }
        Insert: {
          available_sizes?: string[]
          created_at?: string
          display_order?: number
          drop_id: string
          id?: string
          images?: string[]
          is_active?: boolean
          material?: string | null
          name: string
          price_cents?: number | null
          size_measurements?: Json
          updated_at?: string
        }
        Update: {
          available_sizes?: string[]
          created_at?: string
          display_order?: number
          drop_id?: string
          id?: string
          images?: string[]
          is_active?: boolean
          material?: string | null
          name?: string
          price_cents?: number | null
          size_measurements?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_variants_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          available_sizes: string[]
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          images: string[]
          launch_date: string | null
          material: string | null
          payment_methods: string[]
          pix_key: string | null
          price_cents: number
          product_category: string
          size_measurements: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          available_sizes?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          images?: string[]
          launch_date?: string | null
          material?: string | null
          payment_methods?: string[]
          pix_key?: string | null
          price_cents?: number
          product_category?: string
          size_measurements?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          available_sizes?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          images?: string[]
          launch_date?: string | null
          material?: string | null
          payment_methods?: string[]
          pix_key?: string | null
          price_cents?: number
          product_category?: string
          size_measurements?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_checkins: {
        Row: {
          checked_in_at: string
          event_id: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          event_id: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          event_id?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          content: string
          created_at: string
          event_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          content: string
          created_at?: string
          event_id: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist: {
        Row: {
          created_at: string
          event_id: string
          id: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          position: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string
          event_date: string
          event_time: string | null
          id: string
          location_or_link: string | null
          max_attendees: number | null
          modality: Database["public"]["Enums"]["event_modality"]
          name: string
          online_link: string | null
          source: string
          speakers: Json
          status: Database["public"]["Enums"]["content_status"]
          submitted_by: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          event_date: string
          event_time?: string | null
          id?: string
          location_or_link?: string | null
          max_attendees?: number | null
          modality: Database["public"]["Enums"]["event_modality"]
          name: string
          online_link?: string | null
          source?: string
          speakers?: Json
          status?: Database["public"]["Enums"]["content_status"]
          submitted_by?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string
          event_time?: string | null
          id?: string
          location_or_link?: string | null
          max_attendees?: number | null
          modality?: Database["public"]["Enums"]["event_modality"]
          name?: string
          online_link?: string | null
          source?: string
          speakers?: Json
          status?: Database["public"]["Enums"]["content_status"]
          submitted_by?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "member_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "member_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["finance_entry_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["finance_entry_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["finance_entry_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount_cents: number
          assigned_user_id: string | null
          attachment_url: string | null
          category_id: string | null
          counterparty_email: string | null
          counterparty_name: string | null
          counterparty_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          drop_interest_id: string | null
          entry_date: string
          id: string
          kind: Database["public"]["Enums"]["finance_entry_kind"]
          linked_user_id: string | null
          note: string | null
          payment_method: string | null
          status: string
          title: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          assigned_user_id?: string | null
          attachment_url?: string | null
          category_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          counterparty_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drop_interest_id?: string | null
          entry_date?: string
          id?: string
          kind: Database["public"]["Enums"]["finance_entry_kind"]
          linked_user_id?: string | null
          note?: string | null
          payment_method?: string | null
          status?: string
          title: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          assigned_user_id?: string | null
          attachment_url?: string | null
          category_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          counterparty_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drop_interest_id?: string | null
          entry_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["finance_entry_kind"]
          linked_user_id?: string | null
          note?: string | null
          payment_method?: string | null
          status?: string
          title?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "finance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "finance_entries_drop_interest_id_fkey"
            columns: ["drop_interest_id"]
            isOneToOne: true
            referencedRelation: "drop_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "finance_entries_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "finance_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entry_tags: {
        Row: {
          entry_id: string
          tag_id: string
        }
        Insert: {
          entry_id: string
          tag_id: string
        }
        Update: {
          entry_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "finance_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_url: string | null
          company: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          location: string | null
          modality: Database["public"]["Enums"]["work_modality"]
          send_to_bot: boolean | null
          seniority: Database["public"]["Enums"]["seniority_level"]
          short_description: string | null
          status: Database["public"]["Enums"]["content_status"]
          technologies: string[]
          title: string
          updated_at: string
        }
        Insert: {
          apply_url?: string | null
          company: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          location?: string | null
          modality: Database["public"]["Enums"]["work_modality"]
          send_to_bot?: boolean | null
          seniority: Database["public"]["Enums"]["seniority_level"]
          short_description?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          technologies?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          apply_url?: string | null
          company?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          location?: string | null
          modality?: Database["public"]["Enums"]["work_modality"]
          send_to_bot?: boolean | null
          seniority?: Database["public"]["Enums"]["seniority_level"]
          short_description?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          technologies?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lgpd_consents: {
        Row: {
          accepted_at: string
          consent_origin: string
          consent_status: boolean
          id: string
          ip_address: string | null
          privacy_policy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_origin?: string
          consent_status?: boolean
          id?: string
          ip_address?: string | null
          privacy_policy_version: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_origin?: string
          consent_status?: boolean
          id?: string
          ip_address?: string | null
          privacy_policy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      member_badges: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      member_feed_posts: {
        Row: {
          author_id: string
          content: string
          cover_url: string | null
          created_at: string
          id: string
          kind: string
          links: Json
          pinned_until: string | null
          reposted_from_id: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          cover_url?: string | null
          created_at?: string
          id?: string
          kind?: string
          links?: Json
          pinned_until?: string | null
          reposted_from_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          kind?: string
          links?: Json
          pinned_until?: string | null
          reposted_from_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_feed_posts_reposted_from_id_fkey"
            columns: ["reposted_from_id"]
            isOneToOne: false
            referencedRelation: "member_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
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
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          social_links: Json
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "project_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "project_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_cep_validated_at: string | null
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_postal_code: string | null
          address_region: string | null
          address_state: string | null
          address_street: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          email: string
          gender: string | null
          id: string
          is_blocked: boolean
          is_verified_recruiter: boolean
          looking_for_job: boolean
          newsletter_opt_in: boolean
          phone: string | null
          social_links: Json
          tech_tags: string[]
          updated_at: string
          user_id: string
          work_area: string | null
        }
        Insert: {
          address_cep_validated_at?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_state?: string | null
          address_street?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          email: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          is_verified_recruiter?: boolean
          looking_for_job?: boolean
          newsletter_opt_in?: boolean
          phone?: string | null
          social_links?: Json
          tech_tags?: string[]
          updated_at?: string
          user_id: string
          work_area?: string | null
        }
        Update: {
          address_cep_validated_at?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_state?: string | null
          address_street?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          email?: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          is_verified_recruiter?: boolean
          looking_for_job?: boolean
          newsletter_opt_in?: boolean
          phone?: string | null
          social_links?: Json
          tech_tags?: string[]
          updated_at?: string
          user_id?: string
          work_area?: string | null
        }
        Relationships: []
      }
      project_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          message: string | null
          project_id: string
          source: string
          squad_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message?: string | null
          project_id: string
          source?: string
          squad_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message?: string | null
          project_id?: string
          source?: string
          squad_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_join_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_join_requests_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      project_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_links: {
        Row: {
          created_at: string
          id: string
          note: string | null
          project_id: string
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          project_id: string
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          banner_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          slug: string
          status: string
          tech_stack: string[]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          slug: string
          status?: string
          tech_stack?: string[]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
          status?: string
          tech_stack?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      public_home_stats: {
        Row: {
          events_count: number
          id: boolean
          jobs_count: number
          members_count: number
          recruiters_count: number
          updated_at: string
        }
        Insert: {
          events_count?: number
          id?: boolean
          jobs_count?: number
          members_count?: number
          recruiters_count?: number
          updated_at?: string
        }
        Update: {
          events_count?: number
          id?: boolean
          jobs_count?: number
          members_count?: number
          recruiters_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      public_site_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings_history: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          setting_key: string
          setting_value: Json
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
        }
        Relationships: []
      }
      squad_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          location_or_link: string | null
          name: string
          squad_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          location_or_link?: string | null
          name: string
          squad_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location_or_link?: string | null
          name?: string
          squad_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      squad_goal_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          goal_id: string
          id: string
          note: string | null
          squad_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          goal_id: string
          id?: string
          note?: string | null
          squad_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          goal_id?: string
          id?: string
          note?: string | null
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_goal_completions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "squad_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_goal_completions_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          project_id: string
          squad_id: string | null
          tasks: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id: string
          squad_id?: string | null
          tasks?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id?: string
          squad_id?: string | null
          tasks?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_goals_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          created_at: string
          id: string
          role_in_squad: string
          squad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_in_squad?: string
          squad_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_in_squad?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          recruiting_status: Database["public"]["Enums"]["recruiting_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          recruiting_status?: Database["public"]["Enums"]["recruiting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          company: string | null
          content: string
          created_at: string
          id: string
          moderated_at: string | null
          moderator_id: string | null
          moderator_note: string | null
          rating: number
          role_title: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          content: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_note?: string | null
          rating: number
          role_title?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_note?: string | null
          rating?: number
          role_title?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          name: string
          note: string | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name: string
          note?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          note?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_event_interests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
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
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          is_verified_recruiter: boolean | null
          tech_tags: string[] | null
          user_id: string | null
          work_area: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          is_verified_recruiter?: boolean | null
          tech_tags?: string[] | null
          user_id?: string | null
          work_area?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          is_verified_recruiter?: boolean | null
          tech_tags?: string[] | null
          user_id?: string | null
          work_area?: string | null
        }
        Relationships: []
      }
      public_testimonials: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          author_work_area: string | null
          company: string | null
          content: string | null
          created_at: string | null
          id: string | null
          rating: number | null
          role_title: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _audit_actor_name: { Args: { _uid: string }; Returns: string }
      can_update_storage_object: {
        Args: { _bucket: string; _name: string; _owner?: string }
        Returns: boolean
      }
      can_upload_storage_object: {
        Args: { _bucket: string; _name: string }
        Returns: boolean
      }
      decide_join_request: {
        Args: { _action: string; _id: string; _note?: string }
        Returns: undefined
      }
      get_lgpd_consents_admin: {
        Args: never
        Returns: {
          accepted_at: string
          consent_origin: string
          consent_status: boolean
          id: string
          ip_address_masked: string
          privacy_policy_version: string
          terms_version: string
          user_id: string
        }[]
      }
      get_public_home_stats: { Args: never; Returns: Json }
      get_public_profile: { Args: { _user_id: string }; Returns: Json }
      get_recruiter_candidates: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          is_verified_recruiter: boolean
          looking_for_job: boolean
          tech_tags: string[]
          user_id: string
          work_area: string
        }[]
      }
      get_storage_upload_diagnostics: {
        Args: { _bucket: string; _prefix: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_project_leader: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_recruiter: { Args: { _user_id: string }; Returns: boolean }
      is_squad_leader: {
        Args: { _squad_id: string; _user_id: string }
        Returns: boolean
      }
      is_squad_member: {
        Args: { _squad_id: string; _user_id: string }
        Returns: boolean
      }
      log_cep_lookup: {
        Args: {
          _cep: string
          _http_status?: number
          _reason?: string
          _status: string
        }
        Returns: undefined
      }
      log_drop_image_upload_attempt: {
        Args: {
          _bucket: string
          _drop_id: string
          _file_name?: string
          _file_size?: number
          _file_type?: string
          _path: string
          _reason?: string
          _status: string
        }
        Returns: undefined
      }
      log_image_upload_attempt: {
        Args: {
          _bucket: string
          _context: string
          _file_name?: string
          _file_size?: number
          _file_type?: string
          _path: string
          _reason?: string
          _status: string
        }
        Returns: undefined
      }
      promote_user_to_super_admin: { Args: { _email: string }; Returns: string }
      recalculate_public_home_stats: { Args: never; Returns: undefined }
      register_event_interest: { Args: { _event_id: string }; Returns: Json }
      resolve_report: {
        Args: { _action: string; _note: string; _report_id: string }
        Returns: undefined
      }
      toggle_goal_task: {
        Args: { _done: boolean; _goal_id: string; _task_id: string }
        Returns: undefined
      }
      users_share_project: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "MEMBRO" | "RECRUTADOR" | "EMBAIXADOR"
      content_status: "rascunho" | "publicado" | "pausado" | "encerrado"
      event_modality: "online" | "presencial" | "hibrido"
      finance_entry_kind: "RECEITA" | "DESPESA" | "DOACAO"
      recruiting_status: "open" | "closed" | "waitlist"
      seniority_level:
        | "estagio"
        | "junior"
        | "pleno"
        | "senior"
        | "especialista"
      work_modality: "remoto" | "hibrido" | "presencial"
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
      app_role: ["SUPER_ADMIN", "ADMIN", "MEMBRO", "RECRUTADOR", "EMBAIXADOR"],
      content_status: ["rascunho", "publicado", "pausado", "encerrado"],
      event_modality: ["online", "presencial", "hibrido"],
      finance_entry_kind: ["RECEITA", "DESPESA", "DOACAO"],
      recruiting_status: ["open", "closed", "waitlist"],
      seniority_level: ["estagio", "junior", "pleno", "senior", "especialista"],
      work_modality: ["remoto", "hibrido", "presencial"],
    },
  },
} as const
