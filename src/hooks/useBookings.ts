import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Booking, BookingWithDetails } from '@/lib/database.types'
import { getTodayISO } from '@/lib/utils'

type BookingInsert = {
  client_name: string
  client_phone?: string
  service_id?: string | null
  staff_id?: string | null
  booking_date: string
  start_time: string
  end_time?: string | null
  status?: string
  total_price: number
  notes?: string
  cancellation_reason?: string | null
  created_by?: string | null
}

type BookingUpdate = Partial<BookingInsert>

export function useBookings(filters?: { date?: string; staffId?: string; status?: string }) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: async (): Promise<BookingWithDetails[]> => {
      let query = supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .order('created_at', { ascending: false })

      if (filters?.date) {
        query = query.eq('booking_date', filters.date)
      }
      if (filters?.staffId) {
        query = query.eq('staff_id', filters.staffId)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as BookingWithDetails[]
    },
  })
}

export function useBookingsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['bookings', 'range', startDate, endDate],
    queryFn: async (): Promise<BookingWithDetails[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .gte('booking_date', startDate)
        .lte('booking_date', endDate)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BookingWithDetails[]
    },
    enabled: !!startDate && !!endDate,
  })
}

export function useTodayBookings() {
  const today = getTodayISO()
  return useQuery({
    queryKey: ['bookings', 'today'],
    queryFn: async (): Promise<BookingWithDetails[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .eq('booking_date', today)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BookingWithDetails[]
    },
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (booking: BookingInsert) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking as any)
        .select('*, services(*), staff(*)')
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dateBookings'] })
      queryClient.invalidateQueries({ queryKey: ['clientBookings'] })
    },
  })
}

export function useUpdateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: BookingUpdate }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update(updates as any)
        .eq('id', id)
        .select('*, services(*), staff(*)')
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dateBookings'] })
      queryClient.invalidateQueries({ queryKey: ['clientBookings'] })
    },
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dateBookings'] })
      queryClient.invalidateQueries({ queryKey: ['clientBookings'] })
    },
  })
}
