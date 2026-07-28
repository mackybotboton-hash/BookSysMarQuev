import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InventoryItem } from '@/lib/database.types'

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'L’Oréal Majirel Permanent Hair Color 50ml',
    category: 'Hair',
    unit_cost: 320,
    retail_price: 500,
    stock_quantity: 14,
    min_threshold: 8,
    expiry_date: '2027-11-15',
  },
  {
    id: 'inv-2',
    name: 'L’Oréal Cream Developer 20 Vol 1000ml',
    category: 'Hair',
    unit_cost: 680,
    retail_price: 0,
    stock_quantity: 3, // LOW STOCK
    min_threshold: 5,
    expiry_date: '2028-02-10',
  },
  {
    id: 'inv-3',
    name: 'Gel Nail Polish UV Master Set (12 Colors)',
    category: 'Nails',
    unit_cost: 450,
    retail_price: 750,
    stock_quantity: 25,
    min_threshold: 10,
    expiry_date: '2027-09-20',
  },
  {
    id: 'inv-4',
    name: 'Acrylic Nail Extension Kit 500g',
    category: 'Nails',
    unit_cost: 850,
    retail_price: 1400,
    stock_quantity: 2, // LOW STOCK & NEAR EXPIRY
    min_threshold: 5,
    expiry_date: '2026-08-30', // Expiring within ~30 days!
  },
  {
    id: 'inv-5',
    name: 'Olaplex No. 3 Hair Perfector 100ml',
    category: 'Hair',
    unit_cost: 1250,
    retail_price: 1850,
    stock_quantity: 18,
    min_threshold: 6,
    expiry_date: '2027-08-20',
  },
  {
    id: 'inv-6',
    name: 'Moroccanoil Original Treatment 100ml',
    category: 'Hair',
    unit_cost: 1600,
    retail_price: 2400,
    stock_quantity: 20,
    min_threshold: 8,
    expiry_date: '2028-01-01',
  },
  {
    id: 'inv-7',
    name: 'Keratin Complex Smoothing Treatment 1000ml',
    category: 'Hair',
    unit_cost: 7200,
    retail_price: 0,
    stock_quantity: 1, // LOW STOCK & NEAR EXPIRY
    min_threshold: 4,
    expiry_date: '2026-08-15', // Expiring within 20 days!
  },
  {
    id: 'inv-8',
    name: 'Salon Disinfectant & Sanitizer Spray 1L',
    category: 'Other',
    unit_cost: 350,
    retail_price: 0,
    stock_quantity: 12,
    min_threshold: 4,
    expiry_date: '2028-05-01',
  },
]

export function useInventoryItems() {
  return useQuery({
    queryKey: ['inventoryItems'],
    queryFn: async (): Promise<InventoryItem[]> => {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .order('created_at', { ascending: false })
        if (error || !data || data.length === 0) {
          const stored = localStorage.getItem('marquevedo_inventory_items')
          if (stored) return JSON.parse(stored)
          localStorage.setItem('marquevedo_inventory_items', JSON.stringify(INITIAL_INVENTORY))
          return INITIAL_INVENTORY
        }
        return data as InventoryItem[]
      } catch {
        const stored = localStorage.getItem('marquevedo_inventory_items')
        if (stored) return JSON.parse(stored)
        localStorage.setItem('marquevedo_inventory_items', JSON.stringify(INITIAL_INVENTORY))
        return INITIAL_INVENTORY
      }
    },
  })
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newItem: Omit<InventoryItem, 'id'>) => {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert(newItem as any)
          .select()
          .single()
        if (error) throw error
        return data
      } catch {
        const stored = JSON.parse(localStorage.getItem('marquevedo_inventory_items') || JSON.stringify(INITIAL_INVENTORY))
        const created: InventoryItem = { ...newItem, id: `inv-${Date.now()}` }
        const updated = [created, ...stored]
        localStorage.setItem('marquevedo_inventory_items', JSON.stringify(updated))
        return created
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
    },
  })
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) => {
      try {
        if (id.startsWith('inv-')) throw new Error('Local item')
        const { data, error } = await supabase
          .from('inventory_items')
          .update(updates as any)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      } catch {
        const stored = JSON.parse(localStorage.getItem('marquevedo_inventory_items') || JSON.stringify(INITIAL_INVENTORY))
        const updated = stored.map((item: InventoryItem) => item.id === id ? { ...item, ...updates } : item)
        localStorage.setItem('marquevedo_inventory_items', JSON.stringify(updated))
        return updates
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
    },
  })
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        if (id.startsWith('inv-')) throw new Error('Local item')
        const { error } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', id)
        if (error) throw error
      } catch {
        const stored = JSON.parse(localStorage.getItem('marquevedo_inventory_items') || JSON.stringify(INITIAL_INVENTORY))
        const updated = stored.filter((item: InventoryItem) => item.id !== id)
        localStorage.setItem('marquevedo_inventory_items', JSON.stringify(updated))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
    },
  })
}
