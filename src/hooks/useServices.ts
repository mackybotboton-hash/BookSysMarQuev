import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Service } from '@/lib/database.types'

type ServiceInsert = {
  name: string
  category: string
  price: number
  home_service_price?: number
  estimated_cost?: number
  duration_minutes?: number
  is_active?: boolean
}

type ServiceUpdate = Partial<ServiceInsert>

// LocalStorage fallback map helper for estimated_cost
function getEstCostMap(): Record<string, number> {
  try {
    const cached = localStorage.getItem('marquevedo_service_est_costs')
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

function setEstCostMap(id: string, cost: number) {
  try {
    const map = getEstCostMap()
    map[id] = cost
    localStorage.setItem('marquevedo_service_est_costs', JSON.stringify(map))
  } catch {}
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name')
      if (error) throw error

      const estMap = getEstCostMap()
      return (data ?? []).map((s: any) => ({
        ...s,
        home_service_price: Number(s.home_service_price ?? 0),
        estimated_cost: Number(s.estimated_cost ?? estMap[s.id] ?? 0),
      })) as Service[]
    },
  })
}

export function useActiveServices() {
  return useQuery({
    queryKey: ['services', 'active'],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')
      if (error) throw error

      const estMap = getEstCostMap()
      return (data ?? []).map((s: any) => ({
        ...s,
        home_service_price: Number(s.home_service_price ?? 0),
        estimated_cost: Number(s.estimated_cost ?? estMap[s.id] ?? 0),
      })) as Service[]
    },
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (service: ServiceInsert) => {
      const estCost = service.estimated_cost ?? 0
      try {
        const { data, error } = await supabase
          .from('services')
          .insert(service as any)
          .select()
          .maybeSingle()
        if (error) throw error
        if (data?.id) setEstCostMap(data.id, estCost)
        return data
      } catch (err: any) {
        if (err.message && err.message.includes('estimated_cost')) {
          const { estimated_cost, ...payloadWithoutEst } = service
          const { data, error } = await supabase
            .from('services')
            .insert(payloadWithoutEst as any)
            .select()
            .maybeSingle()
          if (error) throw error
          if (data?.id) setEstCostMap(data.id, estCost)
          return { ...data, estimated_cost: estCost }
        }
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      window.dispatchEvent(new Event('marquevedo_service_updated'))
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ServiceUpdate }) => {
      const estCost = updates.estimated_cost
      if (estCost !== undefined) setEstCostMap(id, estCost)

      try {
        const { data, error } = await supabase
          .from('services')
          .update(updates as any)
          .eq('id', id)
          .select()
          .maybeSingle()
        if (error) throw error
        return data
      } catch (err: any) {
        if (err.message && err.message.includes('estimated_cost')) {
          const { estimated_cost, ...updatesWithoutEst } = updates
          const { data, error } = await supabase
            .from('services')
            .update(updatesWithoutEst as any)
            .eq('id', id)
            .select()
            .maybeSingle()
          if (error) throw error
          return { ...data, estimated_cost: estCost ?? 0 }
        }
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      window.dispatchEvent(new Event('marquevedo_service_updated'))
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      window.dispatchEvent(new Event('marquevedo_service_updated'))
    },
  })
}
