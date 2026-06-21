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
<<<<<<< HEAD
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          delivered_payload: string | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          title: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivered_payload?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          title: string
          unit_price: number
        }
        Update: {
          created_at?: string
          delivered_payload?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
=======
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          discount_percent: number
          discount_type: string
          expires_at: string | null
          fixed_amount: number | null
          id: string
          max_uses: number | null
          scope: string
          times_used: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          discount_percent: number
          discount_type?: string
          expires_at?: string | null
          fixed_amount?: number | null
          id?: string
          max_uses?: number | null
          scope?: string
          times_used?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          discount_type?: string
          expires_at?: string | null
          fixed_amount?: number | null
          id?: string
          max_uses?: number | null
          scope?: string
          times_used?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          discount_percent: number | null
          id: string
          login_id: string | null
          price_paid: number
          product_id: string
          status: string
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          login_id?: string | null
          price_paid: number
          product_id: string
          status?: string
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          login_id?: string | null
          price_paid?: number
          product_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_login_id_fkey"
            columns: ["login_id"]
            isOneToOne: false
            referencedRelation: "product_logins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
<<<<<<< HEAD
      orders: {
        Row: {
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
          wallet_tx_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
          wallet_tx_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          user_id?: string
          wallet_tx_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_wallet_tx_id_fkey"
            columns: ["wallet_tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          raw: Json | null
          reference: string
          status: Database["public"]["Enums"]["tx_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          provider: Database["public"]["Enums"]["payment_provider"]
          raw?: Json | null
          reference: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          raw?: Json | null
          reference?: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_credentials: {
        Row: {
          assigned_to: string | null
          content: string
          created_at: string
          delivered_at: string | null
          id: string
          label: string | null
          order_id: string | null
          product_id: string
        }
        Insert: {
          assigned_to?: string | null
          content: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          label?: string | null
          order_id?: string | null
          product_id: string
        }
        Update: {
          assigned_to?: string | null
          content?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          label?: string | null
          order_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_credentials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_credentials_product_id_fkey"
=======
      payment_transactions: {
        Row: {
          amount_credited: number
          amount_paid: number
          coupon_code: string | null
          created_at: string
          id: string
          provider: string
          raw_payload: Json | null
          reference: string
          status: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_credited?: number
          amount_paid: number
          coupon_code?: string | null
          created_at?: string
          id?: string
          provider: string
          raw_payload?: Json | null
          reference: string
          status?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_credited?: number
          amount_paid?: number
          coupon_code?: string | null
          created_at?: string
          id?: string
          provider?: string
          raw_payload?: Json | null
          reference?: string
          status?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      product_logins: {
        Row: {
          created_at: string
          id: string
          login_data: string
          product_id: string
          sold_at: string | null
          sold_to_user_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_data: string
          product_id: string
          sold_at?: string | null
          sold_to_user_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          login_data?: string
          product_id?: string
          sold_at?: string | null
          sold_to_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_logins_product_id_fkey"
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
<<<<<<< HEAD
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          metadata: Json | null
          price: number
          published: boolean
          slug: string
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          price: number
          published?: boolean
          slug: string
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          price?: number
          published?: boolean
          slug?: string
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
=======
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
          updated_at?: string
        }
        Relationships: []
      }
<<<<<<< HEAD
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
=======
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_suspended: boolean
          last_name: string | null
          phone: string | null
          updated_at: string
          username: string | null
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          is_suspended?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_suspended?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
          wallet_balance?: number
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
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
      wallet_transactions: {
        Row: {
<<<<<<< HEAD
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          reference: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          reference?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          reference?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
=======
          admin_id: string | null
          amount: number
          created_at: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          type?: string
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
<<<<<<< HEAD
      assign_credential_to_order: {
        Args: { _order_id: string; _product_id: string }
        Returns: string
      }
      credit_wallet: {
        Args: {
          _user_id: string
          _amount: number
          _provider: Database["public"]["Enums"]["payment_provider"]
          _reference: string
          _description?: string
        }
        Returns: string
=======
      credit_wallet_from_payment: {
        Args: {
          _amount_paid: number
          _provider: string
          _raw: Json
          _reference: string
        }
        Returns: Json
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
<<<<<<< HEAD
      purchase_with_wallet: {
        Args: { _user_id: string; _product_id: string; _quantity: number }
        Returns: string
      }
    }
    Enums: {
      app_role: "user" | "admin"
      order_status: "pending" | "completed" | "failed" | "refunded"
      payment_provider: "paystack" | "nowpayments" | "manual"
      tx_status: "pending" | "success" | "failed" | "reversed"
      tx_type: "credit" | "debit"
=======
      purchase_product_atomic: {
        Args: { _coupon_code?: string; _product_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
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
<<<<<<< HEAD
      app_role: ["user", "admin"],
      order_status: ["pending", "completed", "pending_credentials", "failed", "refunded"],
      payment_provider: ["paystack", "nowpayments", "manual"],
      tx_status: ["pending", "success", "failed", "reversed"],
      tx_type: ["credit", "debit"],
=======
      app_role: ["admin", "user"],
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
    },
  },
} as const
