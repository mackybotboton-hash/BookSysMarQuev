import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Trash2, Edit2, Info, X, RefreshCw } from 'lucide-react'
import { useBookings, useDeleteBooking, useUpdateBooking } from '@/hooks/useBookings'
import { formatCurrency, formatDate, formatTime, getStatusColor, cn } from '@/lib/utils'
import BookingForm from '@/components/bookings/BookingForm'
import toast from 'react-hot-toast'

export default function Bookings() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editBooking, setEditBooking] = useState<any>(null)

  // Cancellation Modal State
  const [cancelModalBookingId, setCancelModalBookingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Real-time listener for booking changes & cancellations
  useEffect(() => {
    const channel = supabase
      .channel('bookings_admin_page_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      })
      .subscribe()

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('marquevedo_booking_updates_bc') : null
    if (bc) {
      bc.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
      }
    }

    window.addEventListener('marquevedo_booking_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      supabase.removeChannel(channel)
      bc?.close()
      window.removeEventListener('marquevedo_booking_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [queryClient])

  const { data: bookings, isLoading } = useBookings({
    status: statusFilter || undefined,
    date: dateFilter || undefined,
  })
  const deleteBooking = useDeleteBooking()
  const updateBooking = useUpdateBooking()

  const cancelledIds = new Set<string>(JSON.parse(localStorage.getItem('marquevedo_cancelled_bookings') || '[]'))

  // Filter processed bookings: By default, remove cancelled bookings unless statusFilter === 'cancelled'
  const filtered = bookings
    ?.map(b => (cancelledIds.has(b.id) ? { ...b, status: 'cancelled' } : b))
    ?.filter(b => {
      if (statusFilter && b.status !== statusFilter) {
        return false
      }

      return (
        b.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (b as any).services?.name?.toLowerCase().includes(search.toLowerCase())
      )
    })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this booking?')) return
    try {
      await deleteBooking.mutateAsync(id)
      toast.success('Booking deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleStatusChange = async (id: string, newStatus: string, currentStatus: string) => {
    if (currentStatus === 'completed') {
      toast.error('Completed appointments are finalized and cannot be changed')
      return
    }

    if (newStatus === 'completed') {
      if (!confirm('Are you sure this appointment is COMPLETED? Once confirmed, it will be finalized and removed from the calendar view.')) {
        return
      }
    }

    if (newStatus === 'cancelled') {
      setCancelModalBookingId(id)
      return
    }

    try {
      await updateBooking.mutateAsync({ id, updates: { status: newStatus as any } })
      toast.success(newStatus === 'completed' ? 'Appointment completed & finalized!' : 'Status updated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  const confirmCancel = async () => {
    if (!cancelModalBookingId) return
    try {
      await updateBooking.mutateAsync({ 
        id: cancelModalBookingId, 
        updates: { 
          status: 'cancelled',
          cancellation_reason: cancelReason.trim()
        } 
      })
      toast.success('Appointment cancelled')
      setCancelModalBookingId(null)
      setCancelReason('')
    } catch {
      toast.error('Failed to cancel appointment')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bookings..."
            className="input-field pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-field w-auto min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="input-field w-auto"
        />
        <button onClick={() => { setEditBooking(null); setShowForm(true) }} className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
          <Plus size={16} /> New Booking
        </button>
      </div>

      {/* Bookings Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left p-3 font-medium text-gray-500">Client</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden md:table-cell">Service</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden sm:table-cell">Staff</th>
                <th className="text-left p-3 font-medium text-gray-500">Date & Time</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden sm:table-cell">Price</th>
                <th className="text-left p-3 font-medium text-gray-500">Status</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden lg:table-cell">Booked Time</th>
                <th className="text-right p-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-3"><div className="skeleton h-10 w-full" /></td>
                  </tr>
                ))
              ) : filtered?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filtered?.map((b: any) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-charcoal">{b.client_name}</p>
                      <p className="text-xs text-gray-400">{b.client_phone}</p>
                    </td>
                    <td className="p-3 hidden md:table-cell text-gray-600">
                      {b.services?.name || '—'}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: b.staff?.color_code || '#ccc' }}
                        />
                        <span className="text-gray-600">{b.staff?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">
                      <p>{formatDate(b.booking_date)}</p>
                      <p className="text-xs text-gray-400">{formatTime(b.start_time)}</p>
                    </td>
                    <td className="p-3 hidden sm:table-cell font-medium text-charcoal">
                      {formatCurrency(b.total_price)}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <select
                          value={b.status}
                          disabled={b.status === 'completed'}
                          onChange={e => handleStatusChange(b.id, e.target.value, b.status)}
                          className={cn(
                            'text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-80 w-min',
                            getStatusColor(b.status)
                          )}
                          title={b.status === 'completed' ? 'Completed (Finalized - Locked)' : 'Change status'}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {b.status === 'cancelled' && b.cancellation_reason && (
                          <div className="text-[10px] text-gray-500 italic mt-1 max-w-[120px] truncate" title={b.cancellation_reason}>
                            <Info size={10} className="inline mr-1 text-red-400" />
                            {b.cancellation_reason}
                          </div>
                        )}
                        {b.notes?.includes('[RE-BOOKED]') && (
                          <div className="text-[10px] text-emerald-600 font-bold mt-1 max-w-[120px] truncate flex items-center gap-1" title="This appointment was re-booked by the client">
                            <RefreshCw size={10} /> Re-booked
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-gray-500 text-xs">
                      {new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditBooking(b); setShowForm(true) }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showForm && (
        <BookingForm
          booking={editBooking}
          onClose={() => { setShowForm(false); setEditBooking(null) }}
        />
      )}

      {/* Cancellation Modal */}
      {cancelModalBookingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-playfair text-xl font-bold text-gray-900">Cancel Booking</h3>
              <button 
                onClick={() => { setCancelModalBookingId(null); setCancelReason('') }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Please provide a reason for cancelling this booking. This will be visible to the client.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Cancellation Reason (Optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client requested, scheduling conflict..."
                  className="input-field min-h-[100px] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setCancelModalBookingId(null); setCancelReason('') }}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Back
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors font-medium text-sm flex justify-center items-center gap-2"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
