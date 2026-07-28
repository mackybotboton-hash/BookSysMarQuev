import { useState } from 'react'
import {
  Plus, Edit2, Trash2, X, Check, Scissors, Star, User, Crown,
  Sparkles, Palette, Heart, Shield, Award, Zap
} from 'lucide-react'
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from '@/hooks/useStaff'
import { formatCurrency, cn } from '@/lib/utils'
import type { Staff } from '@/lib/database.types'
import toast from 'react-hot-toast'

export const PRESET_AVATARS = [
  { color: '#0A3D2E', label: 'Emerald Hair Stylist', icon: Scissors },
  { color: '#D4AF37', label: 'Gold Star Specialist', icon: Star },
  { color: '#2563EB', label: 'Royal Barber Master', icon: User },
  { color: '#DC2626', label: 'Crimson Director', icon: Crown },
  { color: '#7C3AED', label: 'Purple Nail Artist', icon: Sparkles },
  { color: '#059669', label: 'Jade Color Master', icon: Palette },
  { color: '#DB2777', label: 'Rose Beauty Expert', icon: Heart },
  { color: '#EA580C', label: 'Orange Spa Master', icon: Shield },
  { color: '#4F46E5', label: 'Indigo Senior Specialist', icon: Award },
  { color: '#0891B2', label: 'Cyan Stylist', icon: Zap },
]

export function getStaffAvatarIcon(colorCode?: string) {
  const match = PRESET_AVATARS.find(a => a.color === colorCode)
  return match ? match.icon : Scissors
}

export default function StaffPage() {
  const { data: staffList, isLoading } = useStaff()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const deleteStaff = useDeleteStaff()
  const [showForm, setShowForm] = useState(false)
  const [editStaffMember, setEditStaffMember] = useState<Staff | null>(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    daily_rate: '400',
    color_code: '#0A3D2E',
    is_active: true,
  })

  const openCreate = () => {
    setEditStaffMember(null)
    setForm({ name: '', phone: '', daily_rate: '400', color_code: '#0A3D2E', is_active: true })
    setShowForm(true)
  }

  const openEdit = (s: Staff) => {
    setEditStaffMember(s)
    setForm({
      name: s.name,
      phone: s.phone || '',
      daily_rate: s.daily_rate.toString(),
      color_code: s.color_code || '#0A3D2E',
      is_active: s.is_active,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) {
      toast.error('Name is required')
      return
    }
    try {
      if (editStaffMember) {
        await updateStaff.mutateAsync({
          id: editStaffMember.id,
          updates: {
            name: form.name,
            phone: form.phone,
            daily_rate: parseFloat(form.daily_rate),
            color_code: form.color_code,
            is_active: form.is_active,
          },
        })
        toast.success('Staff profile updated!')
      } else {
        await createStaff.mutateAsync({
          name: form.name,
          phone: form.phone,
          daily_rate: parseFloat(form.daily_rate),
          color_code: form.color_code,
          is_active: form.is_active,
        })
        toast.success('New staff member added!')
      }
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message || 'Error saving staff')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this staff member?')) return
    try {
      await deleteStaff.mutateAsync(id)
      toast.success('Staff member deleted')
    } catch {
      toast.error('Failed to delete staff member')
    }
  }

  return (
    <div className="space-y-6 font-body">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">{staffList?.length ?? 0} active staff members</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Staff Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full rounded-xl" />
          ))
        ) : staffList?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            No staff members added yet.
          </div>
        ) : (
          staffList?.map(s => {
            const avatarObj = PRESET_AVATARS.find(a => a.color === s.color_code) || PRESET_AVATARS[0]
            const IconComp = avatarObj.icon

            return (
              <div
                key={s.id}
                className={cn("card-premium p-5 group transition-all hover:shadow-lg", !s.is_active && "opacity-50")}
              >
                <div className="flex items-start gap-4">
                  {/* Telegram-style Circular Profile Avatar */}
                  <div
                    className="w-13 h-13 rounded-full flex items-center justify-center text-white font-heading font-bold text-lg flex-shrink-0 shadow-md relative group-hover:scale-105 transition-transform border-2 border-white"
                    style={{ backgroundColor: s.color_code || '#0A3D2E' }}
                  >
                    <IconComp size={22} className="text-white drop-shadow" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-charcoal text-base">{s.name}</h4>
                    {s.phone && <p className="text-xs text-gray-400 mt-0.5 font-medium">{s.phone}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-bold text-emerald">
                        {formatCurrency(s.daily_rate)}/day
                      </span>
                      {!s.is_active && (
                        <span className="text-[10px] text-red-500 font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Profile"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete Staff"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Staff Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in my-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-heading font-bold text-base text-charcoal">
                {editStaffMember ? 'Edit Staff Profile' : 'Add New Staff Member'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Staff Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Maria Santos"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="09XXXXXXXXX"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Daily Rate (₱)</label>
                <input
                  type="number"
                  value={form.daily_rate}
                  onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))}
                  className="input-field"
                  min="0"
                />
              </div>

              {/* Telegram-style Profile Avatar & Color Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Profile Avatar &amp; Theme Color</label>
                <div className="grid grid-cols-5 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  {PRESET_AVATARS.map((avatar) => {
                    const IconComp = avatar.icon
                    const isSelected = form.color_code === avatar.color

                    return (
                      <button
                        key={avatar.color}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, color_code: avatar.color }))}
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center text-white transition-all shadow-sm relative group mx-auto",
                          isSelected
                            ? "ring-4 ring-offset-2 ring-emerald-600 scale-110 shadow-md"
                            : "hover:scale-105 opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: avatar.color }}
                        title={avatar.label}
                      >
                        <IconComp size={18} className="text-white drop-shadow-sm" />
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-emerald rounded cursor-pointer"
                  id="staff-active"
                />
                <label htmlFor="staff-active" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Active Staff Member
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-outline text-xs py-2.5">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary text-xs py-2.5 font-bold" disabled={createStaff.isPending || updateStaff.isPending}>
                  {editStaffMember ? 'Save Profile' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
