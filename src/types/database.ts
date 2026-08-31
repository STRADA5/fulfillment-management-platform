export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_ledger_entries: {
        Row: {
          amount: number
          client_organization_id: string | null
          created_at: string
          created_by_user_id: string | null
          credit_memo_id: string | null
          currency: string
          description: string
          direction: string
          entry_type: string
          id: number
          idempotency_key: string
          invoice_id: string | null
          organization_id: string
          payment_transaction_id: string | null
          source_event_id: string | null
          source_event_type: string | null
        }
        Insert: {
          amount: number
          client_organization_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          credit_memo_id?: string | null
          currency: string
          description: string
          direction: string
          entry_type: string
          id?: never
          idempotency_key: string
          invoice_id?: string | null
          organization_id: string
          payment_transaction_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
        }
        Update: {
          amount?: number
          client_organization_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          credit_memo_id?: string | null
          currency?: string
          description?: string
          direction?: string
          entry_type?: string
          id?: never
          idempotency_key?: string
          invoice_id?: string | null
          organization_id?: string
          payment_transaction_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_ledger_entries_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_entries_credit_memo_id_fkey"
            columns: ["credit_memo_id"]
            isOneToOne: false
            referencedRelation: "credit_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_entries_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          metadata: Json
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_address?: unknown
          metadata?: Json
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_configuration_events: {
        Row: {
          action: string
          actor_user_id: string | null
          configuration_id: string
          created_at: string
          id: number
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          configuration_id: string
          created_at?: string
          id?: never
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          configuration_id?: string
          created_at?: string
          id?: never
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_configuration_events_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "calculator_personal_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_configuration_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_personal_configurations: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          name: string
          organization_id: string
          owner_user_id: string
          plugin_version_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          name: string
          organization_id: string
          owner_user_id: string
          plugin_version_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          owner_user_id?: string
          plugin_version_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculator_personal_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_personal_configurations_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "calculator_plugin_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_plugin_source_links: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          library_item_id: string
          library_version_id: string
          organization_id: string
          plugin_version_id: string
          relationship_type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          library_item_id: string
          library_version_id: string
          organization_id: string
          plugin_version_id: string
          relationship_type: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          library_item_id?: string
          library_version_id?: string
          organization_id?: string
          plugin_version_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_plugin_source_links_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_plugin_source_links_library_version_id_fkey"
            columns: ["library_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_item_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_plugin_source_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_plugin_source_links_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "calculator_plugin_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_plugin_versions: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          checksum: string
          created_at: string
          created_by_user_id: string | null
          dosing_mode: string
          engine_reference: string
          id: string
          input_schema: Json
          manifest: Json
          organization_id: string
          output_schema: Json
          plugin_id: string
          published_at: string | null
          published_by_user_id: string | null
          status: string
          unit_schema: Json
          updated_at: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          checksum?: string
          created_at?: string
          created_by_user_id?: string | null
          dosing_mode?: string
          engine_reference?: string
          id?: string
          input_schema?: Json
          manifest?: Json
          organization_id: string
          output_schema?: Json
          plugin_id: string
          published_at?: string | null
          published_by_user_id?: string | null
          status?: string
          unit_schema?: Json
          updated_at?: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          checksum?: string
          created_at?: string
          created_by_user_id?: string | null
          dosing_mode?: string
          engine_reference?: string
          id?: string
          input_schema?: Json
          manifest?: Json
          organization_id?: string
          output_schema?: Json
          plugin_id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          status?: string
          unit_schema?: Json
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_plugin_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_plugin_versions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "calculator_plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_plugins: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string
          id: string
          name: string
          organization_id: string
          plugin_kind: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          name: string
          organization_id: string
          plugin_kind: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          name?: string
          organization_id?: string
          plugin_kind?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_plugins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_capability_assignments: {
        Row: {
          capability_code: string
          client_organization_id: string
          configuration: Json
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          capability_code: string
          client_organization_id: string
          configuration?: Json
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          capability_code?: string
          client_organization_id?: string
          configuration?: Json
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_capability_assignments_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "client_capability_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "client_capability_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_capability_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_capability_definitions: {
        Row: {
          code: string
          created_at: string
          description: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_capability_events: {
        Row: {
          action: string
          actor_user_id: string | null
          capability_assignment_id: string
          client_organization_id: string
          created_at: string
          details: Json
          id: number
          new_status: string | null
          old_status: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          capability_assignment_id: string
          client_organization_id: string
          created_at?: string
          details?: Json
          id?: never
          new_status?: string | null
          old_status?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          capability_assignment_id?: string
          client_organization_id?: string
          created_at?: string
          details?: Json
          id?: never
          new_status?: string | null
          old_status?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_capability_events_capability_assignment_id_fkey"
            columns: ["capability_assignment_id"]
            isOneToOne: false
            referencedRelation: "client_capability_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_capability_events_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_capability_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_catalog_connections: {
        Row: {
          client_organization_id: string
          created_at: string
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_catalog_connections_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_catalog_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_catalog_entries: {
        Row: {
          client_organization_id: string
          connection_id: string
          created_at: string
          ends_at: string | null
          id: string
          organization_id: string
          product_id: string
          public_description: string
          public_name: string
          starts_at: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          client_organization_id: string
          connection_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          organization_id: string
          product_id: string
          public_description?: string
          public_name: string
          starts_at?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          client_organization_id?: string
          connection_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          public_description?: string
          public_name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_catalog_entries_organization_id_client_organization_fkey"
            columns: [
              "organization_id",
              "client_organization_id",
              "connection_id",
            ]
            isOneToOne: false
            referencedRelation: "client_catalog_connections"
            referencedColumns: [
              "organization_id",
              "client_organization_id",
              "id",
            ]
          },
          {
            foreignKeyName: "client_catalog_entries_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_catalog_entries_organization_id_variant_id_fkey"
            columns: ["organization_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      client_pricing_tier_assignments: {
        Row: {
          assigned_by_user_id: string | null
          client_organization_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string
          pricing_tier_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assigned_by_user_id?: string | null
          client_organization_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id: string
          pricing_tier_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_by_user_id?: string | null
          client_organization_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string
          pricing_tier_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_tier_assignmen_organization_id_client_organ_fkey"
            columns: ["organization_id", "client_organization_id"]
            isOneToOne: false
            referencedRelation: "client_service_relationships"
            referencedColumns: ["organization_id", "client_organization_id"]
          },
          {
            foreignKeyName: "client_pricing_tier_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_tier_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_tier_assignments_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_ownership_relationships: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          fulfillment_mode: string
          id: string
          organization_id: string
          ownership_type: string
          product_id: string
          status: string
          updated_at: string
          variant_id: string | null
          version: number
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          fulfillment_mode?: string
          id?: string
          organization_id: string
          ownership_type: string
          product_id: string
          status?: string
          updated_at?: string
          variant_id?: string | null
          version?: number
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          fulfillment_mode?: string
          id?: string
          organization_id?: string
          ownership_type?: string
          product_id?: string
          status?: string
          updated_at?: string
          variant_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_product_ownership_relati_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_product_ownership_relati_organization_id_variant_id_fkey"
            columns: ["organization_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_product_ownership_relationsh_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_product_ownership_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referral_relationships: {
        Row: {
          affiliate_client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string
          referral_code: string
          referred_client_organization_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          affiliate_client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id: string
          referral_code?: string
          referred_client_organization_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          affiliate_client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string
          referral_code?: string
          referred_client_organization_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_referral_relationships_affiliate_client_organizatio_fkey"
            columns: ["affiliate_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referral_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referral_relationships_referred_client_organization_fkey"
            columns: ["referred_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_salesperson_assignments: {
        Row: {
          assigned_by_user_id: string | null
          client_organization_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string
          salesperson_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assigned_by_user_id?: string | null
          client_organization_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id: string
          salesperson_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_by_user_id?: string | null
          client_organization_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string
          salesperson_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_salesperson_assignment_organization_id_client_organ_fkey"
            columns: ["organization_id", "client_organization_id"]
            isOneToOne: false
            referencedRelation: "client_service_relationships"
            referencedColumns: ["organization_id", "client_organization_id"]
          },
          {
            foreignKeyName: "client_salesperson_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_salesperson_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_salesperson_assignments_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      client_selling_prices: {
        Row: {
          client_organization_id: string | null
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          maximum_quantity: number | null
          minimum_quantity: number
          organization_id: string
          price_kind: string
          product_id: string
          starts_at: string
          status: Database["public"]["Enums"]["catalog_status"]
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          client_organization_id?: string | null
          created_at?: string
          currency: string
          ends_at?: string | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number
          organization_id: string
          price_kind: string
          product_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          client_organization_id?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number
          organization_id?: string
          price_kind?: string
          product_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_selling_prices_organization_id_client_organization__fkey"
            columns: ["organization_id", "client_organization_id"]
            isOneToOne: false
            referencedRelation: "client_catalog_connections"
            referencedColumns: ["organization_id", "client_organization_id"]
          },
          {
            foreignKeyName: "client_selling_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_selling_prices_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "client_selling_prices_organization_id_variant_id_fkey"
            columns: ["organization_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      client_service_relationships: {
        Row: {
          client_organization_id: string
          created_at: string
          customer_access: string
          id: string
          order_access: string
          organization_id: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          version: number
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          customer_access?: string
          id?: string
          order_access?: string
          organization_id: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          customer_access?: string
          id?: string
          order_access?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_service_relationships_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_lifecycle_events: {
        Row: {
          action: string
          actor_user_id: string | null
          commission_snapshot_id: string
          created_at: string
          id: number
          metadata: Json
          new_status: string
          old_status: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          commission_snapshot_id: string
          created_at?: string
          id?: never
          metadata?: Json
          new_status: string
          old_status?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          commission_snapshot_id?: string
          created_at?: string
          id?: never
          metadata?: Json
          new_status?: string
          old_status?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_lifecycle_events_commission_snapshot_id_fkey"
            columns: ["commission_snapshot_id"]
            isOneToOne: false
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lifecycle_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payout_counters: {
        Row: {
          next_number: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          organization_id: string
        }
        Update: {
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payout_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payout_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          new_status: string
          old_status: string | null
          organization_id: string
          payout_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status: string
          old_status?: string | null
          organization_id: string
          payout_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status?: string
          old_status?: string | null
          organization_id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payout_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payout_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "commission_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payout_lines: {
        Row: {
          amount: number
          commission_snapshot_id: string
          created_at: string
          id: string
          payout_id: string
        }
        Insert: {
          amount: number
          commission_snapshot_id: string
          created_at?: string
          id?: string
          payout_id: string
        }
        Update: {
          amount?: number
          commission_snapshot_id?: string
          created_at?: string
          id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payout_lines_commission_snapshot_id_fkey"
            columns: ["commission_snapshot_id"]
            isOneToOne: true
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payout_lines_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "commission_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          currency: string
          external_reference: string
          id: string
          idempotency_key: string
          organization_id: string
          paid_at: string | null
          payout_number: string
          salesperson_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          external_reference?: string
          id?: string
          idempotency_key: string
          organization_id: string
          paid_at?: string | null
          payout_number: string
          salesperson_id: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          external_reference?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          paid_at?: string | null
          payout_number?: string
          salesperson_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          basis: string
          client_organization_id: string | null
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          organization_id: string
          priority: number
          rate: number
          rate_type: string
          salesperson_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          basis: string
          client_organization_id?: string | null
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          organization_id: string
          priority?: number
          rate: number
          rate_type: string
          salesperson_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          basis?: string
          client_organization_id?: string | null
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          organization_id?: string
          priority?: number
          rate?: number
          rate_type?: string
          salesperson_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_snapshots: {
        Row: {
          client_organization_id: string
          commission_amount: number
          commission_basis: string
          commission_rule_id: string | null
          created_at: string
          currency: string
          earned_at: string | null
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          paid_at: string | null
          payable_at: string | null
          quantity: number
          rate_snapshot: number
          rate_type: string
          rule_snapshot: Json
          sales_amount: number
          salesperson_id: string
          status: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          client_organization_id: string
          commission_amount: number
          commission_basis: string
          commission_rule_id?: string | null
          created_at?: string
          currency: string
          earned_at?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          paid_at?: string | null
          payable_at?: string | null
          quantity: number
          rate_snapshot: number
          rate_type: string
          rule_snapshot: Json
          sales_amount: number
          salesperson_id: string
          status?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          client_organization_id?: string
          commission_amount?: number
          commission_basis?: string
          commission_rule_id?: string | null
          created_at?: string
          currency?: string
          earned_at?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          paid_at?: string | null
          payable_at?: string | null
          quantity?: number
          rate_snapshot?: number
          rate_type?: string
          rule_snapshot?: Json
          sales_amount?: number
          salesperson_id?: string
          status?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshots_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "commission_snapshots_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memo_lines: {
        Row: {
          created_at: string
          credit_memo_id: string
          currency: string
          description: string
          id: string
          line_total: number
          organization_id: string
          quantity: number
          source_id: string | null
          source_type: string
          unit_amount: number
        }
        Insert: {
          created_at?: string
          credit_memo_id: string
          currency: string
          description: string
          id?: string
          line_total: number
          organization_id: string
          quantity?: number
          source_id?: string | null
          source_type: string
          unit_amount: number
        }
        Update: {
          created_at?: string
          credit_memo_id?: string
          currency?: string
          description?: string
          id?: string
          line_total?: number
          organization_id?: string
          quantity?: number
          source_id?: string | null
          source_type?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_memo_lines_credit_memo_id_fkey"
            columns: ["credit_memo_id"]
            isOneToOne: false
            referencedRelation: "credit_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memo_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memos: {
        Row: {
          amount: number
          applied_amount: number
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          credit_number: string
          currency: string
          id: string
          idempotency_key: string
          invoice_id: string
          order_id: string | null
          organization_id: string
          reason: string
          rma_id: string | null
          source_snapshot: Json
          status: string
        }
        Insert: {
          amount: number
          applied_amount?: number
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          credit_number: string
          currency: string
          id?: string
          idempotency_key: string
          invoice_id: string
          order_id?: string | null
          organization_id: string
          reason: string
          rma_id?: string | null
          source_snapshot?: Json
          status?: string
        }
        Update: {
          amount?: number
          applied_amount?: number
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          credit_number?: string
          currency?: string
          id?: string
          idempotency_key?: string
          invoice_id?: string
          order_id?: string | null
          organization_id?: string
          reason?: string
          rma_id?: string | null
          source_snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_memos_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_rma_id_fkey"
            columns: ["rma_id"]
            isOneToOne: false
            referencedRelation: "return_authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_address_revisions: {
        Row: {
          actor_user_id: string | null
          address_id: string
          created_at: string
          id: number
          organization_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          actor_user_id?: string | null
          address_id: string
          created_at?: string
          id?: never
          organization_id: string
          snapshot: Json
          version: number
        }
        Update: {
          actor_user_id?: string | null
          address_id?: string
          created_at?: string
          id?: never
          organization_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_address_revisions_organization_id_address_id_fkey"
            columns: ["organization_id", "address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          country_code: string
          created_at: string
          customer_id: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string
          line1: string
          line2: string
          organization_id: string
          postal_code: string
          recipient: string
          region: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          version: number
        }
        Insert: {
          city: string
          country_code: string
          created_at?: string
          customer_id: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label: string
          line1: string
          line2?: string
          organization_id: string
          postal_code?: string
          recipient: string
          region?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string
          line1?: string
          line2?: string
          organization_id?: string
          postal_code?: string
          recipient?: string
          region?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      customer_lifecycle_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: number
          new_status: string | null
          old_status: string | null
          organization_id: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          new_status?: string | null
          old_status?: string | null
          organization_id: string
          resource_id: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          new_status?: string | null
          old_status?: string | null
          organization_id?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          customer_number: string
          display_name: string
          email: string
          id: string
          organization_id: string
          phone: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          customer_number: string
          display_name: string
          email?: string
          id?: string
          organization_id: string
          phone?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          customer_number?: string
          display_name?: string
          email?: string
          id?: string
          organization_id?: string
          phone?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          alert_type: string
          audience: string
          client_organization_id: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          order_id: string | null
          organization_id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          shipment_id: string | null
          source_event_id: string | null
          source_event_type: string | null
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          alert_type: string
          audience?: string
          client_organization_id?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          order_id?: string | null
          organization_id: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity: string
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          alert_type?: string
          audience?: string
          client_organization_id?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          order_id?: string | null
          organization_id?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_alerts_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_alerts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_case_events: {
        Row: {
          actor_user_id: string | null
          after_state: Json
          before_state: Json
          created_at: string
          discrepancy_case_id: string
          event_type: string
          id: number
          organization_id: string
        }
        Insert: {
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          discrepancy_case_id: string
          event_type: string
          id?: never
          organization_id: string
        }
        Update: {
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          discrepancy_case_id?: string
          event_type?: string
          id?: never
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discrepancy_case_events_discrepancy_case_id_fkey"
            columns: ["discrepancy_case_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_case_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_cases: {
        Row: {
          assigned_to_user_id: string | null
          case_number: string
          case_type: string
          client_organization_id: string | null
          created_at: string
          created_by_user_id: string | null
          description: string
          id: string
          idempotency_key: string
          order_id: string | null
          organization_id: string
          resolution: string | null
          resolved_at: string | null
          severity: string
          shipment_id: string | null
          source_event_id: string | null
          source_event_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          case_number: string
          case_type: string
          client_organization_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          idempotency_key: string
          order_id?: string | null
          organization_id: string
          resolution?: string | null
          resolved_at?: string | null
          severity: string
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          case_number?: string
          case_type?: string
          client_organization_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          idempotency_key?: string
          order_id?: string | null
          organization_id?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discrepancy_cases_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_cases_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reconciliation_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          payment_transaction_id: string | null
          provider_code: string
          provider_event_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          payment_transaction_id?: string | null
          provider_code: string
          provider_event_id: string
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          payment_transaction_id?: string | null
          provider_code?: string
          provider_event_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reconciliation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reconciliation_events_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_operation_runs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          idempotency_key: string
          operation: string
          organization_id: string
          request_hash: string
          resource_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key: string
          operation: string
          organization_id: string
          request_hash: string
          resource_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key?: string
          operation?: string
          organization_id?: string
          request_hash?: string
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_operation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_shipments: {
        Row: {
          actual_arrival_at: string | null
          carrier: string | null
          created_at: string
          created_by: string
          expected_arrival_date: string | null
          id: string
          notes: string | null
          organization_id: string
          package_count: number | null
          purchase_order_id: string | null
          shipment_reference: string
          status: Database["public"]["Enums"]["inbound_shipment_status"]
          supplier_id: string
          tracking_number: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          actual_arrival_at?: string | null
          carrier?: string | null
          created_at?: string
          created_by: string
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          package_count?: number | null
          purchase_order_id?: string | null
          shipment_reference: string
          status?: Database["public"]["Enums"]["inbound_shipment_status"]
          supplier_id: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          actual_arrival_at?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          package_count?: number | null
          purchase_order_id?: string | null
          shipment_reference?: string
          status?: Database["public"]["Enums"]["inbound_shipment_status"]
          supplier_id?: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_shipments_organization_id_purchase_order_id_fkey"
            columns: ["organization_id", "purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inbound_shipments_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inbound_shipments_organization_id_warehouse_id_fkey"
            columns: ["organization_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          available_quantity: number
          damaged_quantity: number
          id: string
          location_id: string
          lot_id: string
          organization_id: string
          physical_quantity: number
          product_variant_id: string
          quarantined_quantity: number
          reserved_quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          available_quantity?: number
          damaged_quantity?: number
          id?: string
          location_id: string
          lot_id: string
          organization_id: string
          physical_quantity?: number
          product_variant_id: string
          quarantined_quantity?: number
          reserved_quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          available_quantity?: number
          damaged_quantity?: number
          id?: string
          location_id?: string
          lot_id?: string
          organization_id?: string
          physical_quantity?: number
          product_variant_id?: string
          quarantined_quantity?: number
          reserved_quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_product_variant_id_lot__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_product_variant_id_lot__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_warehouse_id_location_i_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
        ]
      }
      inventory_lot_sources: {
        Row: {
          created_at: string
          lot_id: string
          organization_id: string
          supplier_id: string | null
          supplier_product_variant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          lot_id: string
          organization_id: string
          supplier_id?: string | null
          supplier_product_variant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          lot_id?: string
          organization_id?: string
          supplier_id?: string | null
          supplier_product_variant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lot_sources_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_lot_sources_organization_id_supplier_product_var_fkey"
            columns: ["organization_id", "supplier_product_variant_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_variants"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          acquisition_reference: string | null
          bud_date: string | null
          created_at: string
          expiration_date: string | null
          id: string
          internal_notes: string | null
          lot_number: string
          manufactured_date: string | null
          manufacturer_lot: string | null
          organization_id: string
          ownership_relationship_id: string | null
          product_variant_id: string
          qc_controlled: boolean
          quantity_received: number
          received_date: string | null
          status: Database["public"]["Enums"]["lot_status"]
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          acquisition_reference?: string | null
          bud_date?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          internal_notes?: string | null
          lot_number: string
          manufactured_date?: string | null
          manufacturer_lot?: string | null
          organization_id: string
          ownership_relationship_id?: string | null
          product_variant_id: string
          qc_controlled?: boolean
          quantity_received?: number
          received_date?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          acquisition_reference?: string | null
          bud_date?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          internal_notes?: string | null
          lot_number?: string
          manufactured_date?: string | null
          manufacturer_lot?: string | null
          organization_id?: string
          ownership_relationship_id?: string | null
          product_variant_id?: string
          qc_controlled?: boolean
          quantity_received?: number
          received_date?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_organization_id_product_variant_id_fkey"
            columns: ["organization_id", "product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "inventory_lots_ownership_relationship_id_fkey"
            columns: ["ownership_relationship_id"]
            isOneToOne: false
            referencedRelation: "client_product_ownership_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          created_by_user_id: string
          fulfilled_at: string | null
          id: string
          location_id: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          released_at: string | null
          source_id: string
          source_type: string
          status: Database["public"]["Enums"]["reservation_status"]
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          fulfilled_at?: string | null
          id?: string
          location_id: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          released_at?: string | null
          source_id: string
          source_type: string
          status?: Database["public"]["Enums"]["reservation_status"]
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          fulfilled_at?: string | null
          id?: string
          location_id?: string
          lot_id?: string
          organization_id?: string
          product_variant_id?: string
          quantity?: number
          released_at?: string | null
          source_id?: string
          source_type?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_product_variant_id__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_product_variant_id__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_warehouse_id_locati_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          actor_user_id: string
          available_delta: number
          created_at: string
          damaged_delta: number
          id: number
          idempotency_key: string
          location_id: string
          lot_id: string
          metadata: Json
          organization_id: string
          physical_delta: number
          product_variant_id: string
          quarantined_delta: number
          reason: string | null
          reference_id: string
          reference_type: string
          reserved_delta: number
          sequence_number: number
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          warehouse_id: string
        }
        Insert: {
          actor_user_id: string
          available_delta?: number
          created_at?: string
          damaged_delta?: number
          id?: never
          idempotency_key: string
          location_id: string
          lot_id: string
          metadata?: Json
          organization_id: string
          physical_delta?: number
          product_variant_id: string
          quarantined_delta?: number
          reason?: string | null
          reference_id: string
          reference_type: string
          reserved_delta?: number
          sequence_number?: number
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          warehouse_id: string
        }
        Update: {
          actor_user_id?: string
          available_delta?: number
          created_at?: string
          damaged_delta?: number
          id?: never
          idempotency_key?: string
          location_id?: string
          lot_id?: string
          metadata?: Json
          organization_id?: string
          physical_delta?: number
          product_variant_id?: string
          quarantined_delta?: number
          reason?: string | null
          reference_id?: string
          reference_type?: string
          reserved_delta?: number
          sequence_number?: number
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_organization_id_product_variant_id__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_transactions_organization_id_product_variant_id__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_transactions_organization_id_warehouse_id_locati_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
        ]
      }
      invoice_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by_user_id: string | null
          currency: string
          id: string
          idempotency_key: string
          invoice_id: string
          organization_id: string
          reason: string
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          id?: string
          idempotency_key: string
          invoice_id: string
          organization_id: string
          reason: string
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          id?: string
          idempotency_key?: string
          invoice_id?: string
          organization_id?: string
          reason?: string
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          currency: string
          description: string
          id: string
          invoice_id: string
          line_number: number
          line_total: number
          organization_id: string
          package_id: string | null
          pricing_snapshot: Json
          product_id: string | null
          quantity: number
          shipment_id: string | null
          source_id: string | null
          source_type: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency: string
          description: string
          id?: string
          invoice_id: string
          line_number: number
          line_total: number
          organization_id: string
          package_id?: string | null
          pricing_snapshot: Json
          product_id?: string | null
          quantity?: number
          shipment_id?: string | null
          source_id?: string | null
          source_type: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          id?: string
          invoice_id?: string
          line_number?: number
          line_total?: number
          organization_id?: string
          package_id?: string | null
          pricing_snapshot?: Json
          product_id?: string | null
          quantity?: number
          shipment_id?: string | null
          source_id?: string | null
          source_type?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_counters: {
        Row: {
          fiscal_year: number
          next_number: number
          organization_id: string
        }
        Insert: {
          fiscal_year: number
          next_number?: number
          organization_id: string
        }
        Update: {
          fiscal_year?: number
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustment_total: number
          amount_paid: number
          amount_refunded: number
          balance_due: number | null
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          credits_applied: number
          currency: string
          due_at: string | null
          id: string
          idempotency_key: string
          immutable_at: string | null
          invoice_number: string
          issued_at: string | null
          order_id: string
          organization_id: string
          overpayment: number | null
          request_hash: string
          shipping_total: number
          source_snapshot: Json
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          adjustment_total?: number
          amount_paid?: number
          amount_refunded?: number
          balance_due?: number | null
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          credits_applied?: number
          currency: string
          due_at?: string | null
          id?: string
          idempotency_key: string
          immutable_at?: string | null
          invoice_number: string
          issued_at?: string | null
          order_id: string
          organization_id: string
          overpayment?: number | null
          request_hash: string
          shipping_total?: number
          source_snapshot: Json
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          adjustment_total?: number
          amount_paid?: number
          amount_refunded?: number
          balance_due?: number | null
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          credits_applied?: number
          currency?: string
          due_at?: string | null
          id?: string
          idempotency_key?: string
          immutable_at?: string | null
          invoice_number?: string
          issued_at?: string | null
          order_id?: string
          organization_id?: string
          overpayment?: number | null
          request_hash?: string
          shipping_total?: number
          source_snapshot?: Json
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_categories: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string
          display_order: number
          id: string
          name: string
          organization_id: string
          parent_category_id: string | null
          section_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          display_order?: number
          id?: string
          name: string
          organization_id: string
          parent_category_id?: string | null
          section_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          display_order?: number
          id?: string
          name?: string
          organization_id?: string
          parent_category_id?: string | null
          section_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_categories_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_delivery_events: {
        Row: {
          actor_user_id: string | null
          client_organization_id: string | null
          created_at: string
          delivery_mode: string
          id: number
          item_id: string
          organization_id: string
          version_id: string
        }
        Insert: {
          actor_user_id?: string | null
          client_organization_id?: string | null
          created_at?: string
          delivery_mode: string
          id?: never
          item_id: string
          organization_id: string
          version_id: string
        }
        Update: {
          actor_user_id?: string | null
          client_organization_id?: string | null
          created_at?: string
          delivery_mode?: string
          id?: never
          item_id?: string
          organization_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_delivery_events_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_delivery_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_delivery_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_delivery_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_item_tags: {
        Row: {
          created_at: string
          item_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_item_versions: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          body: string
          client_safe: boolean
          content_hash: string
          created_at: string
          created_by_user_id: string | null
          document_metadata: Json
          id: string
          item_id: string
          organization_id: string
          published_at: string | null
          published_by_user_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          source_metadata: Json
          status: string
          summary: string
          title: string
          updated_at: string
          version_number: number
          visibility: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          body?: string
          client_safe?: boolean
          content_hash?: string
          created_at?: string
          created_by_user_id?: string | null
          document_metadata?: Json
          id?: string
          item_id: string
          organization_id: string
          published_at?: string | null
          published_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_metadata?: Json
          status?: string
          summary?: string
          title: string
          updated_at?: string
          version_number: number
          visibility?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          body?: string
          client_safe?: boolean
          content_hash?: string
          created_at?: string
          created_by_user_id?: string | null
          document_metadata?: Json
          id?: string
          item_id?: string
          organization_id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_metadata?: Json
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          version_number?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_item_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_items: {
        Row: {
          category_id: string | null
          created_at: string
          created_by_user_id: string | null
          current_version_id: string | null
          id: string
          item_type: string
          organization_id: string
          section_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_version_id?: string | null
          id?: string
          item_type: string
          organization_id: string
          section_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_version_id?: string | null
          id?: string
          item_type?: string
          organization_id?: string
          section_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_items_current_version_fk"
            columns: ["organization_id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_item_versions"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "knowledge_library_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_sections: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          description: string
          display_order: number
          id: string
          name: string
          organization_id: string | null
          section_type: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          display_order?: number
          id?: string
          name: string
          organization_id?: string | null
          section_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          display_order?: number
          id?: string
          name?: string
          organization_id?: string | null
          section_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_share_grants: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          item_id: string
          organization_id: string
          status: string
          updated_at: string
          version_id: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          item_id: string
          organization_id: string
          status?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          item_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_share_grants_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_share_grants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_share_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_share_grants_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_tags: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_library_version_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          new_status: string
          old_status: string | null
          organization_id: string
          version_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status: string
          old_status?: string | null
          organization_id: string
          version_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status?: string
          old_status?: string | null
          organization_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_library_version_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_library_version_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_library_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_history: {
        Row: {
          attempt: number
          error_message: string | null
          event_type: string
          id: number
          notification_id: string
          observed_at: string
          organization_id: string
          source_event_id: string | null
          source_event_type: string | null
          status: string
        }
        Insert: {
          attempt: number
          error_message?: string | null
          event_type: string
          id?: never
          notification_id: string
          observed_at?: string
          organization_id: string
          source_event_id?: string | null
          source_event_type?: string | null
          status: string
        }
        Update: {
          attempt?: number
          error_message?: string | null
          event_type?: string
          id?: never
          notification_id?: string
          observed_at?: string
          organization_id?: string
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_event_history_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_event_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          audience: string
          available_at: string
          client_organization_id: string | null
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          last_error: string | null
          order_id: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          shipment_id: string | null
          source_event_id: string | null
          source_event_type: string | null
          status: string
          suppressed_at: string | null
        }
        Insert: {
          attempts?: number
          audience?: string
          available_at?: string
          client_organization_id?: string | null
          created_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          organization_id: string
          payload: Json
          processed_at?: string | null
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          suppressed_at?: string | null
        }
        Update: {
          attempts?: number
          audience?: string
          available_at?: string
          client_organization_id?: string | null
          created_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          shipment_id?: string | null
          source_event_id?: string | null
          source_event_type?: string | null
          status?: string
          suppressed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          event_type: string
          id: string
          in_app_enabled: boolean
          organization_id: string
          suppressed_until: string | null
          updated_at: string
          updated_by_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          in_app_enabled?: boolean
          organization_id: string
          suppressed_until?: string | null
          updated_at?: string
          updated_by_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          in_app_enabled?: boolean
          organization_id?: string
          suppressed_until?: string | null
          updated_at?: string
          updated_by_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addendum_events: {
        Row: {
          actor_user_id: string | null
          addendum_id: string
          created_at: string
          event_type: string
          id: number
          locked_shipment_exists: boolean
          order_id: string
          organization_id: string
          snapshot: Json
        }
        Insert: {
          actor_user_id?: string | null
          addendum_id: string
          created_at?: string
          event_type: string
          id?: never
          locked_shipment_exists?: boolean
          order_id: string
          organization_id: string
          snapshot?: Json
        }
        Update: {
          actor_user_id?: string | null
          addendum_id?: string
          created_at?: string
          event_type?: string
          id?: never
          locked_shipment_exists?: boolean
          order_id?: string
          organization_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_addendum_events_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "order_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendum_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendum_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addendum_lines: {
        Row: {
          addendum_id: string
          created_at: string
          entry_id: string
          id: string
          line_total: number
          organization_id: string
          pricing_snapshot: Json
          product_id: string
          quantity_delta: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          addendum_id: string
          created_at?: string
          entry_id: string
          id?: string
          line_total: number
          organization_id: string
          pricing_snapshot: Json
          product_id: string
          quantity_delta: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          addendum_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          line_total?: number
          organization_id?: string
          pricing_snapshot?: Json
          product_id?: string
          quantity_delta?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_addendum_lines_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "order_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendum_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "client_catalog_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendum_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addendums: {
        Row: {
          addendum_number: string
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          reason: string
          request_hash: string
          status: string
        }
        Insert: {
          addendum_number: string
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          reason?: string
          request_hash: string
          status?: string
        }
        Update: {
          addendum_number?: string
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          reason?: string
          request_hash?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addendums_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendums_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addendums_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_allocation_runs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          request_hash: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          request_hash: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          request_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_allocation_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_allocations: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          location_id: string
          lot_id: string
          order_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          released_at: string | null
          reservation_id: string | null
          source: string
          status: string
          warehouse_id: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          location_id: string
          lot_id: string
          order_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          released_at?: string | null
          reservation_id?: string | null
          source: string
          status?: string
          warehouse_id: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          location_id?: string
          lot_id?: string
          order_id?: string
          order_line_id?: string
          organization_id?: string
          product_variant_id?: string
          quantity?: number
          released_at?: string | null
          reservation_id?: string | null
          source?: string
          status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_allocations_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "order_allocations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_organization_id_product_variant_id_lot_i_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "order_allocations_organization_id_product_variant_id_lot_i_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "order_allocations_organization_id_warehouse_id_location_id_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
          {
            foreignKeyName: "order_allocations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_demands: {
        Row: {
          client_organization_id: string
          created_at: string
          demand_type: string
          expected_available_at: string | null
          id: string
          order_id: string
          order_line_id: string
          organization_id: string
          priority: number
          product_variant_id: string
          quantity_initial: number
          quantity_later_allocated: number
          quantity_remaining: number
          reasons: string
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          demand_type: string
          expected_available_at?: string | null
          id?: string
          order_id: string
          order_line_id: string
          organization_id: string
          priority?: number
          product_variant_id: string
          quantity_initial: number
          quantity_later_allocated?: number
          quantity_remaining: number
          reasons?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          demand_type?: string
          expected_available_at?: string | null
          id?: string
          order_id?: string
          order_line_id?: string
          organization_id?: string
          priority?: number
          product_variant_id?: string
          quantity_initial?: number
          quantity_later_allocated?: number
          quantity_remaining?: number
          reasons?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_demands_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "order_demands_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lifecycle_events: {
        Row: {
          action: string
          actor_user_id: string | null
          client_organization_id: string
          created_at: string
          id: number
          new_status: string | null
          old_status: string | null
          order_id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          client_organization_id: string
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          order_id: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          client_organization_id?: string
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          order_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lifecycle_events_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
        ]
      }
      order_lines: {
        Row: {
          allocated_quantity: number
          allocation_status: string
          client_organization_id: string
          created_at: string
          currency: string
          description: string
          display_name: string
          entry_id: string
          id: string
          line_status: string
          line_total: number
          minimum_shelf_life_days: number
          order_id: string
          organization_id: string
          pending_quantity: number | null
          pricing_snapshot: Json
          product_id: string
          quantity: number
          sku: string | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          allocated_quantity?: number
          allocation_status?: string
          client_organization_id: string
          created_at?: string
          currency: string
          description?: string
          display_name: string
          entry_id: string
          id?: string
          line_status?: string
          line_total: number
          minimum_shelf_life_days?: number
          order_id: string
          organization_id: string
          pending_quantity?: number | null
          pricing_snapshot: Json
          product_id: string
          quantity: number
          sku?: string | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          allocated_quantity?: number
          allocation_status?: string
          client_organization_id?: string
          created_at?: string
          currency?: string
          description?: string
          display_name?: string
          entry_id?: string
          id?: string
          line_status?: string
          line_total?: number
          minimum_shelf_life_days?: number
          order_id?: string
          organization_id?: string
          pending_quantity?: number | null
          pricing_snapshot?: Json
          product_id?: string
          quantity?: number
          sku?: string | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "order_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "client_catalog_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_counters: {
        Row: {
          next_number: number
          order_year: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          order_year: number
          organization_id: string
        }
        Update: {
          next_number?: number
          order_year?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_number_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_referral_attributions: {
        Row: {
          affiliate_client_organization_id: string
          attributed_at: string
          created_by_user_id: string | null
          id: string
          order_id: string
          organization_id: string
          referred_client_organization_id: string
          relationship_id: string | null
          relationship_snapshot: Json
        }
        Insert: {
          affiliate_client_organization_id: string
          attributed_at?: string
          created_by_user_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          referred_client_organization_id: string
          relationship_id?: string | null
          relationship_snapshot: Json
        }
        Update: {
          affiliate_client_organization_id?: string
          attributed_at?: string
          created_by_user_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          referred_client_organization_id?: string
          relationship_id?: string | null
          relationship_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_referral_attributions_affiliate_client_organization__fkey"
            columns: ["affiliate_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_referral_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_referral_attributions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_referral_attributions_referred_client_organization_i_fkey"
            columns: ["referred_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_referral_attributions_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "client_referral_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      order_salesperson_attributions: {
        Row: {
          assignment_id: string | null
          assignment_snapshot: Json
          attributed_at: string
          client_organization_id: string
          created_by_user_id: string | null
          id: string
          order_id: string
          organization_id: string
          salesperson_id: string
        }
        Insert: {
          assignment_id?: string | null
          assignment_snapshot: Json
          attributed_at?: string
          client_organization_id: string
          created_by_user_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          salesperson_id: string
        }
        Update: {
          assignment_id?: string | null
          assignment_snapshot?: Json
          attributed_at?: string
          client_organization_id?: string
          created_by_user_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          salesperson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_salesperson_attribution_client_organization_id_order_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "order_salesperson_attributions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "client_salesperson_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_salesperson_attributions_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_salesperson_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_salesperson_attributions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_salesperson_attributions_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      order_verifications: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          fulfillment_status: string
          id: string
          order_id: string
          organization_id: string
          shipment_sequence: number | null
          snapshot: Json
          verification_number: string
          verification_sequence: number
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          fulfillment_status?: string
          id?: string
          order_id: string
          organization_id: string
          shipment_sequence?: number | null
          snapshot: Json
          verification_number: string
          verification_sequence: number
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          fulfillment_status?: string
          id?: string
          order_id?: string
          organization_id?: string
          shipment_sequence?: number | null
          snapshot?: Json
          verification_number?: string
          verification_sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_verifications_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string
          address_snapshot: Json
          allocation_status: string
          client_organization_id: string
          client_snapshot: Json
          created_at: string
          currency: string
          customer_id: string
          customer_snapshot: Json
          id: string
          idempotency_key: string
          order_number: string
          organization_id: string
          request_hash: string
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string
          submitted_by_user_id: string
          subtotal: number
          total: number
          updated_at: string
          version: number
        }
        Insert: {
          address_id: string
          address_snapshot: Json
          allocation_status?: string
          client_organization_id: string
          client_snapshot: Json
          created_at?: string
          currency: string
          customer_id: string
          customer_snapshot: Json
          id?: string
          idempotency_key: string
          order_number: string
          organization_id: string
          request_hash: string
          status?: Database["public"]["Enums"]["order_status"]
          submitted_at: string
          submitted_by_user_id: string
          subtotal: number
          total: number
          updated_at?: string
          version?: number
        }
        Update: {
          address_id?: string
          address_snapshot?: Json
          allocation_status?: string
          client_organization_id?: string
          client_snapshot?: Json
          created_at?: string
          currency?: string
          customer_id?: string
          customer_snapshot?: Json
          id?: string
          idempotency_key?: string
          order_number?: string
          organization_id?: string
          request_hash?: string
          status?: Database["public"]["Enums"]["order_status"]
          submitted_at?: string
          submitted_by_user_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_organization_id_address_id_fkey"
            columns: ["client_organization_id", "address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "orders_client_organization_id_customer_id_fkey"
            columns: ["client_organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "orders_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          organization_id: string
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id: string
          role_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json
          branding: Json
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          parent_organization_id: string | null
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          address?: Json
          branding?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          address?: Json
          branding?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          parent_organization_id?: string | null
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          organization_id: string
          payment_transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          organization_id: string
          payment_transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          payment_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          amount_refunded: number
          captured_at: string | null
          client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          metadata: Json
          organization_id: string
          provider_code: string
          provider_transaction_id: string | null
          request_hash: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount: number
          amount_refunded?: number
          captured_at?: string | null
          client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          metadata?: Json
          organization_id: string
          provider_code: string
          provider_transaction_id?: string | null
          request_hash?: string | null
          status: string
          transaction_type: string
        }
        Update: {
          amount?: number
          amount_refunded?: number
          captured_at?: string | null
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          metadata?: Json
          organization_id?: string
          provider_code?: string
          provider_transaction_id?: string | null
          request_hash?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pick_list_lines: {
        Row: {
          allocation_id: string
          created_at: string
          id: string
          location_id: string
          lot_id: string
          order_line_id: string
          organization_id: string
          pick_list_id: string
          product_variant_id: string
          quantity_picked: number
          quantity_to_pick: number
          status: string
          warehouse_id: string
        }
        Insert: {
          allocation_id: string
          created_at?: string
          id?: string
          location_id: string
          lot_id: string
          order_line_id: string
          organization_id: string
          pick_list_id: string
          product_variant_id: string
          quantity_picked?: number
          quantity_to_pick: number
          status?: string
          warehouse_id: string
        }
        Update: {
          allocation_id?: string
          created_at?: string
          id?: string
          location_id?: string
          lot_id?: string
          order_line_id?: string
          organization_id?: string
          pick_list_id?: string
          product_variant_id?: string
          quantity_picked?: number
          quantity_to_pick?: number
          status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "pick_list_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "pick_list_lines_organization_id_warehouse_id_location_id_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
          {
            foreignKeyName: "pick_list_lines_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          id: string
          order_id: string
          organization_id: string
          status: string
          updated_at: string
          version: number
          warehouse_id: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          order_id: string
          organization_id: string
          status?: string
          updated_at?: string
          version?: number
          warehouse_id: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          order_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "pick_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_organization_id_warehouse_id_fkey"
            columns: ["organization_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      post_delivery_reconciliations: {
        Row: {
          client_organization_id: string
          created_at: string
          discrepancy_case_id: string | null
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          reconciled_by_user_id: string
          result: string
          shipment_id: string
          summary: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          reconciled_by_user_id: string
          result: string
          shipment_id: string
          summary?: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          reconciled_by_user_id?: string
          result?: string
          shipment_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_delivery_reconciliations_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_delivery_reconciliations_discrepancy_case_id_fkey"
            columns: ["discrepancy_case_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_delivery_reconciliations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_delivery_reconciliations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_delivery_reconciliations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tier_prices: {
        Row: {
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          maximum_quantity: number | null
          minimum_quantity: number
          organization_id: string
          pricing_tier_id: string
          product_id: string
          starts_at: string
          status: string
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency: string
          ends_at?: string | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number
          organization_id: string
          pricing_tier_id: string
          product_id: string
          starts_at?: string
          status?: string
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number
          organization_id?: string
          pricing_tier_id?: string
          product_id?: string
          starts_at?: string
          status?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tier_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_tier_prices_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "pricing_tier_prices_organization_id_variant_id_fkey"
            columns: ["organization_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "pricing_tier_prices_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_tier_prices_pricing_tier_id_fkey1"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          name: string
          organization_id: string
          priority: number
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          name: string
          organization_id: string
          priority?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          organization_id?: string
          priority?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["catalog_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          concentration: string | null
          created_at: string
          id: string
          organization_id: string
          package_size: number | null
          package_unit: string | null
          product_id: string
          sku: string
          status: Database["public"]["Enums"]["catalog_status"]
          strength_unit: string | null
          strength_value: number | null
          updated_at: string
          variant_name: string
          volume_unit: string | null
          volume_value: number | null
        }
        Insert: {
          barcode?: string | null
          concentration?: string | null
          created_at?: string
          id?: string
          organization_id: string
          package_size?: number | null
          package_unit?: string | null
          product_id: string
          sku: string
          status?: Database["public"]["Enums"]["catalog_status"]
          strength_unit?: string | null
          strength_value?: number | null
          updated_at?: string
          variant_name: string
          volume_unit?: string | null
          volume_value?: number | null
        }
        Update: {
          barcode?: string | null
          concentration?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          package_size?: number | null
          package_unit?: string | null
          product_id?: string
          sku?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          strength_unit?: string | null
          strength_value?: number | null
          updated_at?: string
          variant_name?: string
          volume_unit?: string | null
          volume_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          coa_tracking_applicable: boolean
          created_at: string
          default_unit_of_measure: string
          description: string | null
          expiration_tracking_required: boolean
          future_backorder_eligible: boolean
          id: string
          internal_notes: string | null
          lot_tracking_required: boolean
          organization_id: string
          product_name: string
          product_type: string
          search_name: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category_id: string
          coa_tracking_applicable?: boolean
          created_at?: string
          default_unit_of_measure: string
          description?: string | null
          expiration_tracking_required?: boolean
          future_backorder_eligible?: boolean
          id?: string
          internal_notes?: string | null
          lot_tracking_required?: boolean
          organization_id: string
          product_name: string
          product_type: string
          search_name: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          coa_tracking_applicable?: boolean
          created_at?: string
          default_unit_of_measure?: string
          description?: string | null
          expiration_tracking_required?: boolean
          future_backorder_eligible?: boolean
          id?: string
          internal_notes?: string | null
          lot_tracking_required?: boolean
          organization_id?: string
          product_name?: string
          product_type?: string
          search_name?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_category_id_fkey"
            columns: ["organization_id", "category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          currency: string
          expected_bud: string | null
          expected_delivery_date: string | null
          expected_expiration: string | null
          expected_lot: string | null
          id: string
          notes: string | null
          organization_id: string
          product_variant_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          status: Database["public"]["Enums"]["purchase_order_line_status"]
          supplier_product_variant_id: string
          supplier_sku: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          expected_bud?: string | null
          expected_delivery_date?: string | null
          expected_expiration?: string | null
          expected_lot?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_variant_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          status?: Database["public"]["Enums"]["purchase_order_line_status"]
          supplier_product_variant_id: string
          supplier_sku?: string | null
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          expected_bud?: string | null
          expected_delivery_date?: string | null
          expected_expiration?: string | null
          expected_lot?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_variant_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          status?: Database["public"]["Enums"]["purchase_order_line_status"]
          supplier_product_variant_id?: string
          supplier_sku?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_organization_id_product_variant_id_fkey"
            columns: ["organization_id", "product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_order_lines_organization_id_purchase_order_id_fkey"
            columns: ["organization_id", "purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_order_lines_organization_id_supplier_product_vari_fkey"
            columns: ["organization_id", "supplier_product_variant_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_variants"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          additional_cost: number
          created_at: string
          created_by: string
          currency: string
          expected_delivery_date: string | null
          expected_ship_date: string | null
          freight_cost: number
          id: string
          idempotency_key: string | null
          internal_notes: string | null
          order_date: string
          organization_id: string
          purchase_order_number: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number
          supplier_id: string
          supplier_reference: string | null
          updated_at: string
        }
        Insert: {
          additional_cost?: number
          created_at?: string
          created_by: string
          currency?: string
          expected_delivery_date?: string | null
          expected_ship_date?: string | null
          freight_cost?: number
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          order_date?: string
          organization_id: string
          purchase_order_number: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id: string
          supplier_reference?: string | null
          updated_at?: string
        }
        Update: {
          additional_cost?: number
          created_at?: string
          created_by?: string
          currency?: string
          expected_delivery_date?: string | null
          expected_ship_date?: string | null
          freight_cost?: number
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          order_date?: string
          organization_id?: string
          purchase_order_number?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string
          supplier_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      qc_hold_decisions: {
        Row: {
          actor_user_id: string
          approved_quantity: number
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          quarantine_transaction_id: number
          reason: string
          rejected_quantity: number
        }
        Insert: {
          actor_user_id: string
          approved_quantity: number
          created_at?: string
          id?: string
          idempotency_key: string
          organization_id: string
          quarantine_transaction_id: number
          reason: string
          rejected_quantity: number
        }
        Update: {
          actor_user_id?: string
          approved_quantity?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          quarantine_transaction_id?: number
          reason?: string
          rejected_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "qc_hold_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_hold_decisions_quarantine_transaction_id_fkey"
            columns: ["quarantine_transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_inspections: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          inbound_shipment_id: string | null
          inspected_at: string
          inspector_user_id: string
          lot_id: string
          notes: string | null
          organization_id: string
          quantity_approved: number
          quantity_inspected: number
          quantity_quarantined: number
          quantity_rejected: number
          reason_code: string | null
          receiving_id: string | null
          receiving_line_id: string | null
          status: Database["public"]["Enums"]["qc_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          inbound_shipment_id?: string | null
          inspected_at?: string
          inspector_user_id: string
          lot_id: string
          notes?: string | null
          organization_id: string
          quantity_approved?: number
          quantity_inspected: number
          quantity_quarantined?: number
          quantity_rejected?: number
          reason_code?: string | null
          receiving_id?: string | null
          receiving_line_id?: string | null
          status: Database["public"]["Enums"]["qc_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          inbound_shipment_id?: string | null
          inspected_at?: string
          inspector_user_id?: string
          lot_id?: string
          notes?: string | null
          organization_id?: string
          quantity_approved?: number
          quantity_inspected?: number
          quantity_quarantined?: number
          quantity_rejected?: number
          reason_code?: string | null
          receiving_id?: string | null
          receiving_line_id?: string | null
          status?: Database["public"]["Enums"]["qc_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspections_organization_id_inbound_shipment_id_fkey"
            columns: ["organization_id", "inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "qc_inspections_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "qc_inspections_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "qc_inspections_organization_id_receiving_id_fkey"
            columns: ["organization_id", "receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "qc_inspections_organization_id_receiving_line_id_fkey"
            columns: ["organization_id", "receiving_line_id"]
            isOneToOne: false
            referencedRelation: "receiving_lines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      qc_release_events: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          idempotency_key: string
          inspection_id: string
          location_id: string
          organization_id: string
          quantity: number
          warehouse_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          inspection_id: string
          location_id: string
          organization_id: string
          quantity: number
          warehouse_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          inspection_id?: string
          location_id?: string
          organization_id?: string
          quantity?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_release_events_organization_id_inspection_id_fkey"
            columns: ["organization_id", "inspection_id"]
            isOneToOne: false
            referencedRelation: "qc_inspections"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "qc_release_events_organization_id_warehouse_id_location_id_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
        ]
      }
      quality_documents: {
        Row: {
          created_at: string
          created_by: string
          document_name: string
          document_type: string
          id: string
          lot_id: string
          notes: string | null
          organization_id: string
          recorded_date: string
          report_reference: string | null
          status: Database["public"]["Enums"]["quality_document_status"]
          storage_reference: string | null
          test_date: string | null
          testing_laboratory: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_name: string
          document_type: string
          id?: string
          lot_id: string
          notes?: string | null
          organization_id: string
          recorded_date?: string
          report_reference?: string | null
          status?: Database["public"]["Enums"]["quality_document_status"]
          storage_reference?: string | null
          test_date?: string | null
          testing_laboratory?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_name?: string
          document_type?: string
          id?: string
          lot_id?: string
          notes?: string | null
          organization_id?: string
          recorded_date?: string
          report_reference?: string | null
          status?: Database["public"]["Enums"]["quality_document_status"]
          storage_reference?: string | null
          test_date?: string | null
          testing_laboratory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_documents_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "quality_documents_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      receiving_lines: {
        Row: {
          bud_date: string | null
          created_at: string
          destination_location_id: string
          discrepancy_quantity: number
          discrepancy_reason: string | null
          expiration_date: string | null
          id: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          purchase_order_line_id: string | null
          qc_required: boolean
          quantity_accepted: number
          quantity_damaged: number
          quantity_expected: number | null
          quantity_received: number
          quantity_rejected: number
          receiving_id: string
          status: Database["public"]["Enums"]["receiving_line_status"]
          updated_at: string
        }
        Insert: {
          bud_date?: string | null
          created_at?: string
          destination_location_id: string
          discrepancy_quantity?: number
          discrepancy_reason?: string | null
          expiration_date?: string | null
          id?: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          purchase_order_line_id?: string | null
          qc_required?: boolean
          quantity_accepted?: number
          quantity_damaged?: number
          quantity_expected?: number | null
          quantity_received: number
          quantity_rejected?: number
          receiving_id: string
          status?: Database["public"]["Enums"]["receiving_line_status"]
          updated_at?: string
        }
        Update: {
          bud_date?: string | null
          created_at?: string
          destination_location_id?: string
          discrepancy_quantity?: number
          discrepancy_reason?: string | null
          expiration_date?: string | null
          id?: string
          lot_id?: string
          organization_id?: string
          product_variant_id?: string
          purchase_order_line_id?: string | null
          qc_required?: boolean
          quantity_accepted?: number
          quantity_damaged?: number
          quantity_expected?: number | null
          quantity_received?: number
          quantity_rejected?: number
          receiving_id?: string
          status?: Database["public"]["Enums"]["receiving_line_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_lines_organization_id_destination_location_id_fkey"
            columns: ["organization_id", "destination_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receiving_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "receiving_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "receiving_lines_organization_id_purchase_order_line_id_fkey"
            columns: ["organization_id", "purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receiving_lines_organization_id_receiving_id_fkey"
            columns: ["organization_id", "receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      receivings: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          inbound_shipment_id: string | null
          notes: string | null
          organization_id: string
          purchase_order_id: string | null
          received_at: string
          received_by_user_id: string
          receiving_reference: string
          status: Database["public"]["Enums"]["receiving_status"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          inbound_shipment_id?: string | null
          notes?: string | null
          organization_id: string
          purchase_order_id?: string | null
          received_at: string
          received_by_user_id: string
          receiving_reference: string
          status?: Database["public"]["Enums"]["receiving_status"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          inbound_shipment_id?: string | null
          notes?: string | null
          organization_id?: string
          purchase_order_id?: string | null
          received_at?: string
          received_by_user_id?: string
          receiving_reference?: string
          status?: Database["public"]["Enums"]["receiving_status"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivings_organization_id_inbound_shipment_id_fkey"
            columns: ["organization_id", "inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receivings_organization_id_purchase_order_id_fkey"
            columns: ["organization_id", "purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receivings_organization_id_warehouse_id_fkey"
            columns: ["organization_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      recipient_discrepancy_acknowledgments: {
        Row: {
          acknowledged_by_user_id: string
          acknowledgment: string
          client_organization_id: string
          created_at: string
          discrepancy_case_id: string
          id: string
          idempotency_key: string
          note: string
          order_id: string
          organization_id: string
          shipment_id: string | null
        }
        Insert: {
          acknowledged_by_user_id: string
          acknowledgment?: string
          client_organization_id: string
          created_at?: string
          discrepancy_case_id: string
          id?: string
          idempotency_key: string
          note?: string
          order_id: string
          organization_id: string
          shipment_id?: string | null
        }
        Update: {
          acknowledged_by_user_id?: string
          acknowledgment?: string
          client_organization_id?: string
          created_at?: string
          discrepancy_case_id?: string
          id?: string
          idempotency_key?: string
          note?: string
          order_id?: string
          organization_id?: string
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipient_discrepancy_acknowledgmen_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_discrepancy_acknowledgments_discrepancy_case_id_fkey"
            columns: ["discrepancy_case_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_discrepancy_acknowledgments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_discrepancy_acknowledgments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipient_discrepancy_acknowledgments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commission_lifecycle_events: {
        Row: {
          action: string
          actor_user_id: string | null
          commission_snapshot_id: string
          created_at: string
          id: number
          metadata: Json
          new_status: string
          old_status: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          commission_snapshot_id: string
          created_at?: string
          id?: never
          metadata?: Json
          new_status: string
          old_status?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          commission_snapshot_id?: string
          created_at?: string
          id?: never
          metadata?: Json
          new_status?: string
          old_status?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commission_lifecycle_event_commission_snapshot_id_fkey"
            columns: ["commission_snapshot_id"]
            isOneToOne: false
            referencedRelation: "referral_commission_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_lifecycle_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commission_rules: {
        Row: {
          basis: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          organization_id: string
          priority: number
          rate: number
          rate_type: string
          relationship_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          basis: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          organization_id: string
          priority?: number
          rate: number
          rate_type: string
          relationship_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          basis?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          organization_id?: string
          priority?: number
          rate?: number
          rate_type?: string
          relationship_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_rules_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "client_referral_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commission_snapshots: {
        Row: {
          affiliate_client_organization_id: string
          basis: string
          commission_amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          organization_id: string
          rate_snapshot: number
          rate_type: string
          referred_client_organization_id: string
          relationship_id: string | null
          rule_id: string | null
          rule_snapshot: Json
          sales_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_client_organization_id: string
          basis: string
          commission_amount: number
          created_at?: string
          currency: string
          id?: string
          order_id: string
          organization_id: string
          rate_snapshot: number
          rate_type: string
          referred_client_organization_id: string
          relationship_id?: string | null
          rule_id?: string | null
          rule_snapshot: Json
          sales_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_client_organization_id?: string
          basis?: string
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          organization_id?: string
          rate_snapshot?: number
          rate_type?: string
          referred_client_organization_id?: string
          relationship_id?: string | null
          rule_id?: string | null
          rule_snapshot?: Json
          sales_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commission_snapshots_affiliate_client_organizatio_fkey"
            columns: ["affiliate_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_snapshots_referred_client_organization_fkey"
            columns: ["referred_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_snapshots_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "client_referral_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commission_snapshots_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "referral_commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payout_counters: {
        Row: {
          next_number: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          organization_id: string
        }
        Update: {
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_payout_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payout_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          new_status: string
          old_status: string | null
          organization_id: string
          payout_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status: string
          old_status?: string | null
          organization_id: string
          payout_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          new_status?: string
          old_status?: string | null
          organization_id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_payout_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payout_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "referral_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payout_lines: {
        Row: {
          amount: number
          commission_snapshot_id: string
          created_at: string
          id: string
          payout_id: string
        }
        Insert: {
          amount: number
          commission_snapshot_id: string
          created_at?: string
          id?: string
          payout_id: string
        }
        Update: {
          amount?: number
          commission_snapshot_id?: string
          created_at?: string
          id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_payout_lines_commission_snapshot_id_fkey"
            columns: ["commission_snapshot_id"]
            isOneToOne: true
            referencedRelation: "referral_commission_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payout_lines_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "referral_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payouts: {
        Row: {
          affiliate_client_organization_id: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          external_reference: string
          id: string
          idempotency_key: string
          organization_id: string
          paid_at: string | null
          payout_number: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          affiliate_client_organization_id: string
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          external_reference?: string
          id?: string
          idempotency_key: string
          organization_id: string
          paid_at?: string | null
          payout_number: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          affiliate_client_organization_id?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          external_reference?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          paid_at?: string | null
          payout_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_payouts_affiliate_client_organization_id_fkey"
            columns: ["affiliate_client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_request_lines: {
        Row: {
          created_at: string
          id: string
          location_id: string
          lot_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          replacement_request_id: string
          reservation_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          lot_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          replacement_request_id: string
          reservation_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          lot_id?: string
          order_line_id?: string
          organization_id?: string
          product_variant_id?: string
          quantity?: number
          replacement_request_id?: string
          reservation_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_request_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_replacement_request_id_fkey"
            columns: ["replacement_request_id"]
            isOneToOne: false
            referencedRelation: "replacement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_request_lines_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_requests: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          discrepancy_case_id: string | null
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          original_shipment_id: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          original_shipment_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          original_shipment_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_requests_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_discrepancy_case_id_fkey"
            columns: ["discrepancy_case_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_original_shipment_id_fkey"
            columns: ["original_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_shipments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          original_shipment_id: string | null
          replacement_request_id: string
          replacement_shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          original_shipment_id?: string | null
          replacement_request_id: string
          replacement_shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          original_shipment_id?: string | null
          replacement_request_id?: string
          replacement_shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shipments_original_shipment_id_fkey"
            columns: ["original_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shipments_replacement_request_id_fkey"
            columns: ["replacement_request_id"]
            isOneToOne: true
            referencedRelation: "replacement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_shipments_replacement_shipment_id_fkey"
            columns: ["replacement_shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      return_authorization_lines: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          quantity_dispositioned: number
          quantity_received: number
          quantity_requested: number
          return_authorization_id: string
          shipment_line_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          organization_id: string
          product_variant_id: string
          quantity_dispositioned?: number
          quantity_received?: number
          quantity_requested: number
          return_authorization_id: string
          shipment_line_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          organization_id?: string
          product_variant_id?: string
          quantity_dispositioned?: number
          quantity_received?: number
          quantity_requested?: number
          return_authorization_id?: string
          shipment_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_authorization_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorization_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorization_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorization_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorization_lines_return_authorization_id_fkey"
            columns: ["return_authorization_id"]
            isOneToOne: false
            referencedRelation: "return_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorization_lines_shipment_line_id_fkey"
            columns: ["shipment_line_id"]
            isOneToOne: false
            referencedRelation: "shipment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      return_authorizations: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          discrepancy_case_id: string | null
          id: string
          idempotency_key: string
          order_id: string
          organization_id: string
          original_shipment_id: string
          reason: string
          rma_number: string
          status: string
          updated_at: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          organization_id: string
          original_shipment_id: string
          reason?: string
          rma_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          discrepancy_case_id?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          organization_id?: string
          original_shipment_id?: string
          reason?: string
          rma_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_authorizations_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_discrepancy_case_id_fkey"
            columns: ["discrepancy_case_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_original_shipment_id_fkey"
            columns: ["original_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      return_dispositions: {
        Row: {
          created_at: string
          created_by_user_id: string
          disposition: string
          id: string
          idempotency_key: string
          lot_id: string
          organization_id: string
          quantity: number
          reason: string
          return_authorization_id: string
          return_authorization_line_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          disposition: string
          id?: string
          idempotency_key: string
          lot_id: string
          organization_id: string
          quantity: number
          reason?: string
          return_authorization_id: string
          return_authorization_line_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          disposition?: string
          id?: string
          idempotency_key?: string
          lot_id?: string
          organization_id?: string
          quantity?: number
          reason?: string
          return_authorization_id?: string
          return_authorization_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_dispositions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_dispositions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_dispositions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_dispositions_return_authorization_id_fkey"
            columns: ["return_authorization_id"]
            isOneToOne: false
            referencedRelation: "return_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_dispositions_return_authorization_line_id_fkey"
            columns: ["return_authorization_line_id"]
            isOneToOne: false
            referencedRelation: "return_authorization_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      return_receipt_lines: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          organization_id: string
          quantity: number
          return_authorization_line_id: string
          return_receipt_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          organization_id: string
          quantity: number
          return_authorization_line_id: string
          return_receipt_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          organization_id?: string
          quantity?: number
          return_authorization_line_id?: string
          return_receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_receipt_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipt_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipt_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipt_lines_return_authorization_line_id_fkey"
            columns: ["return_authorization_line_id"]
            isOneToOne: false
            referencedRelation: "return_authorization_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipt_lines_return_receipt_id_fkey"
            columns: ["return_receipt_id"]
            isOneToOne: false
            referencedRelation: "return_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      return_receipts: {
        Row: {
          id: string
          idempotency_key: string
          location_id: string
          notes: string
          organization_id: string
          received_at: string
          received_by_user_id: string
          return_authorization_id: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          location_id: string
          notes?: string
          organization_id: string
          received_at?: string
          received_by_user_id: string
          return_authorization_id: string
          warehouse_id: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          location_id?: string
          notes?: string
          organization_id?: string
          received_at?: string
          received_by_user_id?: string
          return_authorization_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipts_return_authorization_id_fkey"
            columns: ["return_authorization_id"]
            isOneToOne: true
            referencedRelation: "return_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      salespeople: {
        Row: {
          code: string
          created_at: string
          display_name: string
          email: string
          id: string
          organization_id: string
          status: string
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          email?: string
          id?: string
          organization_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_lines: {
        Row: {
          allocation_id: string
          created_at: string
          id: string
          location_id: string
          lot_id: string
          order_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          shipment_id: string
          warehouse_id: string
        }
        Insert: {
          allocation_id: string
          created_at?: string
          id?: string
          location_id: string
          lot_id: string
          order_id: string
          order_line_id: string
          organization_id: string
          product_variant_id: string
          quantity: number
          shipment_id: string
          warehouse_id: string
        }
        Update: {
          allocation_id?: string
          created_at?: string
          id?: string
          location_id?: string
          lot_id?: string
          order_id?: string
          order_line_id?: string
          organization_id?: string
          product_variant_id?: string
          quantity?: number
          shipment_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "order_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "shipment_lines_organization_id_product_variant_id_lot_id_fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "shipment_lines_organization_id_warehouse_id_location_id_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_package_contents: {
        Row: {
          created_at: string
          id: string
          package_id: string
          quantity: number
          shipment_line_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          quantity: number
          shipment_line_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          quantity?: number
          shipment_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_package_contents_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_package_contents_shipment_line_id_fkey"
            columns: ["shipment_line_id"]
            isOneToOne: false
            referencedRelation: "shipment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_packages: {
        Row: {
          created_at: string
          dimension_unit: string
          height: number | null
          id: string
          length: number | null
          organization_id: string
          package_sequence: number
          shipment_id: string
          shipping_locked_at: string | null
          status: string
          weight: number | null
          weight_unit: string
          width: number | null
        }
        Insert: {
          created_at?: string
          dimension_unit?: string
          height?: number | null
          id?: string
          length?: number | null
          organization_id: string
          package_sequence: number
          shipment_id: string
          shipping_locked_at?: string | null
          status?: string
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Update: {
          created_at?: string
          dimension_unit?: string
          height?: number | null
          id?: string
          length?: number | null
          organization_id?: string
          package_sequence?: number
          shipment_id?: string
          shipping_locked_at?: string | null
          status?: string
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_packages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_shipping_selections: {
        Row: {
          id: string
          organization_id: string
          package_id: string
          selected_at: string
          selected_by_user_id: string
          shipment_id: string
          shipping_service_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          package_id: string
          selected_at?: string
          selected_by_user_id: string
          shipment_id: string
          shipping_service_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          package_id?: string
          selected_at?: string
          selected_by_user_id?: string
          shipment_id?: string
          shipping_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_shipping_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_shipping_selections_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_shipping_selections_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_shipping_selections_shipping_service_id_fkey"
            columns: ["shipping_service_id"]
            isOneToOne: false
            referencedRelation: "shipping_services"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_verification_shipping_events: {
        Row: {
          actor_user_id: string | null
          carrier_code: string | null
          created_at: string
          estimated_delivery: string | null
          event_type: string
          id: number
          metadata: Json
          normalized_status: string | null
          organization_id: string
          service_code: string | null
          ship_date: string | null
          shipment_id: string
          shipment_verification_id: string
          tracking_number: string | null
        }
        Insert: {
          actor_user_id?: string | null
          carrier_code?: string | null
          created_at?: string
          estimated_delivery?: string | null
          event_type: string
          id?: never
          metadata?: Json
          normalized_status?: string | null
          organization_id: string
          service_code?: string | null
          ship_date?: string | null
          shipment_id: string
          shipment_verification_id: string
          tracking_number?: string | null
        }
        Update: {
          actor_user_id?: string | null
          carrier_code?: string | null
          created_at?: string
          estimated_delivery?: string | null
          event_type?: string
          id?: never
          metadata?: Json
          normalized_status?: string | null
          organization_id?: string
          service_code?: string | null
          ship_date?: string | null
          shipment_id?: string
          shipment_verification_id?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_verification_shipping_ev_shipment_verification_id_fkey"
            columns: ["shipment_verification_id"]
            isOneToOne: false
            referencedRelation: "shipment_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_verification_shipping_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_verification_shipping_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_verifications: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          fulfillment_status: string
          id: string
          order_id: string
          organization_id: string
          shipment_id: string
          shipment_sequence: number
          snapshot: Json
          verification_number: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          fulfillment_status: string
          id?: string
          order_id: string
          organization_id: string
          shipment_id: string
          shipment_sequence: number
          snapshot: Json
          verification_number: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          fulfillment_status?: string
          id?: string
          order_id?: string
          organization_id?: string
          shipment_id?: string
          shipment_sequence?: number
          snapshot?: Json
          verification_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_verifications_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "shipment_verifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          client_organization_id: string
          created_at: string
          created_by_user_id: string
          dispatched_at: string | null
          id: string
          locked_at: string | null
          order_id: string
          organization_id: string
          shipment_sequence: number
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          created_by_user_id: string
          dispatched_at?: string | null
          id?: string
          locked_at?: string | null
          order_id: string
          organization_id: string
          shipment_sequence: number
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          created_by_user_id?: string
          dispatched_at?: string | null
          id?: string
          locked_at?: string | null
          order_id?: string
          organization_id?: string
          shipment_sequence?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_organization_id_order_id_fkey"
            columns: ["client_organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["client_organization_id", "id"]
          },
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_charge_snapshots: {
        Row: {
          base_charge: number
          created_by_user_id: string
          currency: string
          effective_at: string
          fuel_surcharge: number
          handling_charge: number
          id: string
          immutable_at: string | null
          organization_id: string
          package_id: string
          quote_reference: string
          quoted_at: string
          shipment_id: string
          shipping_service_id: string
          total_charge: number | null
        }
        Insert: {
          base_charge: number
          created_by_user_id: string
          currency: string
          effective_at?: string
          fuel_surcharge?: number
          handling_charge?: number
          id?: string
          immutable_at?: string | null
          organization_id: string
          package_id: string
          quote_reference: string
          quoted_at?: string
          shipment_id: string
          shipping_service_id: string
          total_charge?: number | null
        }
        Update: {
          base_charge?: number
          created_by_user_id?: string
          currency?: string
          effective_at?: string
          fuel_surcharge?: number
          handling_charge?: number
          id?: string
          immutable_at?: string | null
          organization_id?: string
          package_id?: string
          quote_reference?: string
          quoted_at?: string
          shipment_id?: string
          shipping_service_id?: string
          total_charge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_charge_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_charge_snapshots_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_charge_snapshots_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_charge_snapshots_shipping_service_id_fkey"
            columns: ["shipping_service_id"]
            isOneToOne: false
            referencedRelation: "shipping_services"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_exceptions: {
        Row: {
          code: string
          created_by_user_id: string
          details: string
          id: string
          opened_at: string
          organization_id: string
          package_id: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          shipment_id: string
          status: string
        }
        Insert: {
          code: string
          created_by_user_id: string
          details?: string
          id?: string
          opened_at?: string
          organization_id: string
          package_id?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity: string
          shipment_id: string
          status?: string
        }
        Update: {
          code?: string
          created_by_user_id?: string
          details?: string
          id?: string
          opened_at?: string
          organization_id?: string
          package_id?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_exceptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_exceptions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          carrier_code: string
          created_at: string
          created_by_user_id: string
          id: string
          label_format: string
          label_reference: string | null
          label_status: string
          organization_id: string
          package_id: string
          provider_label_id: string
          service_code: string
          shipment_id: string
          tracking_number: string
          voided_at: string | null
        }
        Insert: {
          carrier_code: string
          created_at?: string
          created_by_user_id: string
          id?: string
          label_format?: string
          label_reference?: string | null
          label_status?: string
          organization_id: string
          package_id: string
          provider_label_id: string
          service_code: string
          shipment_id: string
          tracking_number: string
          voided_at?: string | null
        }
        Update: {
          carrier_code?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          label_format?: string
          label_reference?: string | null
          label_status?: string
          organization_id?: string
          package_id?: string
          provider_label_id?: string
          service_code?: string
          shipment_id?: string
          tracking_number?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_services: {
        Row: {
          carrier_code: string
          created_at: string
          enabled: boolean
          id: string
          service_code: string
          service_name: string
        }
        Insert: {
          carrier_code: string
          created_at?: string
          enabled?: boolean
          id?: string
          service_code: string
          service_name: string
        }
        Update: {
          carrier_code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          service_code?: string
          service_name?: string
        }
        Relationships: []
      }
      shipping_tracking_events: {
        Row: {
          carrier_status_code: string | null
          created_by_user_id: string | null
          event_hash: string
          id: string
          location: string | null
          message: string | null
          normalized_status: string
          occurred_at: string
          organization_id: string
          package_id: string
          provider_event_id: string
          raw_payload: Json
          received_at: string
          shipment_id: string
          shipping_label_id: string
          source: string
        }
        Insert: {
          carrier_status_code?: string | null
          created_by_user_id?: string | null
          event_hash: string
          id?: string
          location?: string | null
          message?: string | null
          normalized_status: string
          occurred_at: string
          organization_id: string
          package_id: string
          provider_event_id: string
          raw_payload?: Json
          received_at?: string
          shipment_id: string
          shipping_label_id: string
          source?: string
        }
        Update: {
          carrier_status_code?: string | null
          created_by_user_id?: string | null
          event_hash?: string
          id?: string
          location?: string | null
          message?: string | null
          normalized_status?: string
          occurred_at?: string
          organization_id?: string
          package_id?: string
          provider_event_id?: string
          raw_payload?: Json
          received_at?: string
          shipment_id?: string
          shipping_label_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_tracking_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_tracking_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "shipment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_tracking_events_shipping_label_id_fkey"
            columns: ["shipping_label_id"]
            isOneToOne: false
            referencedRelation: "shipping_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      split_order_letters: {
        Row: {
          addendum_id: string
          client_organization_id: string
          content: Json
          continuation_shipment_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          order_id: string
          organization_id: string
          version: number
        }
        Insert: {
          addendum_id: string
          client_organization_id: string
          content: Json
          continuation_shipment_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          version: number
        }
        Update: {
          addendum_id?: string
          client_organization_id?: string
          content?: Json
          continuation_shipment_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "split_order_letters_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "order_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_order_letters_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_order_letters_continuation_shipment_id_fkey"
            columns: ["continuation_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_order_letters_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_order_letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_issues: {
        Row: {
          created_at: string
          created_by: string
          credit_amount: number | null
          currency: string | null
          description: string
          id: string
          idempotency_key: string | null
          inbound_shipment_id: string | null
          internal_owner_user_id: string | null
          issue_type: string
          lot_id: string | null
          organization_id: string
          purchase_order_id: string | null
          quantity_affected: number | null
          receiving_id: string | null
          replacement_expected_date: string | null
          replacement_quantity: number | null
          resolution: string | null
          resolution_type:
            | Database["public"]["Enums"]["supplier_resolution_type"]
            | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["supplier_issue_severity"]
          status: Database["public"]["Enums"]["supplier_issue_status"]
          supplier_id: string
          supplier_notified_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          credit_amount?: number | null
          currency?: string | null
          description: string
          id?: string
          idempotency_key?: string | null
          inbound_shipment_id?: string | null
          internal_owner_user_id?: string | null
          issue_type: string
          lot_id?: string | null
          organization_id: string
          purchase_order_id?: string | null
          quantity_affected?: number | null
          receiving_id?: string | null
          replacement_expected_date?: string | null
          replacement_quantity?: number | null
          resolution?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["supplier_resolution_type"]
            | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["supplier_issue_severity"]
          status?: Database["public"]["Enums"]["supplier_issue_status"]
          supplier_id: string
          supplier_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          credit_amount?: number | null
          currency?: string | null
          description?: string
          id?: string
          idempotency_key?: string | null
          inbound_shipment_id?: string | null
          internal_owner_user_id?: string | null
          issue_type?: string
          lot_id?: string | null
          organization_id?: string
          purchase_order_id?: string | null
          quantity_affected?: number | null
          receiving_id?: string | null
          replacement_expected_date?: string | null
          replacement_quantity?: number | null
          resolution?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["supplier_resolution_type"]
            | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["supplier_issue_severity"]
          status?: Database["public"]["Enums"]["supplier_issue_status"]
          supplier_id?: string
          supplier_notified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_issues_organization_id_inbound_shipment_id_fkey"
            columns: ["organization_id", "inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_issues_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_issues_organization_id_lot_id_fkey"
            columns: ["organization_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_issues_organization_id_purchase_order_id_fkey"
            columns: ["organization_id", "purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_issues_organization_id_receiving_id_fkey"
            columns: ["organization_id", "receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_issues_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      supplier_product_variant_costs: {
        Row: {
          created_at: string
          currency: string
          organization_id: string
          relationship_id: string
          supplier_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          organization_id: string
          relationship_id: string
          supplier_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          organization_id?: string
          relationship_id?: string
          supplier_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_variant_cost_organization_id_relationship_fkey"
            columns: ["organization_id", "relationship_id"]
            isOneToOne: false
            referencedRelation: "supplier_product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_product_variant_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_variant_costs_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: true
            referencedRelation: "supplier_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_variants: {
        Row: {
          created_at: string
          id: string
          is_preferred: boolean
          minimum_order_quantity: number | null
          organization_id: string
          product_variant_id: string
          status: Database["public"]["Enums"]["catalog_status"]
          supplier_id: string
          supplier_sku: string | null
          typical_lead_time_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          minimum_order_quantity?: number | null
          organization_id: string
          product_variant_id: string
          status?: Database["public"]["Enums"]["catalog_status"]
          supplier_id: string
          supplier_sku?: string | null
          typical_lead_time_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          minimum_order_quantity?: number | null
          organization_id?: string
          product_variant_id?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          supplier_id?: string
          supplier_sku?: string | null
          typical_lead_time_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_variants_organization_id_product_variant__fkey"
            columns: ["organization_id", "product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "supplier_product_variants_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          internal_notes: string | null
          lead_time_days: number | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          region: string | null
          status: Database["public"]["Enums"]["catalog_status"]
          supplier_code: string
          supplier_name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          lead_time_days?: number | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          supplier_code: string
          supplier_name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          lead_time_days?: number | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["catalog_status"]
          supplier_code?: string
          supplier_name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_number_counters: {
        Row: {
          next_number: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          organization_id: string
        }
        Update: {
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_number_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          internal_notes: string | null
          location_code: string
          location_name: string
          location_type: string
          organization_id: string
          status: Database["public"]["Enums"]["inventory_record_status"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          location_code: string
          location_name: string
          location_type: string
          organization_id: string
          status?: Database["public"]["Enums"]["inventory_record_status"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          location_code?: string
          location_name?: string
          location_type?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["inventory_record_status"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_organization_id_warehouse_id_fkey"
            columns: ["organization_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      warehouse_verification_events: {
        Row: {
          actor_user_id: string
          created_at: string
          id: number
          notes: string
          organization_id: string
          shipment_id: string
          status: string
          warehouse_verification_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: never
          notes?: string
          organization_id: string
          shipment_id: string
          status: string
          warehouse_verification_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: never
          notes?: string
          organization_id?: string
          shipment_id?: string
          status?: string
          warehouse_verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_verification_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_verification_events_warehouse_verification_id_fkey"
            columns: ["warehouse_verification_id"]
            isOneToOne: false
            referencedRelation: "warehouse_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_verifications: {
        Row: {
          created_at: string
          expected_quantity: number
          id: string
          notes: string
          organization_id: string
          shipment_id: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by_user_id: string | null
          verified_quantity: number
          version: number
        }
        Insert: {
          created_at?: string
          expected_quantity?: number
          id?: string
          notes?: string
          organization_id: string
          shipment_id: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
          verified_quantity?: number
          version?: number
        }
        Update: {
          created_at?: string
          expected_quantity?: number
          id?: string
          notes?: string
          organization_id?: string
          shipment_id?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
          verified_quantity?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_verifications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string
          created_at: string
          id: string
          internal_notes: string | null
          organization_id: string
          postal_code: string | null
          region: string | null
          status: Database["public"]["Enums"]["warehouse_status"]
          timezone: string
          updated_at: string
          warehouse_code: string
          warehouse_name: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          organization_id: string
          postal_code?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["warehouse_status"]
          timezone?: string
          updated_at?: string
          warehouse_code: string
          warehouse_name: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          organization_id?: string
          postal_code?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["warehouse_status"]
          timezone?: string
          updated_at?: string
          warehouse_code?: string
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_availability: {
        Row: {
          available_quantity: number | null
          damaged_quantity: number | null
          eligible_available_quantity: number | null
          expired_quantity: number | null
          id: string | null
          location_id: string | null
          lot_id: string | null
          organization_id: string | null
          physical_quantity: number | null
          product_variant_id: string | null
          quarantined_quantity: number | null
          reserved_quantity: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_product_variant_id_lot__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_product_variant_id_lot__fkey"
            columns: ["organization_id", "product_variant_id", "lot_id"]
            isOneToOne: false
            referencedRelation: "lot_eligibility_queue"
            referencedColumns: ["organization_id", "product_variant_id", "id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_warehouse_id_location_i_fkey"
            columns: ["organization_id", "warehouse_id", "location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["organization_id", "warehouse_id", "id"]
          },
        ]
      }
      lot_eligibility_queue: {
        Row: {
          bud_date: string | null
          eligibility_date: string | null
          expiration_date: string | null
          id: string | null
          lot_number: string | null
          organization_id: string | null
          product_variant_id: string | null
          status: Database["public"]["Enums"]["lot_status"] | null
        }
        Insert: {
          bud_date?: string | null
          eligibility_date?: never
          expiration_date?: string | null
          id?: string | null
          lot_number?: string | null
          organization_id?: string | null
          product_variant_id?: string | null
          status?: Database["public"]["Enums"]["lot_status"] | null
        }
        Update: {
          bud_date?: string | null
          eligibility_date?: never
          expiration_date?: string | null
          id?: string | null
          lot_number?: string | null
          organization_id?: string | null
          product_variant_id?: string | null
          status?: Database["public"]["Enums"]["lot_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_organization_id_product_variant_id_fkey"
            columns: ["organization_id", "product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      procurement_work_queue: {
        Row: {
          due_date: string | null
          id: string | null
          label: string | null
          organization_id: string | null
          queue_type: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_my_organization_invitations: { Args: never; Returns: number }
      acknowledge_discrepancy_case: {
        Args: {
          target_acknowledgment: string
          target_case_id: string
          target_idempotency_key: string
          target_note: string
        }
        Returns: string
      }
      admin_adjust_inventory: {
        Args: {
          target_idempotency_key: string
          target_location_id: string
          target_lot_id: string
          target_organization_id: string
          target_quantity_delta: number
          target_reason: string
          target_warehouse_id: string
        }
        Returns: number
      }
      admin_allocate_order: {
        Args: {
          target_demand_type: string
          target_expected_available_at: string
          target_idempotency_key: string
          target_order_id: string
          target_reason: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_assign_client_pricing_tier: {
        Args: {
          target_client_id: string
          target_effective_from?: string
          target_pricing_tier_id: string
          target_provider_id: string
        }
        Returns: string
      }
      admin_assign_client_salesperson: {
        Args: {
          target_client_id: string
          target_effective_from?: string
          target_provider_id: string
          target_salesperson_id: string
        }
        Returns: string
      }
      admin_assign_inventory_lot_ownership: {
        Args: {
          target_lot_id: string
          target_provider_id: string
          target_relationship_id: string
        }
        Returns: string
      }
      admin_assign_shipment_allocation: {
        Args: {
          target_allocation_id: string
          target_idempotency_key: string
          target_shipment_id: string
        }
        Returns: string
      }
      admin_cancel_order_allocations: {
        Args: { target_idempotency_key: string; target_order_id: string }
        Returns: string
      }
      admin_cancel_planned_shipment: {
        Args: { target_idempotency_key: string; target_shipment_id: string }
        Returns: string
      }
      admin_confirm_pick_line: {
        Args: {
          target_idempotency_key: string
          target_pick_line_id: string
          target_pick_list_id: string
          target_quantity: number
        }
        Returns: string
      }
      admin_create_commission_payout: {
        Args: {
          target_commission_ids: Json
          target_currency: string
          target_external_reference: string
          target_idempotency_key: string
          target_provider_id: string
          target_salesperson_id: string
        }
        Returns: string
      }
      admin_create_pick_list: {
        Args: {
          target_idempotency_key: string
          target_order_id: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_create_referral_payout: {
        Args: {
          target_affiliate_client_id: string
          target_commission_ids: Json
          target_currency: string
          target_external_reference: string
          target_idempotency_key: string
          target_provider_id: string
        }
        Returns: string
      }
      admin_create_shipment: {
        Args: { target_idempotency_key: string; target_order_id: string }
        Returns: string
      }
      admin_create_shipment_package: {
        Args: {
          target_idempotency_key: string
          target_shipment_id: string
          target_weight: number
          target_weight_unit: string
        }
        Returns: string
      }
      admin_create_test_shipping_labels: {
        Args: {
          target_idempotency_key: string
          target_organization_id: string
          target_shipment_id: string
        }
        Returns: Json
      }
      admin_dispatch_shipment: {
        Args: { target_idempotency_key: string; target_shipment_id: string }
        Returns: string
      }
      admin_ingest_tracking_event: {
        Args: {
          target_idempotency_key: string
          target_message: string
          target_normalized_status: string
          target_occurred_at: string
          target_organization_id: string
          target_package_id: string
          target_provider_event_id: string
        }
        Returns: string
      }
      admin_invite_organization_member: {
        Args: {
          target_organization_id: string
          target_role_id: string
          target_user_id: string
        }
        Returns: string
      }
      admin_link_calculator_source: {
        Args: {
          target_library_item_id: string
          target_library_version_id: string
          target_plugin_version_id: string
          target_provider_id: string
          target_relationship_type: string
        }
        Returns: string
      }
      admin_lock_shipment: {
        Args: { target_idempotency_key: string; target_shipment_id: string }
        Returns: string
      }
      admin_mark_inventory_damaged: {
        Args: {
          target_idempotency_key: string
          target_location_id: string
          target_lot_id: string
          target_organization_id: string
          target_quantity: number
          target_reason: string
          target_warehouse_id: string
        }
        Returns: number
      }
      admin_onboard_client_with_salesperson: {
        Args: {
          target_client_id: string
          target_email: string
          target_name: string
          target_phone: string
          target_pricing_tier_id?: string
          target_provider_id: string
          target_salesperson_id: string
          target_slug: string
          target_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: string
      }
      admin_process_inventory_expiration: {
        Args: { target_organization_id: string }
        Returns: number
      }
      admin_process_order_demands: {
        Args: {
          target_idempotency_key: string
          target_organization_id: string
          target_variant_id: string
        }
        Returns: number
      }
      admin_quote_shipment_shipping: {
        Args: {
          target_currency: string
          target_idempotency_key: string
          target_organization_id: string
          target_shipment_id: string
        }
        Returns: string
      }
      admin_receive_inventory: {
        Args: {
          target_discrepancy_reason: string
          target_expected: number
          target_idempotency_key: string
          target_location_id: string
          target_lot_id: string
          target_organization_id: string
          target_quantity: number
          target_reference: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_receive_purchase_order: {
        Args: {
          target_accepted: number
          target_bud: string
          target_damaged: number
          target_expiration: string
          target_idempotency_key: string
          target_inbound_shipment_id: string
          target_location_id: string
          target_lot_number: string
          target_organization_id: string
          target_purchase_order_line_id: string
          target_qc_required: boolean
          target_quantity: number
          target_reason: string
          target_reference: string
          target_rejected: number
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_record_qc_inspection: {
        Args: {
          target_approved: number
          target_idempotency_key: string
          target_inspected: number
          target_location_id: string
          target_lot_id: string
          target_notes: string
          target_organization_id: string
          target_quarantined: number
          target_reason_code: string
          target_receiving_line_id: string
          target_rejected: number
          target_status: Database["public"]["Enums"]["qc_status"]
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_release_inventory_reservation: {
        Args: {
          target_idempotency_key: string
          target_organization_id: string
          target_reservation_id: string
        }
        Returns: number
      }
      admin_release_qc_inventory: {
        Args: {
          target_idempotency_key: string
          target_location_id: string
          target_organization_id: string
          target_qc_inspection_id: string
          target_quantity: number
          target_warehouse_id: string
        }
        Returns: number
      }
      admin_remove_organization_membership: {
        Args: { target_membership_id: string }
        Returns: undefined
      }
      admin_reserve_inventory: {
        Args: {
          target_idempotency_key: string
          target_location_id: string
          target_lot_id: string
          target_organization_id: string
          target_quantity: number
          target_source_id: string
          target_source_type: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_resolve_inventory_hold: {
        Args: {
          target_approved: number
          target_idempotency_key: string
          target_organization_id: string
          target_quarantine_transaction_id: number
          target_reason: string
          target_rejected: number
        }
        Returns: string
      }
      admin_save_calculator_plugin: {
        Args: {
          target_description: string
          target_id: string
          target_name: string
          target_plugin_kind: string
          target_provider_id: string
          target_slug: string
          target_status: string
        }
        Returns: string
      }
      admin_save_calculator_version: {
        Args: {
          target_checksum: string
          target_dosing_mode: string
          target_engine_reference: string
          target_id: string
          target_input_schema: Json
          target_manifest: Json
          target_output_schema: Json
          target_plugin_id: string
          target_provider_id: string
          target_unit_schema: Json
          target_version: string
        }
        Returns: string
      }
      admin_save_client_account: {
        Args: {
          parent_id: string
          target_email: string
          target_id: string
          target_name: string
          target_phone: string
          target_slug: string
          target_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: string
      }
      admin_save_client_capability: {
        Args: {
          target_capability_code: string
          target_client_id: string
          target_configuration: Json
          target_effective_from: string
          target_effective_to: string
          target_expected_version?: number
          target_id: string
          target_provider_id: string
          target_status: string
        }
        Returns: string
      }
      admin_save_client_catalog_connection: {
        Args: {
          target_client_organization_id: string
          target_organization_id: string
          target_status: Database["public"]["Enums"]["catalog_status"]
        }
        Returns: string
      }
      admin_save_client_catalog_entry: {
        Args: {
          target_client_organization_id: string
          target_description: string
          target_ends_at: string
          target_id: string
          target_name: string
          target_organization_id: string
          target_product_id: string
          target_starts_at: string
          target_status: Database["public"]["Enums"]["catalog_status"]
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_client_product_ownership: {
        Args: {
          target_client_id: string
          target_effective_from: string
          target_effective_to: string
          target_expected_version?: number
          target_fulfillment_mode: string
          target_id: string
          target_ownership_type: string
          target_product_id: string
          target_provider_id: string
          target_status: string
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_client_referral_relationship: {
        Args: {
          target_affiliate_client_id: string
          target_effective_from: string
          target_effective_to: string
          target_expected_version?: number
          target_id: string
          target_provider_id: string
          target_referral_code: string
          target_referred_client_id: string
          target_status: string
        }
        Returns: string
      }
      admin_save_client_selling_price: {
        Args: {
          target_client_organization_id: string
          target_currency: string
          target_ends_at: string
          target_id: string
          target_kind: string
          target_maximum: number
          target_minimum: number
          target_organization_id: string
          target_price: number
          target_product_id: string
          target_starts_at: string
          target_status: Database["public"]["Enums"]["catalog_status"]
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_client_service: {
        Args: {
          client_id: string
          expected_version: number
          provider_id: string
          target_access: string
          target_id: string
          target_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: string
      }
      admin_save_commission_rule: {
        Args: {
          target_basis: string
          target_client_id: string
          target_currency: string
          target_effective_from: string
          target_effective_to: string
          target_expected_version?: number
          target_id: string
          target_name: string
          target_priority: number
          target_provider_id: string
          target_rate: number
          target_rate_type: string
          target_salesperson_id: string
          target_status: string
        }
        Returns: string
      }
      admin_save_customer: {
        Args: {
          client_id: string
          expected_version: number
          target_email: string
          target_id: string
          target_name: string
          target_number: string
          target_phone: string
          target_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: string
      }
      admin_save_customer_address: {
        Args: {
          billing_default: boolean
          client_id: string
          expected_version: number
          shipping_default: boolean
          target_address: Json
          target_customer_id: string
          target_id: string
          target_status: Database["public"]["Enums"]["organization_status"]
        }
        Returns: string
      }
      admin_save_inbound_shipment: {
        Args: {
          target_actual: string
          target_carrier: string
          target_expected: string
          target_id: string
          target_notes: string
          target_organization_id: string
          target_packages: number
          target_purchase_order_id: string
          target_reference: string
          target_status: Database["public"]["Enums"]["inbound_shipment_status"]
          target_supplier_id: string
          target_tracking: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_save_inventory_lot: {
        Args: {
          target_bud: string
          target_expiration: string
          target_id: string
          target_lot_number: string
          target_manufactured: string
          target_manufacturer_lot: string
          target_notes: string
          target_organization_id: string
          target_received: string
          target_status: Database["public"]["Enums"]["lot_status"]
          target_supplier_id: string
          target_supplier_relationship_id: string
          target_uom: string
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_library_category: {
        Args: {
          target_description: string
          target_display_order: number
          target_expected_version?: number
          target_id: string
          target_name: string
          target_organization_id: string
          target_parent_category_id: string
          target_section_id: string
          target_slug: string
          target_status: string
        }
        Returns: string
      }
      admin_save_library_item: {
        Args: {
          target_body: string
          target_category_id: string
          target_client_safe: boolean
          target_document_metadata: Json
          target_expected_version?: number
          target_id: string
          target_item_type: string
          target_organization_id: string
          target_section_id: string
          target_slug: string
          target_source_metadata: Json
          target_summary: string
          target_title: string
          target_visibility: string
        }
        Returns: string
      }
      admin_save_library_section: {
        Args: {
          target_code: string
          target_description: string
          target_display_order: number
          target_expected_version?: number
          target_id: string
          target_name: string
          target_organization_id: string
          target_section_type: string
          target_status: string
        }
        Returns: string
      }
      admin_save_library_tag: {
        Args: {
          target_id: string
          target_name: string
          target_organization_id: string
          target_slug: string
        }
        Returns: string
      }
      admin_save_order_service_access: {
        Args: {
          target_access: string
          target_expected_version: number
          target_service_id: string
        }
        Returns: string
      }
      admin_save_pricing_tier: {
        Args: {
          target_code: string
          target_description: string
          target_expected_version?: number
          target_id: string
          target_name: string
          target_priority: number
          target_provider_id: string
          target_status: string
        }
        Returns: string
      }
      admin_save_pricing_tier_price: {
        Args: {
          target_currency: string
          target_ends_at: string
          target_id: string
          target_maximum_quantity: number
          target_minimum_quantity: number
          target_pricing_tier_id: string
          target_product_id: string
          target_provider_id: string
          target_starts_at: string
          target_status: string
          target_unit_price: number
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_product: {
        Args: {
          target_backorder: boolean
          target_category_id: string
          target_coa: boolean
          target_description: string
          target_expiration: boolean
          target_id: string
          target_lot: boolean
          target_name: string
          target_notes: string
          target_organization_id: string
          target_status: Database["public"]["Enums"]["product_status"]
          target_type: string
          target_uom: string
        }
        Returns: string
      }
      admin_save_product_category: {
        Args: {
          target_description: string
          target_display_order: number
          target_id: string
          target_name: string
          target_organization_id: string
          target_slug: string
          target_status: Database["public"]["Enums"]["catalog_status"]
        }
        Returns: string
      }
      admin_save_product_variant: {
        Args: {
          target_barcode: string
          target_concentration: string
          target_id: string
          target_name: string
          target_organization_id: string
          target_package_size: number
          target_package_unit: string
          target_product_id: string
          target_sku: string
          target_status: Database["public"]["Enums"]["catalog_status"]
          target_strength: number
          target_strength_unit: string
          target_volume: number
          target_volume_unit: string
        }
        Returns: string
      }
      admin_save_purchase_order: {
        Args: {
          target_additional: number
          target_currency: string
          target_expected_delivery: string
          target_expected_ship: string
          target_freight: number
          target_id: string
          target_idempotency_key: string
          target_notes: string
          target_number: string
          target_order_date: string
          target_organization_id: string
          target_status: Database["public"]["Enums"]["purchase_order_status"]
          target_subtotal: number
          target_supplier_id: string
          target_supplier_reference: string
        }
        Returns: string
      }
      admin_save_purchase_order_line: {
        Args: {
          target_currency: string
          target_expected_bud: string
          target_expected_delivery: string
          target_expected_expiration: string
          target_expected_lot: string
          target_id: string
          target_notes: string
          target_organization_id: string
          target_purchase_order_id: string
          target_quantity: number
          target_supplier_product_variant_id: string
          target_unit_cost: number
        }
        Returns: string
      }
      admin_save_quality_document: {
        Args: {
          target_id: string
          target_laboratory: string
          target_lot_id: string
          target_name: string
          target_notes: string
          target_organization_id: string
          target_report: string
          target_status: Database["public"]["Enums"]["quality_document_status"]
          target_storage_reference: string
          target_test_date: string
          target_type: string
        }
        Returns: string
      }
      admin_save_referral_commission_rule: {
        Args: {
          target_basis: string
          target_currency: string
          target_effective_from: string
          target_effective_to: string
          target_expected_version?: number
          target_id: string
          target_name: string
          target_priority: number
          target_provider_id: string
          target_rate: number
          target_rate_type: string
          target_relationship_id: string
          target_status: string
        }
        Returns: string
      }
      admin_save_salesperson: {
        Args: {
          target_code: string
          target_email: string
          target_expected_version?: number
          target_id: string
          target_name: string
          target_provider_id: string
          target_status: string
          target_user_id: string
        }
        Returns: string
      }
      admin_save_supplier: {
        Args: {
          target_address1: string
          target_address2: string
          target_city: string
          target_code: string
          target_contact: string
          target_country: string
          target_email: string
          target_id: string
          target_lead: number
          target_name: string
          target_notes: string
          target_organization_id: string
          target_phone: string
          target_postal: string
          target_region: string
          target_status: Database["public"]["Enums"]["catalog_status"]
          target_website: string
        }
        Returns: string
      }
      admin_save_supplier_issue: {
        Args: {
          target_credit_amount: number
          target_currency: string
          target_description: string
          target_id: string
          target_idempotency_key: string
          target_inbound_shipment_id: string
          target_issue_type: string
          target_lot_id: string
          target_organization_id: string
          target_owner: string
          target_purchase_order_id: string
          target_quantity: number
          target_receiving_id: string
          target_replacement_expected: string
          target_replacement_quantity: number
          target_resolution: string
          target_resolution_type: Database["public"]["Enums"]["supplier_resolution_type"]
          target_severity: Database["public"]["Enums"]["supplier_issue_severity"]
          target_status: Database["public"]["Enums"]["supplier_issue_status"]
          target_supplier_id: string
          target_supplier_notified: string
        }
        Returns: string
      }
      admin_save_supplier_product: {
        Args: {
          target_cost: number
          target_currency: string
          target_id: string
          target_lead: number
          target_moq: number
          target_organization_id: string
          target_preferred: boolean
          target_status: Database["public"]["Enums"]["catalog_status"]
          target_supplier_id: string
          target_supplier_sku: string
          target_variant_id: string
        }
        Returns: string
      }
      admin_save_warehouse: {
        Args: {
          target_city: string
          target_code: string
          target_country: string
          target_id: string
          target_name: string
          target_notes: string
          target_organization_id: string
          target_postal: string
          target_region: string
          target_status: Database["public"]["Enums"]["warehouse_status"]
          target_timezone: string
        }
        Returns: string
      }
      admin_save_warehouse_location: {
        Args: {
          target_code: string
          target_description: string
          target_id: string
          target_name: string
          target_notes: string
          target_organization_id: string
          target_status: Database["public"]["Enums"]["inventory_record_status"]
          target_type: string
          target_warehouse_id: string
        }
        Returns: string
      }
      admin_set_inventory_quarantine: {
        Args: {
          should_quarantine: boolean
          target_idempotency_key: string
          target_location_id: string
          target_lot_id: string
          target_organization_id: string
          target_quantity: number
          target_reason: string
          target_warehouse_id: string
        }
        Returns: number
      }
      admin_set_library_item_tags: {
        Args: {
          target_item_id: string
          target_organization_id: string
          target_tag_ids: string[]
        }
        Returns: number
      }
      admin_set_package_content: {
        Args: {
          target_idempotency_key: string
          target_package_id: string
          target_quantity: number
          target_shipment_line_id: string
        }
        Returns: string
      }
      admin_set_package_shipping: {
        Args: {
          target_carrier_code: string
          target_dimension_unit: string
          target_height: number
          target_idempotency_key: string
          target_length: number
          target_organization_id: string
          target_package_id: string
          target_service_code: string
          target_width: number
        }
        Returns: string
      }
      admin_set_profile_status: {
        Args: {
          target_status: Database["public"]["Enums"]["profile_status"]
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_role_permission: {
        Args: {
          should_grant: boolean
          target_permission_id: string
          target_role_id: string
        }
        Returns: boolean
      }
      admin_share_library_item: {
        Args: {
          target_client_organization_id: string
          target_effective_from: string
          target_effective_to: string
          target_item_id: string
          target_provider_id: string
          target_version_id: string
        }
        Returns: string
      }
      admin_transfer_inventory: {
        Args: {
          target_destination_location_id: string
          target_destination_warehouse_id: string
          target_idempotency_key: string
          target_lot_id: string
          target_organization_id: string
          target_quantity: number
          target_reason: string
          target_source_location_id: string
          target_source_warehouse_id: string
        }
        Returns: number[]
      }
      admin_update_organization_membership: {
        Args: {
          target_membership_id: string
          target_role_id: string
          target_status: Database["public"]["Enums"]["membership_status"]
        }
        Returns: undefined
      }
      admin_verify_shipment: {
        Args: {
          target_idempotency_key: string
          target_notes: string
          target_shipment_id: string
          target_status: string
          target_verified_quantity: number
        }
        Returns: string
      }
      admin_void_shipping_label: {
        Args: {
          target_idempotency_key: string
          target_organization_id: string
          target_package_id: string
        }
        Returns: string
      }
      create_credit_memo: {
        Args: {
          target_amount: number
          target_idempotency_key: string
          target_invoice_id: string
          target_organization_id: string
          target_reason: string
          target_rma_id: string
        }
        Returns: string
      }
      create_discrepancy_case: {
        Args: {
          target_case_type: string
          target_client_organization_id: string
          target_description: string
          target_idempotency_key: string
          target_order_id: string
          target_organization_id: string
          target_severity: string
          target_shipment_id: string
          target_source_event_id: string
          target_source_event_type: string
          target_title: string
        }
        Returns: string
      }
      create_financial_adjustment: {
        Args: {
          target_amount: number
          target_idempotency_key: string
          target_invoice_id: string
          target_organization_id: string
          target_reason: string
          target_type: string
        }
        Returns: string
      }
      create_invoice_from_order: {
        Args: {
          target_due_at?: string
          target_idempotency_key: string
          target_order_id: string
          target_organization_id: string
        }
        Returns: string
      }
      create_post_delivery_reconciliation: {
        Args: {
          target_client_organization_id: string
          target_discrepancy_case_id: string
          target_idempotency_key: string
          target_order_id: string
          target_organization_id: string
          target_result: string
          target_shipment_id: string
          target_summary: string
        }
        Returns: string
      }
      create_replacement_request: {
        Args: {
          target_client_organization_id: string
          target_discrepancy_case_id: string
          target_idempotency_key: string
          target_lines: Json
          target_order_id: string
          target_organization_id: string
          target_original_shipment_id: string
          target_reason: string
          target_warehouse_id: string
        }
        Returns: string
      }
      create_return_authorization: {
        Args: {
          target_client_organization_id: string
          target_discrepancy_case_id: string
          target_idempotency_key: string
          target_lines: Json
          target_order_id: string
          target_organization_id: string
          target_original_shipment_id: string
          target_reason: string
        }
        Returns: string
      }
      dispose_return: {
        Args: {
          target_disposition: string
          target_idempotency_key: string
          target_line_id: string
          target_organization_id: string
          target_quantity: number
          target_reason: string
          target_return_authorization_id: string
        }
        Returns: string
      }
      get_client_account_admin_context: { Args: never; Returns: Json }
      get_client_account_statement: {
        Args: { target_client_organization_id: string }
        Returns: Json
      }
      get_client_case_feed: { Args: { target_limit?: number }; Returns: Json }
      get_client_catalog_admin_companies: {
        Args: never
        Returns: {
          can_connect: boolean
          can_price: boolean
          id: string
          name: string
        }[]
      }
      get_client_financial_summary: {
        Args: { target_client_organization_id: string }
        Returns: Json
      }
      get_client_library: {
        Args: { target_provider_id: string; target_query?: string }
        Returns: Json
      }
      get_client_notification_feed: {
        Args: { target_limit?: number }
        Returns: Json
      }
      get_client_order_notifications: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_client_referral_dashboard: {
        Args: { target_affiliate_client_id: string; target_provider_id: string }
        Returns: Json
      }
      get_client_replacement_status: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_client_return_status: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_client_sales_report: {
        Args: {
          target_client_id: string
          target_end: string
          target_provider_id: string
          target_start: string
        }
        Returns: Json
      }
      get_client_shipping_summary: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_company_sales_report: {
        Args: {
          target_end: string
          target_provider_id: string
          target_start: string
        }
        Returns: Json
      }
      get_customer_contexts: {
        Args: never
        Returns: {
          can_addresses: boolean
          can_edit_addresses: boolean
          can_history: boolean
          can_lifecycle: boolean
          can_manage: boolean
          id: string
          name: string
        }[]
      }
      get_internal_alert_feed: {
        Args: { target_limit?: number; target_organization_id: string }
        Returns: Json
      }
      get_library_context: {
        Args: { target_provider_id: string; target_query?: string }
        Returns: Json
      }
      get_library_item_delivery: {
        Args: {
          target_item_id: string
          target_mode: string
          target_provider_id: string
          target_version_id: string
        }
        Returns: Json
      }
      get_library_navigation: {
        Args: { target_provider_id: string }
        Returns: Json
      }
      get_my_client_catalog: {
        Args: {
          target_client_organization_id: string
          target_currency?: string
          target_limit?: number
          target_offset?: number
          target_quantity?: number
          target_search?: string
        }
        Returns: {
          currency: string
          description: string
          display_name: string
          entry_id: string
          product_id: string
          sku: string
          total_count: number
          unit_price: number
          variant_id: string
        }[]
      }
      get_order_allocation_summary: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_order_contexts: {
        Args: never
        Returns: {
          can_create: boolean
          can_manage: boolean
          id: string
          name: string
        }[]
      }
      get_order_fulfillment_summary: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_order_intake_options: {
        Args: {
          target_client_organization_id: string
          target_currency?: string
        }
        Returns: Json
      }
      get_order_service_admin: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          id: string
          order_access: string
          provider_id: string
          provider_name: string
          status: Database["public"]["Enums"]["organization_status"]
          version: number
        }[]
      }
      get_personal_calculator_configurations: {
        Args: { target_provider_id: string }
        Returns: Json
      }
      get_phase5b_admin_context: {
        Args: { target_provider_id: string }
        Returns: Json
      }
      get_phase5c_context: {
        Args: { target_provider_id: string }
        Returns: Json
      }
      get_purchase_order_costs: {
        Args: { target_organization_id: string }
        Returns: {
          additional_cost: number
          currency: string
          freight_cost: number
          id: string
          subtotal: number
        }[]
      }
      get_purchase_order_line_costs: {
        Args: {
          target_organization_id: string
          target_purchase_order_id: string
        }
        Returns: {
          currency: string
          id: string
          unit_cost: number
        }[]
      }
      get_receiving_work_items: {
        Args: { target_organization_id: string }
        Returns: {
          id: string
          product_variant_id: string
          quantity_ordered: number
          quantity_received: number
          status: string
        }[]
      }
      get_salesperson_dashboard: {
        Args: { target_provider_id: string; target_salesperson_id?: string }
        Returns: Json
      }
      get_salesperson_report: {
        Args: {
          target_end: string
          target_provider_id: string
          target_salesperson_id: string
          target_start: string
        }
        Returns: Json
      }
      get_split_order_letter: {
        Args: { target_order_id: string }
        Returns: Json
      }
      get_supplier_issue_credits: {
        Args: { target_organization_id: string }
        Returns: {
          credit_amount: number
          currency: string
          id: string
        }[]
      }
      issue_invoice: {
        Args: {
          target_idempotency_key: string
          target_invoice_id: string
          target_organization_id: string
        }
        Returns: string
      }
      process_local_notification_outbox: {
        Args: { target_limit?: number; target_organization_id: string }
        Returns: number
      }
      receive_return: {
        Args: {
          target_idempotency_key: string
          target_location_id: string
          target_notes: string
          target_organization_id: string
          target_return_authorization_id: string
          target_warehouse_id: string
        }
        Returns: string
      }
      record_manual_payment: {
        Args: {
          target_amount: number
          target_currency: string
          target_idempotency_key: string
          target_invoice_id: string
          target_organization_id: string
          target_reference: string
        }
        Returns: string
      }
      record_refund: {
        Args: {
          target_amount: number
          target_idempotency_key: string
          target_organization_id: string
          target_payment_id: string
          target_reason: string
        }
        Returns: string
      }
      record_test_payment_callback: {
        Args: {
          target_amount: number
          target_currency: string
          target_event_id: string
          target_invoice_id: string
          target_organization_id: string
          target_provider: string
          target_provider_transaction_id: string
          target_status: string
        }
        Returns: string
      }
      save_personal_calculator_configuration: {
        Args: {
          target_configuration: Json
          target_expected_version?: number
          target_id: string
          target_name: string
          target_plugin_version_id: string
          target_provider_id: string
          target_status: string
        }
        Returns: string
      }
      set_my_primary_organization: {
        Args: { target_membership_id: string }
        Returns: undefined
      }
      set_notification_preference: {
        Args: {
          target_event_type: string
          target_in_app_enabled: boolean
          target_organization_id: string
          target_suppressed_until?: string
          target_user_id: string
        }
        Returns: string
      }
      submit_order: {
        Args: {
          target_address_id: string
          target_client_organization_id: string
          target_currency: string
          target_customer_id: string
          target_idempotency_key: string
          target_lines: Json
        }
        Returns: string
      }
      submit_order_addendum: {
        Args: {
          target_client_organization_id: string
          target_idempotency_key: string
          target_lines: Json
          target_order_id: string
          target_reason: string
        }
        Returns: string
      }
      transition_calculator_version: {
        Args: { target_status: string; target_version_id: string }
        Returns: string
      }
      transition_commission: {
        Args: { target_commission_id: string; target_status: string }
        Returns: string
      }
      transition_library_version: {
        Args: { target_status: string; target_version_id: string }
        Returns: string
      }
      transition_order_status: {
        Args: {
          target_order_id: string
          target_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: string
      }
      transition_referral_commission: {
        Args: { target_commission_id: string; target_status: string }
        Returns: string
      }
      update_discrepancy_case: {
        Args: {
          target_assigned_to: string
          target_id: string
          target_organization_id: string
          target_resolution: string
          target_severity: string
          target_status: string
        }
        Returns: string
      }
    }
    Enums: {
      catalog_status: "active" | "inactive"
      inbound_shipment_status:
        | "expected"
        | "in_transit"
        | "delayed"
        | "delivered"
        | "receiving"
        | "partially_received"
        | "received"
        | "exception"
        | "closed"
      inventory_record_status: "active" | "inactive"
      inventory_transaction_type:
        | "receipt"
        | "adjustment_in"
        | "adjustment_out"
        | "transfer_in"
        | "transfer_out"
        | "reserve"
        | "release_reservation"
        | "quarantine"
        | "release_quarantine"
        | "damage"
        | "expiration"
        | "fulfillment"
        | "return"
      lot_status:
        | "pending_receipt"
        | "received"
        | "pending_qc"
        | "available"
        | "quarantined"
        | "rejected"
        | "depleted"
        | "expired"
        | "recalled"
      membership_status: "invited" | "active" | "inactive" | "suspended"
      order_status:
        | "draft"
        | "submitted"
        | "accepted"
        | "processing"
        | "partially_fulfilled"
        | "fulfilled"
        | "cancelled"
        | "exception"
      organization_status: "active" | "inactive" | "suspended"
      organization_type:
        | "platform_owner"
        | "fulfillment_company"
        | "client_company"
        | "white_label"
      product_status: "active" | "inactive" | "depleted" | "discontinued"
      profile_status: "active" | "inactive" | "suspended"
      purchase_order_line_status:
        | "open"
        | "partially_received"
        | "received"
        | "cancelled"
        | "closed"
      purchase_order_status:
        | "draft"
        | "submitted"
        | "confirmed"
        | "partially_received"
        | "received"
        | "delayed"
        | "cancelled"
        | "closed"
      qc_status:
        | "pending"
        | "passed"
        | "partial_pass"
        | "failed"
        | "quarantined"
        | "released"
        | "rejected"
      quality_document_status:
        | "pending"
        | "approved"
        | "rejected"
        | "superseded"
      receiving_line_status: "pending" | "received" | "discrepancy" | "rejected"
      receiving_status: "draft" | "in_progress" | "completed" | "cancelled"
      reservation_status: "active" | "released" | "fulfilled" | "cancelled"
      supplier_issue_severity: "low" | "medium" | "high" | "critical"
      supplier_issue_status:
        | "open"
        | "supplier_contacted"
        | "awaiting_response"
        | "replacement_pending"
        | "credit_pending"
        | "resolved"
        | "closed"
      supplier_resolution_type:
        | "replacement_product"
        | "supplier_credit"
        | "refund"
        | "reshipment"
        | "no_action"
        | "other"
      warehouse_status: "active" | "inactive" | "temporarily_closed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      catalog_status: ["active", "inactive"],
      inbound_shipment_status: [
        "expected",
        "in_transit",
        "delayed",
        "delivered",
        "receiving",
        "partially_received",
        "received",
        "exception",
        "closed",
      ],
      inventory_record_status: ["active", "inactive"],
      inventory_transaction_type: [
        "receipt",
        "adjustment_in",
        "adjustment_out",
        "transfer_in",
        "transfer_out",
        "reserve",
        "release_reservation",
        "quarantine",
        "release_quarantine",
        "damage",
        "expiration",
        "fulfillment",
        "return",
      ],
      lot_status: [
        "pending_receipt",
        "received",
        "pending_qc",
        "available",
        "quarantined",
        "rejected",
        "depleted",
        "expired",
        "recalled",
      ],
      membership_status: ["invited", "active", "inactive", "suspended"],
      order_status: [
        "draft",
        "submitted",
        "accepted",
        "processing",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
        "exception",
      ],
      organization_status: ["active", "inactive", "suspended"],
      organization_type: [
        "platform_owner",
        "fulfillment_company",
        "client_company",
        "white_label",
      ],
      product_status: ["active", "inactive", "depleted", "discontinued"],
      profile_status: ["active", "inactive", "suspended"],
      purchase_order_line_status: [
        "open",
        "partially_received",
        "received",
        "cancelled",
        "closed",
      ],
      purchase_order_status: [
        "draft",
        "submitted",
        "confirmed",
        "partially_received",
        "received",
        "delayed",
        "cancelled",
        "closed",
      ],
      qc_status: [
        "pending",
        "passed",
        "partial_pass",
        "failed",
        "quarantined",
        "released",
        "rejected",
      ],
      quality_document_status: [
        "pending",
        "approved",
        "rejected",
        "superseded",
      ],
      receiving_line_status: ["pending", "received", "discrepancy", "rejected"],
      receiving_status: ["draft", "in_progress", "completed", "cancelled"],
      reservation_status: ["active", "released", "fulfilled", "cancelled"],
      supplier_issue_severity: ["low", "medium", "high", "critical"],
      supplier_issue_status: [
        "open",
        "supplier_contacted",
        "awaiting_response",
        "replacement_pending",
        "credit_pending",
        "resolved",
        "closed",
      ],
      supplier_resolution_type: [
        "replacement_product",
        "supplier_credit",
        "refund",
        "reshipment",
        "no_action",
        "other",
      ],
      warehouse_status: ["active", "inactive", "temporarily_closed"],
    },
  },
} as const

