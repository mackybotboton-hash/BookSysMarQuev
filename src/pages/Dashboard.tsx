import { CalendarDays, Receipt, TrendingUp, Plus, ArrowRight, X, Package } from 'lucide-react'
import { PesoIcon } from '@/components/common/PesoIcon'
import { useDashboardStats, useRecentBookings, useWeeklyChart } from '@/hooks/useDashboard'
import { useCreateExpense } from '@/hooks/useExpenses'
import { formatCurrency, formatDate, formatTime, getStatusColor, cn, getTodayISO } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import BookingForm from '@/components/bookings/BookingForm'
import toast from 'react-hot-toast'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: recentBookings, isLoading: bookingsLoading } = useRecentBookings()
  const { data: chartData } = useWeeklyChart()
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  // Real-time listener for bookings additions, updates & cancellations
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_admin_realtime_bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries()
      })
      .subscribe()

    const handleUpdate = () => {
      queryClient.invalidateQueries()
    }
    window.addEventListener('marquevedo_booking_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('marquevedo_booking_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [queryClient])

  const createExpense = useCreateExpense()

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'supplies' as const,
    expense_date: getTodayISO(),
  })

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Description and amount are required')
      return
    }

    try {
      await createExpense.mutateAsync({
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        expense_date: expenseForm.expense_date,
      })
      toast.success('Expense recorded successfully!')
      setShowExpenseForm(false)
      setExpenseForm({
        description: '',
        amount: '',
        category: 'supplies',
        expense_date: getTodayISO(),
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense')
    }
  }

  const statCards = [
    {
      label: "Today's Bookings",
      value: stats?.totalBookings ?? 0,
      icon: CalendarDays,
    },
    {
      label: "Est. Today's Income",
      value: formatCurrency(stats?.estimatedIncome ?? 0),
      icon: PesoIcon,
    },
    {
      label: "Today's Income",
      value: formatCurrency(stats?.totalIncome ?? 0),
      icon: PesoIcon,
    },
    {
      label: "Today's Expenses",
      value: formatCurrency(stats?.totalExpenses ?? 0),
      icon: Receipt,
    },
    {
      label: "Inventory Stock Value",
      value: formatCurrency(stats?.inventoryAssetValue ?? 0),
      icon: Package,
    },
    {
      label: 'Net Profit',
      value: formatCurrency(stats?.netProfit ?? 0),
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowBookingForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          New Booking
        </button>
        <button
          onClick={() => setShowExpenseForm(true)}
          className="btn-gold flex items-center gap-2 text-sm"
        >
          <Receipt size={16} />
          Add Expense
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="stat-card border border-gray-200 bg-white"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-charcoal">
                <card.icon size={18} className="text-charcoal" />
              </div>
            </div>
            {statsLoading ? (
              <div className="skeleton h-8 w-24 mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-heading font-extrabold text-charcoal truncate">
                {card.value}
              </p>
            )}
            <p className="text-xs text-gray-500 font-medium mt-1 truncate">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Chart + Recent Bookings */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-3 card-premium p-5">
          <h3 className="font-heading font-semibold text-charcoal mb-4">Weekly Overview</h3>
          <div className="h-64">
            {chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#888' }} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="income" name="Income" fill="#0A3D2E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="skeleton h-full w-full" />
              </div>
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2 card-premium p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-charcoal">Recent Bookings</h3>
            <Link to="/bookings" className="text-xs text-emerald hover:text-gold flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {bookingsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))
            ) : recentBookings?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No bookings yet</p>
            ) : (
              recentBookings?.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-1 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: b.staff?.color_code || '#0A3D2E' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{b.client_name}</p>
                    <p className="text-xs text-gray-400">
                      {b.services?.name} • {formatDate(b.booking_date)} {formatTime(b.start_time)}
                    </p>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', getStatusColor(b.status))}>
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <BookingForm onClose={() => setShowBookingForm(false)} />
      )}

      {/* Add Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg text-charcoal">Add Salon Expense</h3>
              <button onClick={() => setShowExpenseForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleExpenseSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Expense Description *</label>
                <input
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Shampoo, Hair Dyes, Electric Bill"
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount (₱) *</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="500"
                    className="input-field"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value as any }))}
                    className="input-field"
                  >
                    <option value="supplies">Supplies</option>
                    <option value="utilities">Utilities</option>
                    <option value="rent">Rent</option>
                    <option value="salary">Salary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Expense Date</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpense.isPending}
                  className="flex-1 btn-gold text-sm disabled:opacity-50"
                >
                  {createExpense.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
