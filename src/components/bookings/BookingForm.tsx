import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { useActiveServices } from '@/hooks/useServices'
import { useActiveStaff } from '@/hooks/useStaff'
import { useCreateBooking, useUpdateBooking } from '@/hooks/useBookings'
import { formatCurrency, formatDuration, generateTimeSlots, getTodayISO } from '@/lib/utils'
import type { BookingWithDetails } from '@/lib/database.types'
import toast from 'react-hot-toast'

interface BookingFormProps {
  booking?: BookingWithDetails | null
  defaultDate?: string
  defaultTime?: string
  onClose: () => void
}

export default function BookingForm({ booking, defaultDate, defaultTime, onClose }: BookingFormProps) {
  const { data: services } = useActiveServices()
  const { data: staffList } = useActiveStaff()
  const createBooking = useCreateBooking()
  const updateBooking = useUpdateBooking()

  const [form, setForm] = useState({
    client_name: booking?.client_name || '',
    client_phone: booking?.client_phone || '',
    service_id: booking?.service_id || '',
    staff_id: booking?.staff_id || '',
    booking_date: booking?.booking_date || defaultDate || getTodayISO(),
    start_time: booking?.start_time?.slice(0, 5) || defaultTime || '09:00',
    status: booking?.status || 'pending' as const,
    notes: booking?.notes || '',
  })

  const selectedService = services?.find(s => s.id === form.service_id)
  const totalPrice = selectedService?.price || booking?.total_price || 0
  const timeSlots = generateTimeSlots()

  const endTime = (() => {
    if (!selectedService || !form.start_time) return ''
    const [h, m] = form.start_time.split(':').map(Number)
    const totalMins = h * 60 + m + selectedService.duration_minutes
    const endH = Math.floor(totalMins / 60)
    const endM = totalMins % 60
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
  })()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name || !form.service_id || !form.booking_date || !form.start_time) {
      toast.error('Please fill in all required fields')
      return
    }

    if (form.status === 'completed' && booking?.status !== 'completed') {
      if (!confirm('Are you sure you want to mark this appointment as COMPLETED? Once marked as completed, it will be finalized and removed from the calendar view.')) {
        return
      }
    }

    try {
      if (booking) {
        await updateBooking.mutateAsync({
          id: booking.id,
          updates: {
            client_name: form.client_name,
            client_phone: form.client_phone,
            service_id: form.service_id,
            staff_id: form.staff_id || null,
            booking_date: form.booking_date,
            start_time: form.start_time,
            end_time: endTime || null,
            status: form.status as any,
            total_price: totalPrice,
            notes: form.notes,
          },
        })
        toast.success(form.status === 'completed' ? 'Booking completed & finalized!' : 'Booking updated!')
      } else {
        await createBooking.mutateAsync({
          client_name: form.client_name,
          client_phone: form.client_phone,
          service_id: form.service_id,
          staff_id: form.staff_id || null,
          booking_date: form.booking_date,
          start_time: form.start_time,
          end_time: endTime || null,
          status: form.status as any,
          total_price: totalPrice,
          notes: form.notes,
        })
        toast.success('Booking created!')
      }
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  const isLoading = createBooking.isPending || updateBooking.isPending

  // Group services by category
  const groupedServices = services?.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = []
    acc[service.category].push(service)
    return acc
  }, {} as Record<string, typeof services>) || {}

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-heading font-bold text-lg text-charcoal">
            {booking ? 'Edit Booking' : 'New Booking'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Client Name *</label>
            <input
              name="client_name"
              value={form.client_name}
              onChange={handleChange}
              placeholder="Enter client name"
              className="input-field"
              required
            />
          </div>

          {/* Client Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone Number</label>
            <input
              name="client_phone"
              value={form.client_phone}
              onChange={handleChange}
              placeholder="09XX XXX XXXX"
              className="input-field"
            />
          </div>

          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Service *</label>
            <select
              name="service_id"
              value={form.service_id}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="">Select a service</option>
              {Object.entries(groupedServices).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatCurrency(s.price)} ({formatDuration(s.duration_minutes)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Staff */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Assign Staff</label>
            <select
              name="staff_id"
              value={form.staff_id}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Any available staff</option>
              {staffList?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date *</label>
              <input
                type="date"
                name="booking_date"
                value={form.booking_date}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Time *</label>
              <select
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                className="input-field"
                required
              >
                {timeSlots.map(slot => (
                  <option key={slot} value={slot}>
                    {(() => {
                      const [h, m] = slot.split(':').map(Number)
                      const period = h >= 12 ? 'PM' : 'AM'
                      const dh = h % 12 || 12
                      return `${dh}:${m.toString().padStart(2, '0')} ${period}`
                    })()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (edit only) */}
          {booking && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
              {booking.status === 'completed' ? (
                <div className="input-field bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-between border border-emerald-200">
                  <span>Completed (Finalized - Locked)</span>
                  <Check size={14} className="text-emerald-700 font-bold" />
                </div>
              ) : (
                <select name="status" value={form.status} onChange={handleChange} className="input-field">
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any special requests..."
              className="input-field h-20 resize-none"
            />
          </div>

          {/* Price Summary */}
          {selectedService && (
            <div className="bg-emerald/5 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Price</span>
              <span className="font-heading font-bold text-lg text-emerald">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-primary text-sm disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : booking ? 'Update Booking' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
