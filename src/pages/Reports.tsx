import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  History, Search, Calendar, Filter, Receipt, Package, Scissors,
  TrendingUp, TrendingDown, X, Check, Eye, AlertCircle, ShoppingBag, ArrowUpRight
} from 'lucide-react'
import { PesoIcon } from '@/components/common/PesoIcon'

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'

interface HistoryItem {
  id: string
  type: 'expense' | 'product_pos' | 'product_backbar' | 'booking'
  title: string
  category: string
  date: string
  display_date: string
  amount: number
  unit_cost?: number
  qty?: number
  client_name?: string
  staff_name?: string
  details?: string
  status?: string
  raw_data?: any
}

function getDateRange(period: Period, customStart: string, customEnd: string) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  switch (period) {
    case 'today':
      return { start: today, end: today }
    case 'week': {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      return { start: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`, end: today }
    }
    case 'month': {
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: today }
    }
    case 'year': {
      return { start: `${now.getFullYear()}-01-01`, end: today }
    }
    case 'custom':
      return { start: customStart || '2000-01-01', end: customEnd || today }
    case 'all':
    default:
      return { start: '2000-01-01', end: '2099-12-31' }
  }
}

export default function HistoryPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'expenses' | 'bookings'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null)

  const { start, end } = useMemo(() => getDateRange(period, customStart, customEnd), [period, customStart, customEnd])

  // 1. Fetch Expenses from Supabase
  const { data: expensesData } = useQuery({
    queryKey: ['history', 'expenses', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, staff(name)')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false })
      if (error) return []
      return (data || []) as any[]
    },
  })

  // 2. Fetch Bookings from Supabase
  const { data: bookingsData } = useQuery({
    queryKey: ['history', 'bookings', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .gte('booking_date', start)
        .lte('booking_date', end)
        .neq('status', 'cancelled')
        .order('booking_date', { ascending: false })
      if (error) return []
      return (data || []) as any[]
    },
  })

  // 3. Load POS & Product Usage logs from LocalStorage
  const [posSignal, setPosSignal] = useState(0)

  useEffect(() => {
    const handleUpdate = () => setPosSignal(s => s + 1)
    window.addEventListener('pos_logs_updated', handleUpdate)
    return () => window.removeEventListener('pos_logs_updated', handleUpdate)
  }, [])

  const posLogsData = useMemo(() => {
    try {
      const cached = localStorage.getItem('marquevedo_pos_logs')
      if (!cached) return []
      const logs = JSON.parse(cached) as any[]
      return logs.filter((log: any) => {
        if (!log.date) return true
        const logDate = log.date.split('T')[0]
        return logDate >= start && logDate <= end
      })
    } catch {
      return []
    }
  }, [start, end, posSignal])

  // Combine all items into a unified history timeline list
  const allHistoryItems = useMemo(() => {
    const items: HistoryItem[] = []

    // Add Expenses
    expensesData?.forEach((exp: any) => {
      items.push({
        id: `exp-${exp.id}`,
        type: 'expense',
        title: exp.description || `Expense (${exp.category})`,
        category: exp.category ? exp.category.charAt(0).toUpperCase() + exp.category.slice(1) : 'Expense',
        date: exp.expense_date,
        display_date: exp.created_at || exp.expense_date,
        amount: Number(exp.amount) || 0,
        staff_name: exp.staff?.name || 'Admin',
        details: `Category: ${exp.category}. Description: ${exp.description || 'N/A'}. Logged for salon operations.`,
        raw_data: exp,
      })
    })

    // Add Bookings (Completed / Confirmed)
    bookingsData?.forEach((b: any) => {
      items.push({
        id: `book-${b.id}`,
        type: 'booking',
        title: b.services?.name || 'Salon Treatment',
        category: b.services?.category || 'Service',
        date: b.booking_date,
        display_date: b.created_at || `${b.booking_date}T${b.start_time || '00:00:00'}`,
        amount: Number(b.total_price) || 0,
        unit_cost: Number(b.services?.estimated_cost) || 0,
        qty: 1,
        client_name: b.client_name || 'Client',
        staff_name: b.staff?.name || 'Any Stylist',
        status: b.status,
        details: `Service appointment for ${b.client_name}. Status: ${b.status.toUpperCase()}. Duration: ${b.services?.duration_minutes || 60} mins.`,
        raw_data: b,
      })
    })

    // Add POS & Backbar Product Usage Logs
    posLogsData.forEach((log: any) => {
      const isRetail = log.usage_type === 'retail'
      items.push({
        id: log.id || `pos-${Math.random()}`,
        type: isRetail ? 'product_pos' : 'product_backbar',
        title: log.product_name || 'Salon Product',
        category: log.category || (isRetail ? 'Retail Sale' : 'Backbar Client Usage'),
        date: log.date ? log.date.split('T')[0] : '2026-07-28',
        display_date: log.date || '2026-07-28T00:00:00.000Z',
        amount: Number(log.amount) || 0,
        unit_cost: Number(log.unit_cost) || 0,
        qty: Number(log.qty) || 1,
        client_name: log.client_name || (isRetail ? 'Retail Customer' : 'Client Treatment'),
        staff_name: 'Stylist / Staff',
        details: isRetail
          ? `Retail sale to ${log.client_name || 'Customer'}. Sold ${log.qty} unit(s) @ ${formatCurrency(log.amount / (log.qty || 1))} each.`
          : `Internal backbar usage for client ${log.client_name || 'Treatment'}. Used ${log.qty} unit(s) of ${log.product_name}.`,
        raw_data: log,
      })
    })

    // Sort descending by exact date and time
    return items.sort((a, b) => (b.display_date > a.display_date ? 1 : b.display_date < a.display_date ? -1 : 0))
  }, [expensesData, bookingsData, posLogsData])

  // Filtered by Search & Tab
  const filteredItems = useMemo(() => {
    return allHistoryItems.filter((item) => {
      // 1. Tab Filter
      if (activeTab === 'products' && item.type !== 'product_pos' && item.type !== 'product_backbar') return false
      if (activeTab === 'expenses' && item.type !== 'expense') return false
      if (activeTab === 'bookings' && item.type !== 'booking') return false

      // 2. Search Query Filter
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.client_name && item.client_name.toLowerCase().includes(query)) ||
        (item.staff_name && item.staff_name.toLowerCase().includes(query)) ||
        (item.details && item.details.toLowerCase().includes(query))
      )
    })
  }, [allHistoryItems, activeTab, searchQuery])

  // Overall Statistics Calculations
  const stats = useMemo(() => {
    let servicePriceTotal = 0
    let posRetailPriceTotal = 0
    let totalExpenses = 0
    let totalEstProductCost = 0

    filteredItems.forEach((item) => {
      if (item.type === 'booking') {
        if (item.status === 'completed') {
          servicePriceTotal += item.amount
          totalEstProductCost += item.unit_cost || 0
        }
      } else if (item.type === 'product_pos') {
        totalEstProductCost += (item.unit_cost || 0) * (item.qty || 1)
        posRetailPriceTotal += item.amount
      } else if (item.type === 'product_backbar') {
        // Backbar costs are ignored for Net Profit (assumed covered by service estimated cost)
      } else if (item.type === 'expense') {
        totalExpenses += item.amount
      }
    })

    const totalIncome = servicePriceTotal + posRetailPriceTotal
    const netProfit = (servicePriceTotal + posRetailPriceTotal) - totalEstProductCost
    const totalTransactionsCount = filteredItems.length

    return {
      totalIncome,
      totalExpenses,
      totalEstProductCost,
      netProfit,
      totalTransactionsCount,
    }
  }, [filteredItems])

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal flex items-center gap-2">
            <History size={26} className="text-emerald" /> History & Audit Logs
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitor all recorded salon expenses, client product usage, POS retail sales, and transactions in real-time.
          </p>
        </div>

        {/* Date Filter Quick Buttons */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {(['today', 'week', 'month', 'year', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p)
                setShowCustomPicker(false)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                period === p && !showCustomPicker
                  ? 'bg-emerald text-white shadow-sm'
                  : 'text-gray-600 hover:text-charcoal hover:bg-gray-50'
              }`}
            >
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : p === 'all' ? 'All Time' : 'Today'}
            </button>
          ))}

          <button
            onClick={() => {
              setPeriod('custom')
              setShowCustomPicker(!showCustomPicker)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              showCustomPicker || period === 'custom'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-charcoal hover:bg-gray-50'
            }`}
          >
            <Calendar size={13} /> Custom Date
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Accordion */}
      {showCustomPicker && (
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex flex-wrap items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-amber-900">Start Date:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="input-field text-xs bg-white border-amber-300 py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-amber-900">End Date:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="input-field text-xs bg-white border-amber-300 py-1.5"
            />
          </div>

          <button
            onClick={() => setPeriod('custom')}
            className="btn-primary text-xs py-2 px-4 font-bold shadow-sm"
          >
            Apply Date Range
          </button>
        </div>
      )}

      {/* 2. Top Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="card-premium p-4 flex items-center gap-3.5 border-gray-200 hover:border-gray-400 transition-all">
          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 text-charcoal flex items-center justify-center flex-shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Sales / Income</p>
            <p className="font-heading font-extrabold text-xl sm:text-2xl text-charcoal">
              {formatCurrency(stats.totalIncome)}
            </p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="card-premium p-4 flex items-center gap-3.5 border-gray-200 hover:border-gray-400 transition-all">
          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 text-charcoal flex items-center justify-center flex-shrink-0">
            <TrendingDown size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Expenses</p>
            <p className="font-heading font-extrabold text-xl sm:text-2xl text-charcoal">
              {formatCurrency(stats.totalExpenses)}
            </p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="card-premium p-4 flex items-center gap-3.5 border-gray-200 hover:border-gray-400 transition-all">
          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 text-charcoal flex items-center justify-center flex-shrink-0">
            <PesoIcon size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Net Profit</p>
            <p className="font-heading font-extrabold text-xl sm:text-2xl text-charcoal">
              {formatCurrency(stats.netProfit)}
            </p>
          </div>
        </div>

        {/* Total Transactions Count */}
        <div className="card-premium p-4 flex items-center gap-3.5 border-gray-200 hover:border-gray-400 transition-all">
          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 text-charcoal flex items-center justify-center flex-shrink-0">
            <Receipt size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Transactions Count</p>
            <p className="font-heading font-extrabold text-xl sm:text-2xl text-charcoal">
              {stats.totalTransactionsCount}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Search Bar & Sub-Tabs Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Category Sub-Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'all' ? 'bg-white text-emerald shadow-sm font-extrabold' : 'text-gray-600 hover:text-charcoal'
            }`}
          >
            All History ({allHistoryItems.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'products' ? 'bg-white text-emerald shadow-sm font-extrabold' : 'text-gray-600 hover:text-charcoal'
            }`}
          >
            Product Usage & POS ({allHistoryItems.filter((i) => i.type === 'product_pos' || i.type === 'product_backbar').length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'expenses' ? 'bg-white text-emerald shadow-sm font-extrabold' : 'text-gray-600 hover:text-charcoal'
            }`}
          >
            Expenses ({allHistoryItems.filter((i) => i.type === 'expense').length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'bookings' ? 'bg-white text-emerald shadow-sm font-extrabold' : 'text-gray-600 hover:text-charcoal'
            }`}
          >
            Services ({allHistoryItems.filter((i) => i.type === 'booking').length})
          </button>
        </div>

        {/* Real-time Product & History Search Bar */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, expense, or client..."
            className="input-field pl-9 text-xs py-2 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. History Data List / Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <History size={36} className="mx-auto text-gray-300" />
            <p className="font-semibold text-sm">No history records found.</p>
            <p className="text-xs">Try selecting a different date range or clearing your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Type / Category</th>
                  <th className="py-3.5 px-4">Item & Description</th>
                  <th className="py-3.5 px-4 text-center">Qty / Usage</th>
                  <th className="py-3.5 px-4 text-right">Amount (₱)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => {
                  const isExpense = item.type === 'expense'
                  const isPOS = item.type === 'product_pos'
                  const isBackbar = item.type === 'product_backbar'
                  const isBooking = item.type === 'booking'

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-gray-700">
                        {new Date(item.display_date).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Type & Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isExpense
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isPOS
                              ? 'bg-emerald-50 text-emerald border border-emerald-200'
                              : isBackbar
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isExpense && <TrendingDown size={11} />}
                          {isPOS && <ShoppingBag size={11} />}
                          {isBackbar && <Package size={11} />}
                          {isBooking && <Scissors size={11} />}
                          {item.category}
                        </span>
                      </td>

                      {/* Title & Client/Staff */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-charcoal group-hover:text-emerald transition-colors text-sm">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.client_name ? `Client: ${item.client_name}` : ''}{' '}
                          {item.staff_name ? `• Stylist: ${item.staff_name}` : ''}
                        </p>
                      </td>

                      {/* Qty / Usage */}
                      <td className="py-3.5 px-4 text-center font-semibold text-gray-700">
                        {isExpense ? '1' : `${item.qty || 1} unit(s)`}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-heading font-extrabold text-sm ${
                            isExpense ? 'text-rose-600' : 'text-emerald'
                          }`}
                        >
                          {isExpense ? `-${formatCurrency(item.amount)}` : formatCurrency(item.amount)}
                        </span>
                      </td>

                      {/* View Details Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItem(item)
                          }}
                          className="btn-outline text-[11px] py-1 px-3 font-semibold text-emerald hover:bg-emerald hover:text-white transition-all shadow-sm"
                        >
                          <Eye size={12} className="inline mr-1" /> View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Item Click Detailed Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in border border-gray-100">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#0A3D2E] to-[#125A45] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-gold">
                  {selectedItem.type === 'expense' && <TrendingDown size={20} />}
                  {selectedItem.type === 'product_pos' && <ShoppingBag size={20} />}
                  {selectedItem.type === 'product_backbar' && <Package size={20} />}
                  {selectedItem.type === 'booking' && <Scissors size={20} />}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-white">{selectedItem.title}</h3>
                  <span className="text-[10px] font-bold text-gold uppercase tracking-wider bg-gold/20 px-2 py-0.5 rounded-md">
                    {selectedItem.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs">
              {/* Financial Summary */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total Transaction Value
                  </span>
                  <span
                    className={`font-heading font-extrabold text-2xl ${
                      selectedItem.type === 'expense' ? 'text-rose-600' : 'text-emerald'
                    }`}
                  >
                    {formatCurrency(selectedItem.amount)}
                  </span>
                </div>

                {selectedItem.unit_cost && selectedItem.unit_cost > 0 ? (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Buying / Est Cost
                    </span>
                    <span className="font-bold text-amber-700 text-sm">
                      {formatCurrency(selectedItem.unit_cost * (selectedItem.qty || 1))}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Date & Time Recorded</span>
                  <span className="font-semibold text-charcoal">{selectedItem.display_date}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Quantity / Units</span>
                  <span className="font-semibold text-charcoal">{selectedItem.qty || 1} unit(s)</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Client / Recipient</span>
                  <span className="font-semibold text-charcoal">{selectedItem.client_name || 'N/A'}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Staff Specialist</span>
                  <span className="font-semibold text-charcoal">{selectedItem.staff_name || 'Admin'}</span>
                </div>
              </div>

              {/* Full Description & Audit Log Notes */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-1">
                <span className="text-[10px] font-bold text-emerald uppercase tracking-wider block">
                  Audit Log Details & Notes
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {selectedItem.details || 'Recorded in MarQuevedo Hair Studio audit log system.'}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="btn-primary text-xs py-2.5 px-5 font-bold shadow-md"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
