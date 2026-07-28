import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Staff } from '@/lib/database.types'

type StaffInsert = {
  name: string
  phone?: string
  daily_rate?: number
  color_code?: string
  is_active?: boolean
  profile_id?: string | null
}

type StaffUpdate = Partial<StaffInsert>

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async (): Promise<Staff[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Staff[]
    },
  })
}

export function useActiveStaff() {
  return useQuery({
    queryKey: ['staff', 'active'],
    queryFn: async (): Promise<Staff[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Staff[]
    },
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (staff: StaffInsert) => {
      const { data, error } = await supabase
        .from('staff')
        .insert(staff as any)
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      window.dispatchEvent(new Event('marquevedo_staff_updated'))
    },
  })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: StaffUpdate }) => {
      const { data, error } = await supabase
        .from('staff')
        .update(updates as any)
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      window.dispatchEvent(new Event('marquevedo_staff_updated'))
    },
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      window.dispatchEvent(new Event('marquevedo_staff_updated'))
    },
  })
}
