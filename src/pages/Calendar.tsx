import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { useBookingsByDateRange } from '@/hooks/useBookings'
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from '@/hooks/useCalendarEvents'
import BookingForm from '@/components/bookings/BookingForm'
import { formatTime, formatDate, formatCurrency, getStatusColor, cn } from '@/lib/utils'
import { CalendarDays, Clock, User, Phone, Plus, X, Edit2, Info, Sparkles, Trash2, Tag, Home } from 'lucide-react'
import type { BookingWithDetails } from '@/lib/database.types'
import toast from 'react-hot-toast'

export default function Calendar() {
  const queryClient = useQueryClient()
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showForm, setShowForm] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [defaultDate, setDefaultDate] = useState('')
  const [defaultTime, setDefaultTime] = useState('')
  
  // Daily Summary Modal State
  const [showDaySummaryModal, setShowDaySummaryModal] = useState(false)
  const [selectedDateStr, setSelectedDateStr] = useState('')

  // Add Event Modal State
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [eventForm, setEventForm] = useState({
    title: '',
    is_all_day: true,
    start_time: '09:00',
    end_time: '17:00',
    notes: '',
  })

  // Real-time subscription for booking additions/cancellations
  useEffect(() => {
    const channel = supabase
      .channel('calendar_admin_realtime_bookings')
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

  const { data: bookings } = useBookingsByDateRange(dateRange.start, dateRange.end)
  const { data: calendarEvents } = useCalendarEvents(dateRange.start, dateRange.end)
  const createEvent = useCreateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  // Local storage cancelled bookings filter override
  const cancelledIds = new Set<string>(JSON.parse(localStorage.getItem('marquevedo_cancelled_bookings') || '[]'))

  // Active non-completed and non-cancelled bookings for Calendar display
  const activeBookings = bookings?.filter((b: any) =>
    b.status !== 'completed' &&
    b.status !== 'cancelled' &&
    !cancelledIds.has(b.id)
  ) || []

  const bookingEvents = activeBookings.map((b: any) => ({
    id: b.id,
    title: `${b.client_name}${b.notes?.includes('[HOME SERVICE]') ? ' HomSer.' : ''} - ${b.services?.name || 'Service'}`,
    start: `${b.booking_date}T${b.start_time}`,
    end: b.end_time ? `${b.booking_date}T${b.end_time}` : undefined,
    backgroundColor: '#0A3D2E',
    borderColor: 'transparent',
    extendedProps: { booking: b, type: 'booking' },
  }))

  const customEvents = (calendarEvents || []).map((e: any) => ({
    id: `evt-${e.id}`,
    title: e.title,
    start: e.is_all_day ? e.event_date : `${e.event_date}T${e.start_time}`,
    end: e.is_all_day ? undefined : (e.end_time ? `${e.event_date}T${e.end_time}` : undefined),
    allDay: e.is_all_day,
    backgroundColor: '#1a1a2e',
    borderColor: '#d4af37',
    textColor: '#d4af37',
    extendedProps: { calendarEvent: e, type: 'event' },
  }))

  const allEvents = [...bookingEvents, ...customEvents]

  const handleDatesSet = (info: any) => {
    setDateRange({
      start: info.startStr.split('T')[0],
      end: info.endStr.split('T')[0],
    })
  }

  // Set of dates that have active bookings
  const bookedDatesSet = new Set(activeBookings.map((b: any) => b.booking_date))

  // Open Daily Appointments Summary Modal upon clicking date cell
  const handleDateClick = (info: any) => {
    const clickedDate = info.dateStr ? info.dateStr.split('T')[0] : ''
    setSelectedDateStr(clickedDate)

    // If date has no bookings, show Add Event modal instead
    if (!bookedDatesSet.has(clickedDate)) {
      setEventForm({ title: '', is_all_day: true, start_time: '09:00', end_time: '17:00', notes: '' })
      setShowAddEventModal(true)
    } else {
      setShowDaySummaryModal(true)
    }
  }

  // Open Daily Appointments Summary Modal upon clicking any event or +more link
  const handleEventClick = (info: any) => {
    info.jsEvent.preventDefault()
    const extProps = info.event.extendedProps

    if (extProps.type === 'event') {
      // Clicking a custom event — show the day summary which also lists events
      const evtDate = extProps.calendarEvent?.event_date
      if (evtDate) {
        setSelectedDateStr(evtDate)
        setShowDaySummaryModal(true)
      }
      return
    }

    const booking = extProps.booking
    if (booking?.booking_date) {
      setSelectedDateStr(booking.booking_date)
      setShowDaySummaryModal(true)
    }
  }

  const getDayCellClassNames = (arg: any) => {
    const d = arg.date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    if (bookedDatesSet.has(dateStr)) {
      return ['fc-day-booked']
    }
    return []
  }

  // Custom Event Render for clean badges
  const renderEventContent = (eventInfo: any) => {
    const extProps = eventInfo.event.extendedProps

    // Custom calendar event styling
    if (extProps.type === 'event') {
      return (
        <div
          className="w-full flex items-center gap-1 text-[11px] font-bold leading-tight px-1 py-0.5 rounded overflow-hidden truncate cursor-pointer"
          title={extProps.calendarEvent?.title || 'Event'}
        >
          <Sparkles size={10} className="text-gold flex-shrink-0" />
          <span className="truncate">{extProps.calendarEvent?.title || 'Event'}</span>
        </div>
      )
    }

    // Booking event styling
    const booking = extProps.booking
    const timeFormatted = booking?.start_time ? formatTime(booking.start_time) : ''
    const clientFirstName = booking?.client_name ? booking.client_name.split(' ')[0] : 'Client'

    const isHomeService = booking?.notes?.includes('[HOME SERVICE]')

    return (
      <div
        className="w-full flex items-center gap-1 text-[11px] font-medium leading-tight px-1 py-0.5 rounded overflow-hidden truncate cursor-pointer hover:opacity-90 transition-opacity"
        title={`Click to view all bookings for ${booking?.booking_date}`}
      >
        <span className="font-semibold">{timeFormatted}</span>
        <span className="truncate flex items-center gap-1">
          {clientFirstName}
          {isHomeService && <Home size={10} className="shrink-0" />}
        </span>
      </div>
    )
  }

  // Active bookings for the selected date in the Daily Summary Modal
  const dayBookings = activeBookings.filter((b: any) => b.booking_date === selectedDateStr)
  // Custom events for the selected date
  const dayEvents = (calendarEvents || []).filter((e: any) => e.event_date === selectedDateStr)

  // Handle Add Event submission
  const handleSubmitEvent = async () => {
    if (!eventForm.title.trim()) {
      toast.error('Please enter an event name')
      return
    }
    if (!eventForm.is_all_day && (!eventForm.start_time || !eventForm.end_time)) {
      toast.error('Please set start and end times')
      return
    }

    try {
      await createEvent.mutateAsync({
        title: eventForm.title.trim(),
        event_date: selectedDateStr,
        is_all_day: eventForm.is_all_day,
        start_time: eventForm.is_all_day ? null : eventForm.start_time,
        end_time: eventForm.is_all_day ? null : eventForm.end_time,
        notes: eventForm.notes.trim(),
      })
      toast.success('Event added to calendar!')
      setShowAddEventModal(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add event')
    }
  }

  // Handle Delete custom event
  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent.mutateAsync(eventId)
      toast.success('Event removed')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event')
    }
  }

  return (
    <div className="space-y-4 font-body">
      {/* Tip banner (no staff legend) */}
      <div className="flex flex-wrap gap-3 items-center justify-end">
        <p className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
          <Info size={14} className="text-emerald" /> Click any date to view bookings or add an event
        </p>
      </div>

      {/* Calendar Container */}
      <div className="card-premium p-2 sm:p-4 md:p-5 overflow-x-auto">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List',
          }}
          views={{
            dayGridMonth: {
              dayMaxEvents: 2,
              moreLinkClick: (info) => {
                const d = info.date
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                const clickedDate = `${year}-${month}-${day}`
                setSelectedDateStr(clickedDate)
                setShowDaySummaryModal(true)
                return 'none'
              },
            },
          }}
          events={allEvents}
          eventContent={renderEventContent}
          dayCellClassNames={getDayCellClassNames}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          showNonCurrentDates={false}
          fixedWeekCount={false}
          height="auto"
          editable={false}
          selectable
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          nowIndicator
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: '09:00',
            endTime: '19:00',
          }}
        />
      </div>

      {/* 1. Daily Appointments Summary Modal */}
      {showDaySummaryModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-emerald-900/10 flex items-center justify-between bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-white">
                    {selectedDateStr ? formatDate(selectedDateStr) : 'Appointments Summary'}
                  </h3>
                  <p className="text-xs text-gold font-semibold">
                    {dayBookings.length} {dayBookings.length === 1 ? 'Booking' : 'Bookings'} · {dayEvents.length} {dayEvents.length === 1 ? 'Event' : 'Events'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDaySummaryModal(false)}
                className="p-1.5 rounded-full bg-white/10 text-emerald-100 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-3 bg-offwhite">
              {/* Custom Events for the day */}
              {dayEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Events</p>
                  {dayEvents.map((evt: any) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-white border border-gray-200 shadow-sm hover:border-gold/60 transition-all rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles size={14} className="text-gold" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-charcoal truncate">{evt.title}</p>
                          <p className="text-[11px] text-gray-500 font-medium">
                            {evt.is_all_day ? 'All Day' : `${formatTime(evt.start_time)} - ${formatTime(evt.end_time)}`}
                          </p>
                          {evt.notes && <p className="text-[10px] text-gray-400 truncate mt-0.5">{evt.notes}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex-shrink-0"
                        title="Delete event"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bookings for the day */}
              {dayBookings.length > 0 && (
                <div className="space-y-2">
                  {dayEvents.length > 0 && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1">Bookings</p>}
                  {dayBookings.map((b: any, idx: number) => (
                    <div
                      key={b.id ? `modal-book-${b.id}-${idx}` : `modal-book-${idx}`}
                      className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2 shadow-sm hover:border-gold/60 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-bold text-xs text-emerald flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          <Clock size={13} className="text-gold" /> {formatTime(b.start_time)} {b.end_time && `- ${formatTime(b.end_time)}`}
                        </span>
                        <span className={cn('text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider', getStatusColor(b.status))}>
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Client</span>
                          <p className="font-bold text-charcoal flex items-center gap-1">
                            <User size={12} className="text-emerald" /> {b.client_name || 'Walk-in Client'}
                          </p>
                          <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 mb-1">
                            <Phone size={10} className="text-gold" /> {b.client_phone || 'N/A'}
                          </p>
                          {b.notes?.includes('[HOME SERVICE]') && (
                            <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md w-max">
                              <Home size={10} /> Home Service
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Service</span>
                          <p className="font-bold text-emerald">{b.services?.name || 'Treatment'}</p>
                          <p className="text-[11px] text-gold font-bold">{formatCurrency(b.total_price || 0)}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Stylist: <strong className="text-charcoal">{b.staff?.name || 'Any Available'}</strong></span>
                        <button
                          onClick={() => {
                            setShowDaySummaryModal(false)
                            setSelectedBooking(b)
                            setShowForm(true)
                          }}
                          className="text-xs text-emerald hover:text-gold font-bold flex items-center gap-1 transition-colors"
                        >
                          <Edit2 size={12} /> Edit Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {dayBookings.length === 0 && dayEvents.length === 0 && (
                <div className="text-center py-10 text-gray-400 space-y-2 bg-white rounded-2xl border border-dashed border-gray-300 p-6">
                  <Clock size={36} className="mx-auto text-gray-300" />
                  <p className="font-bold text-sm text-charcoal">No bookings or events for this date</p>
                  <p className="text-xs text-gray-400">Click the buttons below to add something.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
              <button
                onClick={() => setShowDaySummaryModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDaySummaryModal(false)
                    setEventForm({ title: '', is_all_day: true, start_time: '09:00', end_time: '17:00', notes: '' })
                    setShowAddEventModal(true)
                  }}
                  className="text-xs py-2.5 px-4 font-bold flex items-center gap-1.5 rounded-xl border border-charcoal/20 text-charcoal hover:bg-charcoal hover:text-white transition-all"
                >
                  <Sparkles size={14} /> Add Event
                </button>
                <button
                  onClick={() => {
                    setShowDaySummaryModal(false)
                    setDefaultDate(selectedDateStr)
                    setDefaultTime('09:00')
                    setSelectedBooking(null)
                    setShowForm(true)
                  }}
                  className="btn-gold text-xs py-2.5 px-4 font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus size={15} /> Add Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-white">Add Event</h3>
                  <p className="text-xs text-gold font-semibold">
                    {selectedDateStr ? formatDate(selectedDateStr) : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="p-1.5 rounded-full bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4 bg-offwhite">
              {/* Event Name */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  <Tag size={12} className="inline mr-1" />Event Name *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Staff Meeting, Holiday, Maintenance..."
                  className="input-field text-sm"
                  autoFocus
                />
              </div>

              {/* All Day Toggle */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  <Clock size={12} className="inline mr-1" />Duration
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, is_all_day: true }))}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                      eventForm.is_all_day
                        ? 'bg-charcoal text-white border-charcoal shadow-md'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    )}
                  >
                    Whole Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, is_all_day: false }))}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                      !eventForm.is_all_day
                        ? 'bg-charcoal text-white border-charcoal shadow-md'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    )}
                  >
                    Custom Time
                  </button>
                </div>
              </div>

              {/* Time Fields (only if not all day) */}
              {!eventForm.is_all_day && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">From</label>
                    <input
                      type="time"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">To</label>
                    <input
                      type="time"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={eventForm.notes}
                  onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional details..."
                  rows={2}
                  className="input-field text-sm resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
              <button
                onClick={() => setShowAddEventModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEvent}
                disabled={createEvent.isPending}
                className="btn-primary text-xs py-2.5 px-6 font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {createEvent.isPending ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Plus size={15} />
                )}
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Booking Form Modal */}
      {showForm && (
        <BookingForm
          booking={selectedBooking}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          onClose={() => {
            setShowForm(false)
            setSelectedBooking(null)
          }}
        />
      )}
    </div>
  )
}
