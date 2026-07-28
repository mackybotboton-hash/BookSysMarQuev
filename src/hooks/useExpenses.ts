import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/lib/database.types'

type ExpenseInsert = {
  description: string
  amount: number
  category: 'salary' | 'supplies' | 'rent' | 'utilities' | 'other'
  expense_date?: string
  staff_id?: string | null
  created_by?: string | null
}

type ExpenseUpdate = Partial<ExpenseInsert>

type ExpenseWithStaff = Expense & { staff: any }

export function useExpenses(filters?: { category?: string; startDate?: string; endDate?: string; staffId?: string }) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async (): Promise<ExpenseWithStaff[]> => {
      let query = supabase
        .from('expenses')
        .select('*, staff(*)')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.category) {
        query = query.eq('category', filters.category)
      }
      if (filters?.startDate) {
        query = query.gte('expense_date', filters.startDate)
      }
      if (filters?.endDate) {
        query = query.lte('expense_date', filters.endDate)
      }
      if (filters?.staffId) {
        query = query.eq('staff_id', filters.staffId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as ExpenseWithStaff[]
    },
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense as any)
        .select('*, staff(*)')
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ExpenseUpdate }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates as any)
        .eq('id', id)
        .select('*, staff(*)')
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useGenerateSalary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ staffId, staffName, dailyRate, daysWorked, date }: {
      staffId: string
      staffName: string
      dailyRate: number
      daysWorked: number
      date: string
    }) => {
      const amount = dailyRate * daysWorked
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          description: `Salary - ${staffName} (${daysWorked} days)`,
          amount,
          category: 'salary',
          expense_date: date,
          staff_id: staffId,
        } as any)
        .select('*, staff(*)')
        .maybeSingle()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
