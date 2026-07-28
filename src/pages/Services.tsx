import { useState } from 'react'
import { Plus, Edit2, Trash2, Scissors, Hand, Sparkles, X } from 'lucide-react'
import { useServices, useCreateService, useUpdateService, useDeleteService } from '@/hooks/useServices'
import { formatCurrency, formatDuration, cn } from '@/lib/utils'
import type { Service } from '@/lib/database.types'
import toast from 'react-hot-toast'

const categoryIcons: Record<string, any> = {
  Hair: Scissors,
  Nails: Hand,
  Other: Sparkles,
}

const categoryColors: Record<string, string> = {
  Hair: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Nails: 'bg-pink-50 text-pink-700 border-pink-200',
  Other: 'bg-purple-50 text-purple-700 border-purple-200',
}

function parseDurationStringToMinutes(str: string, unit: 'mins' | 'hrs'): number {
  if (!str) return 0
  const trimmed = str.trim()

  if (unit === 'hrs') {
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':')
      const hours = parseFloat(parts[0]) || 0
      const minutes = parseFloat(parts[1]) || 0
      return Math.round(hours * 60 + minutes)
    }
    const val = parseFloat(trimmed) || 0
    return Math.round(val * 60)
  }

  return Math.round(parseFloat(trimmed) || 0)
}

function formatMinutesForUnit(totalMins: number, unit: 'mins' | 'hrs'): string {
  if (!totalMins || totalMins <= 0) return '0'
  if (unit === 'mins') return totalMins.toString()

  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (m === 0) return h.toString()
  return `${h}:${m.toString().padStart(2, '0')}`
}

export default function Services() {
  const { data: services, isLoading } = useServices()
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()
  const [showForm, setShowForm] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)

  const [form, setForm] = useState({
    name: '',
    category: 'Hair' as 'Hair' | 'Nails' | 'Other',
    price: '',
    estimated_cost: '',
    duration_value: '60',
    duration_unit: 'mins' as 'mins' | 'hrs',
    is_active: true,
  })

  const openCreate = () => {
    setEditService(null)
    setForm({
      name: '',
      category: 'Hair',
      price: '',
      estimated_cost: '',
      duration_value: '60',
      duration_unit: 'mins',
      is_active: true,
    })
    setShowForm(true)
  }

  const openEdit = (service: Service) => {
    setEditService(service)
    const isHoursMode = service.duration_minutes >= 60
    const unit = isHoursMode ? 'hrs' : 'mins'
    setForm({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      estimated_cost: service.estimated_cost?.toString() || '0',
      duration_value: formatMinutesForUnit(service.duration_minutes, unit),
      duration_unit: unit,
      is_active: service.is_active,
    })
    setShowForm(true)
  }

  const handleUnitChange = (newUnit: 'mins' | 'hrs') => {
    if (newUnit === form.duration_unit) return
    const currentMins = parseDurationStringToMinutes(form.duration_value, form.duration_unit)
    const newValue = formatMinutesForUnit(currentMins, newUnit)
    setForm(prev => ({
      ...prev,
      duration_unit: newUnit,
      duration_value: newValue,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast.error('Name and price are required')
      return
    }

    const duration_minutes = parseDurationStringToMinutes(form.duration_value, form.duration_unit)

    if (duration_minutes <= 0) {
      toast.error('Duration must be greater than 0')
      return
    }

    try {
      if (editService) {
        await updateService.mutateAsync({
          id: editService.id,
          updates: {
            name: form.name,
            category: form.category,
            price: parseFloat(form.price),
            estimated_cost: parseFloat(form.estimated_cost || '0'),
            duration_minutes,
            is_active: form.is_active,
          },
        })
        toast.success('Service updated!')
      } else {
        await createService.mutateAsync({
          name: form.name,
          category: form.category,
          price: parseFloat(form.price),
          estimated_cost: parseFloat(form.estimated_cost || '0'),
          duration_minutes,
          is_active: form.is_active,
        })
        toast.success('Service created!')
      }
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message || 'Error saving service')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return
    try {
      await deleteService.mutateAsync(id)
      toast.success('Service deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Group by category
  const grouped = services?.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<string, Service[]>) || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{services?.length ?? 0} services</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Service
        </button>
      </div>

      {/* Services by Category */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const Icon = categoryIcons[category] || Sparkles
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={18} className="text-emerald" />
                <h3 className="font-heading font-semibold text-charcoal">{category}</h3>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(service => (
                  <div
                    key={service.id}
                    className={cn(
                      "card-premium p-4 group",
                      !service.is_active && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-charcoal">{service.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-lg font-heading font-bold text-emerald">
                            {formatCurrency(service.price)}
                          </p>
                          {service.estimated_cost > 0 && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Est Cost: {formatCurrency(service.estimated_cost)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">{formatDuration(service.duration_minutes)}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(service)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(service.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {!service.is_active && (
                      <span className="text-[10px] text-red-500 font-medium mt-2 inline-block">Inactive</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Service Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg">
                {editService ? 'Edit Service' : 'New Service'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value as any }))}
                  className="input-field"
                >
                  <option value="Hair">Hair</option>
                  <option value="Nails">Nails</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Price (₱) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                    className="input-field font-bold text-emerald"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Est. Product Cost (₱)</label>
                  <input
                    type="number"
                    value={form.estimated_cost}
                    onChange={e => setForm(prev => ({ ...prev, estimated_cost: e.target.value }))}
                    className="input-field font-semibold text-amber-800"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Duration</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={form.duration_value}
                      onChange={e => setForm(prev => ({ ...prev, duration_value: e.target.value }))}
                      className="input-field flex-1 font-medium"
                      placeholder={form.duration_unit === 'hrs' ? "e.g. 1:30" : "e.g. 60"}
                      required
                    />
                    <select
                      value={form.duration_unit}
                      onChange={e => handleUnitChange(e.target.value as 'mins' | 'hrs')}
                      className="input-field w-20 px-1.5 text-xs font-bold text-gray-700 bg-gray-50 border-gray-200 cursor-pointer"
                    >
                      <option value="mins">min</option>
                      <option value="hrs">hour</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-emerald"
                  id="service-active"
                />
                <label htmlFor="service-active" className="text-sm text-gray-600">Active</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary text-sm" disabled={createService.isPending || updateService.isPending}>
                  {editService ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
