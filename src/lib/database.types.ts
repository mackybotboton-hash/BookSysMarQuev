export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string
          role: 'admin' | 'staff' | 'client'
          avatar_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          phone?: string
          role?: 'admin' | 'staff' | 'client'
          avatar_url?: string
        }
        Update: {
          email?: string
          full_name?: string
          phone?: string
          role?: 'admin' | 'staff' | 'client'
          avatar_url?: string
        }
      }
      services: {
        Row: {
          id: string
          name: string
          category: 'Hair' | 'Nails' | 'Other'
          price: number
          estimated_cost: number
          duration_minutes: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: 'Hair' | 'Nails' | 'Other'
          price: number
          estimated_cost?: number
          duration_minutes?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          category?: 'Hair' | 'Nails' | 'Other'
          price?: number
          estimated_cost?: number
          duration_minutes?: number
          is_active?: boolean
        }
      }
      staff: {
        Row: {
          id: string
          name: string
          phone: string
          daily_rate: number
          color_code: string
          is_active: boolean
          profile_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string
          daily_rate?: number
          color_code?: string
          is_active?: boolean
          profile_id?: string | null
        }
        Update: {
          name?: string
          phone?: string
          daily_rate?: number
          color_code?: string
          is_active?: boolean
          profile_id?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          client_name: string
          client_phone: string
          service_id: string | null
          staff_id: string | null
          booking_date: string
          start_time: string
          end_time: string | null
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          total_price: number
          notes: string
          cancellation_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_name: string
          client_phone?: string
          service_id?: string | null
          staff_id?: string | null
          booking_date: string
          start_time: string
          end_time?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          total_price: number
          notes?: string
          cancellation_reason?: string | null
          created_by?: string | null
        }
        Update: {
          client_name?: string
          client_phone?: string
          service_id?: string | null
          staff_id?: string | null
          booking_date?: string
          start_time?: string
          end_time?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          total_price?: number
          notes?: string
        }
      }
      expenses: {
        Row: {
          id: string
          description: string
          amount: number
          category: 'salary' | 'supplies' | 'rent' | 'utilities' | 'other'
          expense_date: string
          staff_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          description: string
          amount: number
          category: 'salary' | 'supplies' | 'rent' | 'utilities' | 'other'
          expense_date?: string
          staff_id?: string | null
          created_by?: string | null
        }
        Update: {
          description?: string
          amount?: number
          category?: 'salary' | 'supplies' | 'rent' | 'utilities' | 'other'
          expense_date?: string
          staff_id?: string | null
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Staff = Database['public']['Tables']['staff']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']

export type BookingWithDetails = Booking & {
  services: Service | null
  staff: Staff | null
}

export type InventoryItem = {
  id: string
  name: string
  category: 'Hair' | 'Nails' | 'Other'
  unit_cost: number
  retail_price: number
  stock_quantity: number
  min_threshold: number
  expiry_date?: string | null
  created_at?: string
  updated_at?: string
}

export type InventoryRequisition = {
  id: string
  item_id: string
  staff_id?: string | null
  quantity_opened: number
  purpose: string
  created_at: string
  item?: InventoryItem | null
  staff?: Staff | null
}

export type PurchaseOrder = {
  id: string
  supplier_name: string
  items_ordered: any[]
  total_amount: number
  status: 'pending' | 'shipped' | 'received'
  delivery_days: number
  created_at: string
}

export type CalendarEvent = {
  id: string
  title: string
  event_date: string
  is_all_day: boolean
  start_time: string | null
  end_time: string | null
  notes: string
  created_by: string | null
  created_at: string
  updated_at: string
}
