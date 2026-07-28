import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BookingWithDetails } from '@/lib/database.types'

interface DashboardStats {
  totalBookings: number
  totalIncome: number
  estimatedIncome: number
  totalExpenses: number
  inventoryAssetValue: number
  estimatedProductCost: number
  netProfit: number
}

interface ChartDay {
  date: string
  day: string
  income: number
  expenses: number
}

export function useDashboardStats() {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: ['dashboard', 'stats', today],
    queryFn: async (): Promise<DashboardStats> => {
      // 1. Today's bookings count, service income, and estimated product cost
      let todayBookings: any[] = []
      try {
        const { data } = await supabase
          .from('bookings')
          .select('total_price, status, service_id, services(id, price, estimated_cost)')
          .eq('booking_date', today)
          .neq('status', 'cancelled')
        todayBookings = data || []
      } catch {
        const { data } = await supabase
          .from('bookings')
          .select('total_price, status, service_id, services(id, price)')
          .eq('booking_date', today)
          .neq('status', 'cancelled')
        todayBookings = data || []
      }

      let estMap: Record<string, number> = {}
      try {
        const cachedEst = localStorage.getItem('marquevedo_service_est_costs')
        if (cachedEst) estMap = JSON.parse(cachedEst)
      } catch {}

      // 2. Today's expenses
      const { data: todayExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('expense_date', today)

      // 3. Inventory Stock Asset Value (buying price * stock_qty)
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('stock_quantity, unit_cost')

      let inventoryItems = (inventoryData ?? []) as any[]
      if (inventoryItems.length === 0) {
        try {
          const cached = localStorage.getItem('marquevedo_inventory_items')
          if (cached) inventoryItems = JSON.parse(cached)
        } catch {}
      }

      // 4. POS Product Sales & Costs today
      let posRetailTodayIncome = 0
      let posProductCostToday = 0
      try {
        const cachedLogs = localStorage.getItem('marquevedo_pos_logs')
        if (cachedLogs) {
          const logs = JSON.parse(cachedLogs)
          const todayLogs = logs.filter((l: any) => l.date && l.date.startsWith(today))
          
          posRetailTodayIncome = todayLogs
            .filter((l: any) => l.usage_type === 'retail')
            .reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0)

          posProductCostToday = todayLogs
            .filter((l: any) => l.usage_type === 'retail')
            .reduce((sum: number, l: any) => sum + ((Number(l.unit_cost) || 0) * (Number(l.qty) || 1)), 0)
        }
      } catch {}

      const bookingsArr = (todayBookings ?? []) as any[]
      const expensesArr = (todayExpenses ?? []) as any[]

      const totalBookings = bookingsArr.length
      const servicePriceTotal = bookingsArr
        .filter((b: any) => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + Number(b.total_price), 0)

      const serviceCostTotal = bookingsArr
        .filter((b: any) => b.status === 'completed')
        .reduce(
          (sum: number, b: any) =>
            sum + (Number(b.services?.estimated_cost) || estMap[b.services?.id] || estMap[b.service_id] || 0),
          0
        )

      const estServiceIncome = bookingsArr
        .filter((b: any) => b.status === 'pending' || b.status === 'confirmed')
        .reduce((sum: number, b: any) => sum + Number(b.total_price), 0)

      // Today's Income = Selling Prices
      const totalIncome = servicePriceTotal + posRetailTodayIncome
      
      // Estimated Income = Pending Service Prices
      const estimatedIncome = estServiceIncome

      const estimatedProductCost = serviceCostTotal + posProductCostToday

      const totalExpenses = expensesArr.reduce((sum: number, e: any) => sum + Number(e.amount), 0)

      const inventoryAssetValue = inventoryItems.reduce(
        (sum: number, item: any) => sum + (Number(item.stock_quantity) || 0) * (Number(item.unit_cost) || 0),
        0
      )

      return {
        totalBookings,
        totalIncome,
        estimatedIncome,
        totalExpenses,
        inventoryAssetValue,
        estimatedProductCost,
        netProfit: (servicePriceTotal - serviceCostTotal) + (posRetailTodayIncome - posProductCostToday),
      }
    },
  })
}

export function useRecentBookings() {
  return useQuery({
    queryKey: ['dashboard', 'recentBookings'],
    queryFn: async (): Promise<BookingWithDetails[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as unknown as BookingWithDetails[]
    },
  })
}

export function useWeeklyChart() {
  return useQuery({
    queryKey: ['dashboard', 'weeklyChart'],
    queryFn: async (): Promise<ChartDay[]> => {
      const days: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('booking_date, total_price, status')
        .gte('booking_date', days[0])
        .lte('booking_date', days[6])
        .eq('status', 'completed')

      const { data: expenses } = await supabase
        .from('expenses')
        .select('expense_date, amount')
        .gte('expense_date', days[0])
        .lte('expense_date', days[6])

      const bookingsArr = (bookings ?? []) as any[]
      const expensesArr = (expenses ?? []) as any[]

      return days.map(date => {
        const dayBookings = bookingsArr.filter((b: any) => b.booking_date === date)
        const dayExpenses = expensesArr.filter((e: any) => e.expense_date === date)
        const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short' })
        return {
          date,
          day: dayName,
          income: dayBookings.reduce((sum: number, b: any) => sum + Number(b.total_price), 0),
          expenses: dayExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        }
      })
    },
  })
}
