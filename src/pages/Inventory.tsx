import { useState, useEffect } from 'react'
import {
  Package, AlertTriangle, Clock, Plus, Search, X, Edit2, Trash2,
  Check, Calendar, Scissors, Sparkles, Filter, AlertCircle,
  ShoppingCart, UserCheck, History, Tag, ShoppingBag
} from 'lucide-react'
import {
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '@/hooks/useInventory'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate, getTodayISO } from '@/lib/utils'
import type { InventoryItem } from '@/lib/database.types'
import toast from 'react-hot-toast'

interface POSLog {
  id: string
  product_name: string
  category: string
  usage_type: 'service' | 'retail'
  qty: number
  client_name: string
  amount: number
  unit_cost: number
  date: string
}

const INITIAL_POS_LOGS: POSLog[] = [
  {
    id: 'pos-1',
    product_name: 'L’Oréal Majirel Permanent Hair Color 50ml',
    category: 'Hair',
    usage_type: 'service',
    qty: 1,
    client_name: 'Maria Santos (Full Hair Color)',
    amount: 500,
    unit_cost: 320,
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'pos-2',
    product_name: 'Olaplex No. 3 Hair Perfector 100ml',
    category: 'Hair',
    usage_type: 'retail',
    qty: 1,
    client_name: 'Karla Gomez (Retail Take-Home)',
    amount: 1500,
    unit_cost: 800,
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
]

export default function Inventory() {
  const queryClient = useQueryClient()
  const { data: inventoryData, isLoading, refetch } = useInventoryItems()
  const items = inventoryData
  const createItem = useCreateInventoryItem()
  const updateItem = useUpdateInventoryItem()
  const deleteItem = useDeleteInventoryItem()

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Hair' | 'Nails' | 'Other'>('All')
  const [alertFilter, setAlertFilter] = useState<'all' | 'low_stock' | 'near_expiry'>('all')

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showPosModal, setShowPosModal] = useState(false)


  // POS Recent Logs state
  const [posLogs, setPosLogs] = useState<POSLog[]>(() => {
    const stored = localStorage.getItem('marquevedo_pos_logs')
    return stored ? JSON.parse(stored) : INITIAL_POS_LOGS
  })

  // Add/Edit Product Form
  const [form, setForm] = useState({
    name: '',
    category: 'Hair' as 'Hair' | 'Nails' | 'Other',
    unit_cost: 0, // Buying Price
    retail_price: 0, // Selling Price
    stock_quantity: 10,
    min_threshold: 5,
    expiry_date: '',
  })

  // POS / Client Usage Form State
  const [posForm, setPosForm] = useState({
    product_id: '',
    usage_type: 'service' as 'service' | 'retail',
    qty: 1,
    client_name: '',
    amount: 0,
  })

  // POS Searchable Combobox State
  const [posSearchQuery, setPosSearchQuery] = useState('')
  const [isPosDropdownOpen, setIsPosDropdownOpen] = useState(false)

  // Filtered products for POS modal dropdown
  const filteredPosProducts = (items || []).filter(item =>
    item.name.toLowerCase().includes(posSearchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(posSearchQuery.toLowerCase())
  )

  // Listen for top bar event
  useEffect(() => {
    const handleOpenTopBarPos = () => {
      setShowPosModal(true)
    }
    window.addEventListener('open-pos-modal', handleOpenTopBarPos)
    return () => window.removeEventListener('open-pos-modal', handleOpenTopBarPos)
  }, [])

  // When selected POS product changes, auto-fill amount
  const handlePosProductChange = (productId: string, newUsageType?: 'service' | 'retail', newQty?: number) => {
    const selected = (items || []).find(i => i.id === productId)
    setPosForm(prev => {
      const type = newUsageType || prev.usage_type
      const qty = newQty || prev.qty
      if (selected) {
        const defaultAmount = selected.retail_price > 0
          ? selected.retail_price
          : selected.unit_cost
        return {
          ...prev,
          product_id: productId,
          usage_type: type,
          qty: qty,
          amount: defaultAmount * qty,
        }
      }
      return { ...prev, product_id: productId, usage_type: type, qty: qty }
    })
  }

  // Submit POS / Product Used for Client
  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!posForm.product_id) {
      toast.error('Please select a product used')
      return
    }

    const targetItem = (items || []).find(i => i.id === posForm.product_id)
    if (!targetItem) return

    if (targetItem.stock_quantity < posForm.qty) {
      toast.error(`Not enough stock! Current stock: ${targetItem.stock_quantity}`)
      return
    }

    try {
      // 1. Deduct stock quantity
      const newStock = Math.max(0, targetItem.stock_quantity - posForm.qty)
      await updateItem.mutateAsync({
        id: targetItem.id,
        updates: { stock_quantity: newStock },
      })

      // 2. Add POS Log entry
      const newLog: POSLog = {
        id: `pos-${Date.now()}`,
        product_name: targetItem.name,
        category: targetItem.category,
        usage_type: posForm.usage_type,
        qty: posForm.qty,
        client_name: posForm.client_name || 'Walk-in Client',
        amount: Number(posForm.amount),
        unit_cost: Number(targetItem.unit_cost) || 0,
        date: `${getTodayISO()}T${new Date().toTimeString().split(' ')[0]}`,
      }

      const updatedLogs = [newLog, ...posLogs]
      setPosLogs(updatedLogs)
      localStorage.setItem('marquevedo_pos_logs', JSON.stringify(updatedLogs))

      toast.success(
        `Recorded product usage! Deducted ${posForm.qty} unit(s) of ${targetItem.name}. Remaining stock: ${newStock}`,
        { duration: 5000 }
      )

      window.dispatchEvent(new Event('pos_logs_updated'))
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      setShowPosModal(false)
      setPosSearchQuery('')
      setPosForm({
        product_id: '',
        usage_type: 'service',
        qty: 1,
        client_name: '',
        amount: 0,
      })
    } catch {
      toast.error('Failed to log product usage')
    }
  }

  // Open modal for new product
  const handleOpenAddModal = () => {
    setEditingItem(null)
    setForm({
      name: '',
      category: 'Hair',
      unit_cost: 300,
      retail_price: 500,
      stock_quantity: 10,
      min_threshold: 5,
      expiry_date: '',
    })
    setShowAddEditModal(true)
  }

  // Open modal for editing product
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      category: item.category || 'Hair',
      unit_cost: item.unit_cost || 0,
      retail_price: item.retail_price || 0,
      stock_quantity: item.stock_quantity || 0,
      min_threshold: item.min_threshold || 5,
      expiry_date: item.expiry_date || '',
    })
    setShowAddEditModal(true)
  }

  // Submit Add / Edit
  const handleAddEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) {
      toast.error('Please enter product name')
      return
    }

    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          updates: {
            name: form.name,
            category: form.category,
            unit_cost: Number(form.unit_cost),
            retail_price: Number(form.retail_price),
            stock_quantity: Number(form.stock_quantity),
            min_threshold: Number(form.min_threshold),
            expiry_date: form.expiry_date || null,
          },
        })
        toast.success('Product updated successfully!')
      } else {
        await createItem.mutateAsync({
          name: form.name,
          category: form.category,
          unit_cost: Number(form.unit_cost),
          retail_price: Number(form.retail_price),
          stock_quantity: Number(form.stock_quantity),
          min_threshold: Number(form.min_threshold),
          expiry_date: form.expiry_date || null,
        })
        toast.success('New product added to inventory!')
      }
      setShowAddEditModal(false)
      setEditingItem(null)
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  // Delete product
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await deleteItem.mutateAsync(id)
      toast.success('Product deleted')
      setShowAddEditModal(false)
      setEditingItem(null)
    } catch {
      toast.error('Failed to delete product')
    }
  }

  // Helper check: Is product expiring soon (within 90 days or expired)?
  const isExpiringSoon = (expiryDate?: string | null) => {
    if (!expiryDate) return false
    const exp = new Date(expiryDate).getTime()
    const now = new Date().getTime()
    const daysLeft = (exp - now) / (1000 * 3600 * 24)
    return daysLeft <= 90
  }

  // Summary Alerts Count
  const totalProducts = items?.length || 0
  const lowStockItems = (items || []).filter(i => i.stock_quantity <= i.min_threshold)
  const expiringItems = (items || []).filter(i => isExpiringSoon(i.expiry_date))

  // Filtered List
  const filteredList = (items || []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter

    let matchesAlert = true
    if (alertFilter === 'low_stock') matchesAlert = item.stock_quantity <= item.min_threshold
    if (alertFilter === 'near_expiry') matchesAlert = isExpiringSoon(item.expiry_date)

    return matchesSearch && matchesCategory && matchesAlert
  })

  return (
    <div className="space-y-6 font-body">
      {/* 1. Header Bar with POS Action Button */}
      <div className="card-premium p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-emerald">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-charcoal">Inventory &amp; Stock Control</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald/10 text-emerald text-xs font-bold border border-emerald/20">
              Live Stock
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Monitor low stock, track expiration dates, and log products used for client services or retail POS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* POS Button */}
          <button
            onClick={() => setShowPosModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <ShoppingCart size={16} /> Log Client Product Used (POS)
          </button>


          {/* Add Product */}
          <button
            onClick={handleOpenAddModal}
            className="btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 font-bold shadow-md"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* 2. Simple Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Products */}
        <div
          onClick={() => { setCategoryFilter('All'); setAlertFilter('all') }}
          className="card-premium p-4 flex items-center gap-3 cursor-pointer hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center text-emerald flex-shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Products</p>
            <p className="font-heading font-bold text-2xl text-charcoal">{totalProducts}</p>
          </div>
        </div>

        {/* Low Stock Monitor */}
        <div
          onClick={() => { setAlertFilter(alertFilter === 'low_stock' ? 'all' : 'low_stock') }}
          className={`card-premium p-4 flex items-center gap-3 cursor-pointer transition-all ${
            alertFilter === 'low_stock' ? 'ring-2 ring-amber-500 bg-amber-50/50' : 'hover:shadow-lg'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-amber-800 font-bold flex items-center gap-1">
              Low Stock Monitor
              {lowStockItems.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </p>
            <p className="font-heading font-bold text-2xl text-amber-600">{lowStockItems.length} <span className="text-xs text-gray-400 font-normal">items low</span></p>
          </div>
        </div>

        {/* Near Expiration Monitor */}
        <div
          onClick={() => { setAlertFilter(alertFilter === 'near_expiry' ? 'all' : 'near_expiry') }}
          className={`card-premium p-4 flex items-center gap-3 cursor-pointer transition-all ${
            alertFilter === 'near_expiry' ? 'ring-2 ring-red-500 bg-red-50/50' : 'hover:shadow-lg'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 flex-shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-red-800 font-bold flex items-center gap-1">
              Near Expiration (&lt;90 days)
              {expiringItems.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </p>
            <p className="font-heading font-bold text-2xl text-red-600">{expiringItems.length} <span className="text-xs text-gray-400 font-normal">expiring soon</span></p>
          </div>
        </div>
      </div>

      {/* 3. Filter & Controls Bar */}
      <div className="card-premium p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search product by name..."
            className="input-field pl-9 text-xs"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                categoryFilter === 'All' ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setCategoryFilter('Hair')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                categoryFilter === 'Hair' ? 'bg-emerald text-white shadow-sm' : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              <Scissors size={13} /> Hair
            </button>
            <button
              onClick={() => setCategoryFilter('Nails')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                categoryFilter === 'Nails' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              <Sparkles size={13} /> Nails
            </button>
            <button
              onClick={() => setCategoryFilter('Other')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                categoryFilter === 'Other' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              <Package size={13} /> Other
            </button>
          </div>
        </div>
      </div>

      {/* Alert Filter active indicator banner */}
      {alertFilter !== 'all' && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <Filter size={14} className="text-amber-600" />
            <span>
              Showing strictly: <strong>{alertFilter === 'low_stock' ? 'Low Stock Items Only' : 'Near Expiration Products Only'}</strong>
            </span>
          </div>
          <button
            onClick={() => setAlertFilter('all')}
            className="font-bold underline text-amber-700 hover:text-amber-900"
          >
            Reset Filter
          </button>
        </div>
      )}

      {/* 4. Products List Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 font-semibold">
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Buying Price (Cost)</th>
                <th className="p-3.5">Selling Price</th>
                <th className="p-3.5">Stock Qty</th>
                <th className="p-3.5">Threshold</th>
                <th className="p-3.5">Expiry Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-3.5"><div className="skeleton h-10 w-full" /></td>
                  </tr>
                ))
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredList.map(item => {
                  const isOut = item.stock_quantity === 0
                  const isLow = item.stock_quantity <= item.min_threshold && !isOut
                  const isExp = isExpiringSoon(item.expiry_date)

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenEditModal(item)}
                      className="hover:bg-emerald/5 transition-colors cursor-pointer group"
                    >
                      {/* Product Name */}
                      <td className="p-3.5">
                        <p className="font-bold text-charcoal group-hover:text-emerald transition-colors">{item.name}</p>
                      </td>

                      {/* Category Tag */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          item.category === 'Hair'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.category === 'Nails'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.category === 'Hair' ? <Scissors size={11} /> : item.category === 'Nails' ? <Sparkles size={11} /> : <Package size={11} />}
                          {item.category}
                        </span>
                      </td>

                      {/* Buying Price */}
                      <td className="p-3.5 font-semibold text-charcoal">
                        {formatCurrency(item.unit_cost)}
                      </td>

                      {/* Selling Price */}
                      <td className="p-3.5 font-bold text-emerald">
                        {item.retail_price > 0 ? formatCurrency(item.retail_price) : '— (N/A)'}
                      </td>

                      {/* Stock Quantity & Badge */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-max ${
                          isOut
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : isLow
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.stock_quantity} units
                          {isLow && <AlertTriangle size={12} className="text-amber-700" />}
                          {isOut && <AlertCircle size={12} className="text-red-700 animate-pulse" />}
                        </span>
                      </td>

                      {/* Stock Threshold */}
                      <td className="p-3.5 text-gray-500 font-medium">
                        {item.min_threshold} units
                      </td>

                      {/* Expiry Date */}
                      <td className="p-3.5">
                        {item.expiry_date ? (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                            isExp ? 'bg-red-50 text-red-700 border border-red-200 font-bold' : 'text-gray-600'
                          }`}>
                            {formatDate(item.expiry_date)}
                            {isExp && <AlertTriangle size={12} className="text-red-600" />}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">No expiry</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit product"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PRODUCT POS / LOG CLIENT USAGE */}
      {/* ========================================================================= */}
      {showPosModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in my-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-emerald/10">
              <h3 className="font-heading font-bold text-base text-emerald-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-emerald" />
                Log Product Used for Client (POS)
              </h3>
              <button
                onClick={() => setShowPosModal(false)}
                className="p-1.5 rounded-lg hover:bg-emerald/20 text-emerald-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePosSubmit} className="p-5 space-y-4 text-xs">
              {/* Searchable Select Product Combobox */}
              <div className="relative">
                <label className="block font-bold text-gray-700 mb-1">Select Product Used *</label>
                
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={posSearchQuery}
                    onChange={e => {
                      setPosSearchQuery(e.target.value)
                      setIsPosDropdownOpen(true)
                      if (!e.target.value) {
                        setPosForm({ ...posForm, product_id: '', amount: 0 })
                      }
                    }}
                    onFocus={() => setIsPosDropdownOpen(true)}
                    placeholder="Type to search product name (e.g., L'Oreal, Shampoo)..."
                    className="input-field pl-9 pr-8 font-semibold text-xs text-charcoal bg-white"
                  />
                  {posSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setPosSearchQuery('')
                        setPosForm({ ...posForm, product_id: '', amount: 0 })
                        setIsPosDropdownOpen(true)
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown Options List */}
                {isPosDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsPosDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-gray-50">
                      {filteredPosProducts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">
                          No matching products found.
                        </div>
                      ) : (
                        filteredPosProducts.map(item => {
                          const isOut = item.stock_quantity === 0
                          const isSelected = item.id === posForm.product_id

                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={isOut}
                              onClick={() => {
                                handlePosProductChange(item.id)
                                setPosSearchQuery(item.name)
                                setIsPosDropdownOpen(false)
                              }}
                              className={`w-full p-2.5 text-left flex items-center justify-between transition-colors ${
                                isOut
                                  ? 'opacity-50 bg-gray-50 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                                  : 'hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <p className="text-xs font-bold">{item.name}</p>
                                <p className="text-[10px] text-gray-400">
                                  Category: {item.category} • Cost: {formatCurrency(item.unit_cost)}
                                  {item.retail_price > 0 && ` • Retail: ${formatCurrency(item.retail_price)}`}
                                </p>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex-shrink-0 ${
                                isOut
                                  ? 'bg-red-100 text-red-700'
                                  : item.stock_quantity <= item.min_threshold
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isOut ? 'OUT OF STOCK' : `${item.stock_quantity} in stock`}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Usage Type: Client Service (Backbar) vs Retail Sale */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Usage Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (posForm.product_id) handlePosProductChange(posForm.product_id, 'service')
                      else setPosForm({ ...posForm, usage_type: 'service' })
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                      posForm.usage_type === 'service'
                        ? 'border-emerald bg-emerald-50 text-emerald-800 ring-2 ring-emerald/30'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Scissors size={14} className="text-emerald" /> Client Service (Backbar)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (posForm.product_id) handlePosProductChange(posForm.product_id, 'retail')
                      else setPosForm({ ...posForm, usage_type: 'retail' })
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                      posForm.usage_type === 'retail'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-500/30'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <ShoppingBag size={14} className="text-purple-600" /> Client Retail Sale
                    </span>
                  </button>
                </div>
              </div>

              {/* Quantity Used */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Quantity Used *</label>
                  <input
                    type="number"
                    min="1"
                    value={posForm.qty}
                    onChange={e => {
                      const newQty = Math.max(1, Number(e.target.value))
                      if (posForm.product_id) {
                        handlePosProductChange(posForm.product_id, posForm.usage_type, newQty)
                      } else {
                        setPosForm({ ...posForm, qty: newQty })
                      }
                    }}
                    className="input-field font-bold text-emerald"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Price / Value (₱)</label>
                  <input
                    type="number"
                    min="0"
                    value={posForm.amount}
                    onChange={e => setPosForm({ ...posForm, amount: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Client Name / Booking Notes */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Client Name / Service Notes (Optional)</label>
                <input
                  value={posForm.client_name}
                  onChange={e => setPosForm({ ...posForm, client_name: e.target.value })}
                  placeholder="e.g. Client Karla (Hair Coloring & Blowout)"
                  className="input-field"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPosModal(false)}
                  className="btn-outline py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Check size={16} /> Confirm Usage &amp; Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT PRODUCT MODAL */}
      {/* ========================================================================= */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in my-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-heading font-bold text-base text-charcoal flex items-center gap-2">
                <Package size={18} className="text-emerald" />
                {editingItem ? 'Edit Product Details' : 'Add New Inventory Product'}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddEditSubmit} className="p-5 space-y-4 text-xs">
              {/* Product Name */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Product Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. L’Oréal Majirel Color 50ml"
                  className="input-field"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Category / Department *</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as any })}
                  className="input-field"
                >
                  <option value="Hair">Hair (Shampoo, Color, Treatments)</option>
                  <option value="Nails">Nails (Gel Polish, Acrylics, Lotions)</option>
                  <option value="Other">Other (Sanitizers, Accessories)</option>
                </select>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Buying Price (Cost ₱) *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.unit_cost}
                    onChange={e => setForm({ ...form, unit_cost: Number(e.target.value) })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Selling Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.retail_price}
                    onChange={e => setForm({ ...form, retail_price: Number(e.target.value) })}
                    className="input-field"
                    placeholder="0 for internal salon use"
                  />
                </div>
              </div>

              {/* Stock Quantity & Min Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock_quantity}
                    onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                    className="input-field font-bold text-emerald"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Low Stock Threshold *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.min_threshold}
                    onChange={e => setForm({ ...form, min_threshold: Number(e.target.value) })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingItem.id)}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEditModal(false)}
                    className="btn-outline py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary py-2 px-5 font-bold"
                  >
                    {editingItem ? 'Save Changes' : 'Add Product'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  )
}
