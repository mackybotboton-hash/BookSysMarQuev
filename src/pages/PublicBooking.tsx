import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveServices } from '@/hooks/useServices'
import { useActiveStaff } from '@/hooks/useStaff'
import { useCreateBooking } from '@/hooks/useBookings'
import { useCalendarEventsByDate } from '@/hooks/useCalendarEvents'
import { useAuthStore } from '@/stores/auth-store'
import { formatCurrency, formatTime, formatDuration, generateTimeSlots, cn, formatDateISO, getTodayISO } from '@/lib/utils'
import { Scissors, CheckCircle, ArrowLeft, ArrowRight, Clock, User, Phone, LogIn, LayoutDashboard, Sparkles, AlertTriangle } from 'lucide-react'
import type { Service, Staff } from '@/lib/database.types'
import { getStaffAvatarIcon } from '@/pages/Staff'
import AuthModal from '@/components/auth/AuthModal'
import toast from 'react-hot-toast'

type Step = 'service' | 'staff' | 'datetime' | 'info' | 'confirm' | 'success'

export default function PublicBooking() {
  const { data: services, isLoading: servicesLoading } = useActiveServices()
  const { data: staffList } = useActiveStaff()
  const createBooking = useCreateBooking()
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatDateISO(d)
  })
  const [bookingTime, setBookingTime] = useState('')
  const [clientName, setClientName] = useState(profile?.full_name || '')
  const [clientPhone, setClientPhone] = useState(profile?.phone || '')
  const [notes, setNotes] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Sync profile info if logged in
  useEffect(() => {
    if (profile) {
      if (profile.full_name && !clientName) setClientName(profile.full_name)
      if (profile.phone && !clientPhone) setClientPhone(profile.phone)
    }
  }, [profile])

  // Realtime subscription & window event listeners for calendar events
  useEffect(() => {
    const channel = supabase
      .channel('public_realtime_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        // Automatically triggers react-query refetch
      })
      .subscribe()

    const handleUpdate = () => {
      // triggers react-query refetch
    }
    window.addEventListener('calendar-events-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('calendar-events-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const timeSlots = generateTimeSlots(8, 21)

  // Fetch calendar events for the selected booking date (real-time polling)
  const cleanBookingDate = bookingDate ? bookingDate.split('T')[0].trim() : ''
  const { data: dateEvents } = useCalendarEventsByDate(cleanBookingDate)
  const hasDateEvents = (dateEvents?.length || 0) > 0
  const isWholeDayBlocked = dateEvents?.some((e: any) => e.is_all_day) || false

  const isSlotBlockedByPartialEvent = (slotTime: string) => {
    if (!dateEvents || dateEvents.length === 0) return false
    if (isWholeDayBlocked) return true

    const [slotH, slotM] = slotTime.split(':').map(Number)
    const slotMins = slotH * 60 + slotM

    return dateEvents.some((e: any) => {
      if (e.is_all_day) return true
      if (!e.start_time) return false

      const [sH, sM] = String(e.start_time).split(':').map(Number)
      const startMins = sH * 60 + sM
      let endMins = startMins + 60
      if (e.end_time) {
        const [eH, eM] = String(e.end_time).split(':').map(Number)
        endMins = eH * 60 + eM
      }
      return slotMins >= startMins && slotMins < endMins
    })
  }

  // Get tomorrow's date as minimum
  const minDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatDateISO(d)
  })()

  const endTime = (() => {
    if (!selectedService || !bookingTime) return ''
    const [h, m] = bookingTime.split(':').map(Number)
    const totalMins = h * 60 + m + selectedService.duration_minutes
    const endH = Math.floor(totalMins / 60)
    const endM = totalMins % 60
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
  })()

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service)
    if (!profile) {
      // Prompt Login / OTP Verification Modal if not logged in
      setShowAuthModal(true)
    } else {
      if (profile.full_name) setClientName(profile.full_name)
      if (profile.phone) setClientPhone(profile.phone)
      setStep('staff')
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    const activeProfile = useAuthStore.getState().profile
    if (activeProfile?.full_name) setClientName(activeProfile.full_name)
    if (activeProfile?.phone) setClientPhone(activeProfile.phone)
    setStep('staff')
  }

  const handleSubmit = async () => {
    if (!selectedService || !bookingDate || !bookingTime || !clientName) {
      toast.error('Please complete all required fields')
      return
    }

    let validCreatedBy = null
    if (profile?.id) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', profile.id)
        .maybeSingle()

      if (existingProfile) {
        validCreatedBy = profile.id
      } else {
        // Upsert client profile so foreign key constraint is satisfied
        const { data: inserted } = await supabase
          .from('profiles')
          .upsert({
            id: profile.id,
            email: profile.email || `${clientPhone}@client.marquevedo.com`,
            full_name: clientName,
            phone: clientPhone,
            role: 'client',
          } as any)
          .select('id')
          .maybeSingle()

        if (inserted) {
          validCreatedBy = (inserted as any).id
        }
      }
    }

    try {
      await createBooking.mutateAsync({
        client_name: clientName,
        client_phone: clientPhone,
        service_id: selectedService.id,
        staff_id: selectedStaff?.id || null,
        booking_date: bookingDate,
        start_time: bookingTime,
        end_time: endTime || null,
        total_price: selectedService.price,
        notes,
        status: 'pending',
        created_by: validCreatedBy,
      })
      
      setStep('success')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create booking')
    }
  }

  const resetForm = () => {
    setStep('service')
    setSelectedService(null)
    setSelectedStaff(null)
    setBookingDate('')
    setBookingTime('')
    setNotes('')
  }

  // Group services by category
  const grouped = services?.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<string, Service[]>) || {}

  const steps: { key: Step; label: string }[] = [
    { key: 'service', label: 'Service' },
    { key: 'staff', label: 'Staff' },
    { key: 'datetime', label: 'Date & Time' },
    { key: 'info', label: 'Your Info' },
    { key: 'confirm', label: 'Confirm' },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="bg-emerald text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="MarQuevedo Hair Studio"
              className="w-11 h-11 rounded-full ring-2 ring-gold/40 object-cover"
            />
            <div>
              <h1 className="font-heading text-xl font-bold text-gold">MarQuevedo Hair Studio</h1>
              <p className="text-emerald-200/80 text-xs">Book Your Appointment Online</p>
            </div>
          </div>
          {profile ? (
            <Link
              to={profile.role === 'admin' ? '/dashboard' : '/client-dashboard'}
              className="btn-gold flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <LayoutDashboard size={14} /> My Dashboard
            </Link>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="btn-gold flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <LogIn size={14} /> Sign In / Register
            </button>
          )}
        </div>
      </header>

      {/* Progress Steps */}
      {step !== 'success' && (
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  i <= currentStepIndex
                    ? "bg-emerald text-white"
                    : "bg-gray-200 text-gray-400"
                )}>
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1",
                    i < currentStepIndex ? "bg-emerald" : "bg-gray-200"
                  )} />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs font-medium text-gray-500 mt-2">{steps[currentStepIndex]?.label}</p>
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Choose a Service to Book</h2>
            {servicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-emerald uppercase tracking-wider mb-2">{category}</h3>
                  <div className="grid gap-2">
                    {items.map(service => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className={cn(
                          "card-premium p-4 text-left hover:border-emerald hover:shadow-md transition-all w-full group",
                          selectedService?.id === service.id && "border-emerald ring-2 ring-emerald/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-charcoal text-base group-hover:text-emerald transition-colors">{service.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                              <Clock size={12} className="text-emerald" /> {formatDuration(service.duration_minutes)} duration
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-heading font-bold text-emerald text-xl block">
                              {formatCurrency(service.price)}
                            </span>
                            <span className="text-[10px] text-gray-400">Select →</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Step 2: Staff Selection */}
        {step === 'staff' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Choose a Stylist (Optional)</h2>
            <button
              onClick={() => { setSelectedStaff(null); setStep('datetime') }}
              className="card-premium p-4 text-left hover:border-emerald/30 hover:shadow-md transition-all w-full"
            >
              <p className="font-medium text-charcoal">Any Available Stylist</p>
              <p className="text-xs text-gray-400 mt-0.5">We'll assign the best available stylist for your service</p>
            </button>
            {staffList?.map(s => {
              const AvatarIcon = getStaffAvatarIcon(s.color_code)
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStaff(s); setStep('datetime') }}
                  className="card-premium p-4 text-left hover:border-emerald/30 hover:shadow-md transition-all w-full"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                      style={{ backgroundColor: s.color_code || '#0A3D2E' }}
                    >
                      <AvatarIcon size={20} className="text-white drop-shadow-sm" />
                    </div>
                    <p className="font-medium text-charcoal">{s.name}</p>
                  </div>
                </button>
              )
            })}
            <button onClick={() => setStep('service')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald transition-colors">
              <ArrowLeft size={14} /> Back to Services
            </button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 'datetime' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Pick Appointment Date & Time</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Date *</label>
              <input
                type="date"
                value={bookingDate}
                onChange={e => setBookingDate(e.target.value)}
                min={minDate}
                className="input-field"
                required
              />
            </div>
            {bookingDate && (
              <div className="space-y-4">
                {/* Event Alert Banner */}
                {hasDateEvents && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-heading font-bold text-sm text-charcoal">
                          {isWholeDayBlocked ? 'Date Unavailable for Booking' : 'Scheduled Salon Event'}
                        </p>
                        <p className="text-[11px] text-amber-700">
                          {isWholeDayBlocked
                            ? 'The salon is closed for a full-day event. Please pick another date.'
                            : 'Time slots during the event are blocked. Other slots remain available!'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {dateEvents?.map((evt: any) => (
                        <div key={evt.id} className="bg-white border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-charcoal/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles size={14} className="text-charcoal" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-charcoal truncate">{evt.title}</p>
                            <p className="text-[11px] text-gray-500">
                              {evt.is_all_day ? 'Whole Day Event' : `${formatTime(evt.start_time)} — ${formatTime(evt.end_time)}`}
                              {evt.notes ? ` · ${evt.notes}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Slots Grid (available if not whole day event) */}
                {!isWholeDayBlocked && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Available Time *</label>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {timeSlots.map(slot => {
                        const isEventBlocked = isSlotBlockedByPartialEvent(slot)
                        return (
                          <button
                            key={slot}
                            disabled={isEventBlocked}
                            onClick={() => setBookingTime(slot)}
                            className={cn(
                              "px-2 py-2 rounded-lg text-xs font-medium transition-all border flex flex-col items-center justify-center",
                              isEventBlocked
                                ? "bg-amber-50 text-amber-500/70 border-amber-200 cursor-not-allowed opacity-60"
                                : bookingTime === slot
                                ? "bg-emerald text-white border-emerald shadow-sm font-bold"
                                : "bg-white text-gray-600 border-gray-200 hover:border-emerald/30"
                            )}
                            title={isEventBlocked ? 'Blocked by Salon Event' : 'Available'}
                          >
                            <span>{formatTime(slot)}</span>
                            {isEventBlocked && <span className="text-[9px] font-bold text-amber-600">Event</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('staff')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep('info')}
                disabled={!bookingDate || !bookingTime || isWholeDayBlocked || isSlotBlockedByPartialEvent(bookingTime)}
                className="btn-primary text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Client Info */}
        {step === 'info' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Your Details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                <User size={12} className="inline mr-1" /> Full Name *
              </label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Enter your full name"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="pl-10 input-field"
                  placeholder="09XXXXXXXXX"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any preferences..."
                className="input-field h-20 resize-none"
              />
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('datetime')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!clientName || !clientPhone}
                className="btn-primary text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Review & Confirm <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 'confirm' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Confirm Your Booking</h2>
            <div className="card-premium p-5 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Service</span>
                <span className="text-sm font-semibold text-charcoal">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Stylist</span>
                <span className="text-sm font-medium text-charcoal">{selectedStaff?.name || 'Any Available'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Date</span>
                <span className="text-sm font-medium text-charcoal">
                  {new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Time</span>
                <span className="text-sm font-medium text-charcoal">{formatTime(bookingTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Client Name</span>
                <span className="text-sm font-medium text-charcoal">{clientName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Phone</span>
                <span className="text-sm font-medium text-charcoal">{clientPhone}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="font-medium text-charcoal">Total Amount</span>
                <span className="font-heading font-bold text-2xl text-emerald">
                  {formatCurrency(selectedService?.price ?? 0)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('info')} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createBooking.isPending}
                className="flex-1 btn-primary text-xs py-2.5 font-bold"
              >
                {createBooking.isPending ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {step === 'success' && (
          <div className="animate-fade-in text-center py-10 card-premium p-8">
            <div className="w-20 h-20 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={44} className="text-emerald" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              Thank you, <strong>{clientName}</strong>! Your appointment for{' '}
              <strong>{selectedService?.name}</strong> on <strong>{bookingDate}</strong> at <strong>{formatTime(bookingTime)}</strong> has been submitted.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/client-dashboard" className="btn-primary text-xs flex items-center justify-center gap-2">
                <LayoutDashboard size={14} /> Go to My Client Dashboard
              </Link>
              <button onClick={resetForm} className="btn-gold text-xs">
                Book Another Appointment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone OTP Verification Modal */}
      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-emerald text-emerald-200/60 text-center py-4 text-xs">
        <p>MarQuevedo Hair Studio © {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
