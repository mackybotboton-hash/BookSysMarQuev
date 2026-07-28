import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useActiveServices } from '@/hooks/useServices'
import { useActiveStaff } from '@/hooks/useStaff'
import { useCalendarEventsByDate } from '@/hooks/useCalendarEvents'
import { useAuthStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDate, formatTime, formatDuration, getStatusColor, generateTimeSlots, cn, getTodayISO } from '@/lib/utils'
import {
  Calendar, Clock, Scissors, User, Phone, LogOut, Plus, CheckCircle,
  Search, MapPin, Bell, SlidersHorizontal, Star, Sparkles, RefreshCw,
  Home, Bookmark, Compass, X, ArrowRight, Check, AlertTriangle, Palette, Package, Info
} from 'lucide-react'
import type { Service, Staff } from '@/lib/database.types'
import { getStaffAvatarIcon } from '@/pages/Staff'
import { playLuxuryChime, requestNotificationPermission, sendBrowserNotification } from '@/lib/notifications'
import toast from 'react-hot-toast'

export default function ClientDashboard() {
  const storeProfile = useAuthStore((s) => s.profile)
  const profile = storeProfile || JSON.parse(localStorage.getItem('marquevedo_auth_profile') || 'null')
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'home' | 'bookings' | 'profile'>('home')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  // Quick Booking Modal State (Single-Screen)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [bookingTime, setBookingTime] = useState('10:00:00')
  const [bookingNotes, setBookingNotes] = useState('')
  const [submittingBooking, setSubmittingBooking] = useState(false)

  // Handle pre-selected service passed from Home page after authentication
  useEffect(() => {
    if (location.state?.bookingService) {
      const targetService = location.state.bookingService
      setSelectedService(targetService)
      setShowBookingModal(true)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Notification permission banner state for client
  const [showClientNotifBanner, setShowClientNotifBanner] = useState(false)

  // Cancellation Modal State
  const [cancelModalBookingId, setCancelModalBookingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rebookBookingId, setRebookBookingId] = useState<string | null>(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const dismissed = localStorage.getItem('marquevedo_client_notif_banner_dismissed')
      if (!dismissed) {
        setShowClientNotifBanner(true)
      }
    }
  }, [])

  const handleAllowClientNotifications = async () => {
    const granted = await requestNotificationPermission()
    setShowClientNotifBanner(false)
    if (granted) {
      toast.success('Desktop notifications enabled!')
      playLuxuryChime()
      sendBrowserNotification('Notifications Enabled!', {
        body: 'You will receive real-time audio and push alerts when your salon appointment status changes.',
      })
    }
  }

  const handleDismissClientBanner = () => {
    setShowClientNotifBanner(false)
    localStorage.setItem('marquevedo_client_notif_banner_dismissed', 'true')
  }

  // Fetch client's bookings
  const { data: myBookings, isLoading: bookingsLoading, refetch } = useQuery({
    queryKey: ['clientBookings', profile?.id, profile?.phone],
    queryFn: async () => {
      if (!profile) return []
      
      let query = supabase
        .from('bookings')
        .select('*, services(*), staff(*)')
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false })

      if (profile.phone) {
        query = query.or(`created_by.eq.${profile.id},client_phone.eq.${profile.phone}`)
      } else {
        query = query.eq('created_by', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!profile,
  })

  // Real-time Supabase subscription for Client (Status Updates on Bookings)
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel(`client_realtime_status_updates_${profile.id || profile.phone}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
        },
        (payload: any) => {
          const updated = payload.new
          queryClient.invalidateQueries({ queryKey: ['dateBookings'] })

          const isMyBooking = (profile.id && updated.created_by === profile.id) || (profile.phone && updated.client_phone === profile.phone)
          
          if (isMyBooking) {
            playLuxuryChime()
            refetch()

            const statusText = updated.status.toUpperCase()
            toast.success(`Appointment Status Update: Your booking is now ${statusText}!`, {
              duration: 6000,
            })

            sendBrowserNotification('Appointment Status Updated!', {
              body: `Your salon appointment status is now ${statusText}`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, refetch])

  // Supabase Realtime subscription for Staff & Services updates in real-time!
  useEffect(() => {
    const channel = supabase
      .channel('client_realtime_staff_services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        queryClient.invalidateQueries({ queryKey: ['staff'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        queryClient.invalidateQueries({ queryKey: ['services'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
        queryClient.invalidateQueries({ queryKey: ['calendarEventsByDate'] })
      })
      .subscribe()

    const handleLocalUpdates = () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
      queryClient.invalidateQueries({ queryKey: ['calendarEventsByDate'] })
    }
    window.addEventListener('marquevedo_staff_updated', handleLocalUpdates)
    window.addEventListener('marquevedo_service_updated', handleLocalUpdates)
    window.addEventListener('calendar-events-updated', handleLocalUpdates)
    window.addEventListener('storage', handleLocalUpdates)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('marquevedo_staff_updated', handleLocalUpdates)
      window.removeEventListener('marquevedo_service_updated', handleLocalUpdates)
      window.removeEventListener('calendar-events-updated', handleLocalUpdates)
      window.removeEventListener('storage', handleLocalUpdates)
    }
  }, [queryClient])

  // Fetch active services & staff
  const { data: services } = useActiveServices()
  const { data: staffList } = useActiveStaff()

  // Fetch existing active bookings for the selected date to prevent time slot conflicts
  const { data: dateBookings } = useQuery({
    queryKey: ['dateBookings', bookingDate],
    queryFn: async () => {
      if (!bookingDate) return []
      const { data, error } = await supabase
        .from('bookings')
        .select('start_time, end_time, staff_id, status')
        .eq('booking_date', bookingDate)
        .in('status', ['pending', 'confirmed'])
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: !!bookingDate && showBookingModal,
  })

  // Fetch calendar events for the selected booking date (real-time polling)
  const cleanBookingDate = bookingDate ? bookingDate.split('T')[0].trim() : ''
  const { data: clientDateEvents } = useCalendarEventsByDate(cleanBookingDate)
  const hasClientDateEvents = (clientDateEvents?.length || 0) > 0
  const isWholeDayBlocked = clientDateEvents?.some((e: any) => e.is_all_day) || false

  const isSlotBlockedByPartialEvent = (slotTime: string) => {
    if (!clientDateEvents || clientDateEvents.length === 0) return false
    if (isWholeDayBlocked) return true

    const [slotH, slotM] = slotTime.split(':').map(Number)
    const slotMins = slotH * 60 + slotM

    return clientDateEvents.some((e: any) => {
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

  // Check if a time slot is already taken / booked
  const isTimeSlotTaken = (slotTime: string) => {
    if (!dateBookings || dateBookings.length === 0) return false

    return dateBookings.some((b: any) => {
      if (selectedStaff?.id && b.staff_id && b.staff_id !== selectedStaff.id) {
        return false
      }

      const [slotH, slotM] = slotTime.split(':').map(Number)
      const slotMins = slotH * 60 + slotM

      const [startH, startM] = b.start_time.split(':').map(Number)
      const startMins = startH * 60 + startM

      let endMins = startMins + (selectedService?.duration_minutes || 60)
      if (b.end_time) {
        const [endH, endM] = b.end_time.split(':').map(Number)
        endMins = endH * 60 + endM
      }

      return slotMins >= startMins && slotMins < endMins
    })
  }

  // Auto select default service when services load
  useEffect(() => {
    if (services && services.length > 0 && !selectedService) {
      setSelectedService(services[0])
    }
  }, [services])

  // Cancel Booking handler (Guaranteed permanent cancellation with localStorage override & Supabase update)
  const cancelBooking = async () => {
    if (!cancelModalBookingId) return
    const bookingId = cancelModalBookingId

    try {
      const cancelledList = JSON.parse(localStorage.getItem('marquevedo_cancelled_bookings') || '[]')
      if (!cancelledList.includes(bookingId)) {
        cancelledList.push(bookingId)
        localStorage.setItem('marquevedo_cancelled_bookings', JSON.stringify(cancelledList))
      }

      const { error: err1 } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancellation_reason: cancelReason.trim() })
        .eq('id', bookingId)

      if (err1) {
        console.error('Supabase cancel booking error:', err1)
      }


      window.dispatchEvent(new Event('marquevedo_booking_updated'))
      window.dispatchEvent(new Event('storage'))

      const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('marquevedo_booking_updates_bc') : null
      bc?.postMessage({ type: 'BOOKING_CANCELLED', bookingId })

      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dateBookings'] })
      queryClient.invalidateQueries({ queryKey: ['clientBookings'] })

      queryClient.setQueryData(['clientBookings', profile?.id, profile?.phone], (old: any[] = []) =>
        old.map(b => (b.id === bookingId ? { ...b, status: 'cancelled', cancellation_reason: cancelReason.trim() } : b))
      )

      toast.success('Appointment cancelled successfully')
      setCancelModalBookingId(null)
      setCancelReason('')
      refetch()
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel appointment')
    }
  }

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingBooking, setRatingBooking] = useState<any>(null)
  const [ratingStars, setRatingStars] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratedIds, setRatedIds] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('marquevedo_rated_booking_ids') || '[]')
  })

  const handleOpenRatingModal = (booking: any) => {
    setRatingBooking(booking)
    setRatingStars(5)
    setRatingComment('')
    setShowRatingModal(true)
  }

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ratingBooking) return

    setSubmittingRating(true)
    try {
      const reviewRow = {
        booking_id: ratingBooking.id,
        client_name: profile?.full_name || ratingBooking.client_name || 'Valued Client',
        service_name: ratingBooking.services?.name || 'Salon Treatment',
        rating: ratingStars,
        comment: ratingComment,
        created_at: new Date().toISOString(),
      }

      await supabase.from('reviews').insert(reviewRow as any)

      // Save locally for instant reactivity
      const localReviews = JSON.parse(localStorage.getItem('marquevedo_custom_reviews') || '[]')
      localReviews.unshift(reviewRow)
      localStorage.setItem('marquevedo_custom_reviews', JSON.stringify(localReviews))

      const updatedRatedIds = [...ratedIds, ratingBooking.id]
      setRatedIds(updatedRatedIds)
      localStorage.setItem('marquevedo_rated_booking_ids', JSON.stringify(updatedRatedIds))

      toast.success('Thank you for rating your salon treatment!')
      setShowRatingModal(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review')
    } finally {
      setSubmittingRating(false)
    }
  }

  // Open Quick Booking Modal with a specific service
  const handleOpenBookingModal = (service?: Service, existingBookingId?: string) => {
    if (service) {
      setSelectedService(service)
    } else if (services && services.length > 0) {
      setSelectedService(services[0])
    }
    setRebookBookingId(existingBookingId || null)
    queryClient.invalidateQueries({ queryKey: ['dateBookings'] })
    queryClient.invalidateQueries({ queryKey: ['services'] })
    queryClient.invalidateQueries({ queryKey: ['staff'] })
    setShowBookingModal(true)
  }

  // Submit Quick Single-Screen Booking
  const handleQuickBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService || !bookingDate || !bookingTime) {
      toast.error('Please select service, date, and time slot')
      return
    }

    if (isTimeSlotTaken(bookingTime)) {
      toast.error('This time slot is already booked. Please choose an available time.')
      return
    }

    setSubmittingBooking(true)

    const [h, m] = bookingTime.split(':').map(Number)
    const totalMins = h * 60 + m + selectedService.duration_minutes
    const endH = Math.floor(totalMins / 60)
    const endM = totalMins % 60
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    try {
      let validCreatedBy = null
      if (profile?.id) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profile.id)
          .maybeSingle()

        if (existing) {
          validCreatedBy = profile.id
        } else {
          const { data: inserted } = await supabase
            .from('profiles')
            .upsert({
              id: profile.id,
              email: profile.email || `${profile.phone}@client.marquevedo.com`,
              full_name: profile.full_name || 'Client',
              phone: profile.phone || '',
              role: 'client',
            } as any)
            .select('id')
            .maybeSingle()

          if (inserted) validCreatedBy = (inserted as any).id
        }
      }

      const newBooking = {
        client_name: profile?.full_name || 'Registered Account',
        client_phone: profile?.phone || '',
        service_id: selectedService.id,
        staff_id: selectedStaff?.id || null,
        booking_date: bookingDate,
        start_time: bookingTime,
        end_time: endTime,
        total_price: selectedService.price,
        notes: rebookBookingId ? `[RE-BOOKED] ${bookingNotes || ''}`.trim() : bookingNotes,
        status: 'pending',
        created_by: validCreatedBy,
      }

      if (rebookBookingId) {
        const { error } = await supabase
          .from('bookings')
          .update({ ...newBooking, cancellation_reason: null } as any)
          .eq('id', rebookBookingId)
        
        if (error) throw error
        
        // Remove from local cancelled list if it was cancelled locally
        const cancelled = new Set(JSON.parse(localStorage.getItem('marquevedo_cancelled_bookings') || '[]'))
        if (cancelled.has(rebookBookingId)) {
          cancelled.delete(rebookBookingId)
          localStorage.setItem('marquevedo_cancelled_bookings', JSON.stringify(Array.from(cancelled)))
        }
      } else {
        const { error } = await supabase
          .from('bookings')
          .insert(newBooking as any)

        if (error) throw error
      }

      toast.success(rebookBookingId ? 'Appointment re-booked successfully!' : 'Appointment booked successfully!')
      setShowBookingModal(false)
      setRebookBookingId(null)
      refetch()
      setActiveTab('bookings')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit booking')
    } finally {
      setSubmittingBooking(false)
    }
  }

  // Filter bookings using client-side cancellation overrides
  const cancelledIds = new Set<string>(JSON.parse(localStorage.getItem('marquevedo_cancelled_bookings') || '[]'))

  const processedBookings = (myBookings || []).map(b =>
    cancelledIds.has(b.id) ? { ...b, status: 'cancelled' } : b
  )

  const upcomingBookings = processedBookings.filter(b => b.status === 'pending' || b.status === 'confirmed') || []
  const pastBookings = processedBookings.filter(b => b.status === 'completed' || b.status === 'cancelled') || []

  const categories = [
    { id: 'All', category: 'All', icon: Sparkles, label: 'All' },
    { id: 'Haircut', category: 'Hair', icon: Scissors, label: 'Haircut', keyword: 'cut' },
    { id: 'Coloring', category: 'Hair', icon: Palette, label: 'Coloring', keyword: 'color' },
    { id: 'Hair Spa', category: 'Hair', icon: Sparkles, label: 'Hair Spa', keyword: 'spa' },
    { id: 'Nails', category: 'Nails', icon: Sparkles, label: 'Nails', keyword: 'nail' },
    { id: 'Treatments', category: 'Other', icon: Package, label: 'Treatments', keyword: 'treatment' },
  ]

  const filteredServices = services?.filter(s => {
    const activeCatObj = categories.find(c => c.id === selectedCategory)
    let matchesCategory = true
    if (activeCatObj && activeCatObj.id !== 'All') {
      if (activeCatObj.keyword) {
        matchesCategory = s.name.toLowerCase().includes(activeCatObj.keyword) || s.category === activeCatObj.category
      } else {
        matchesCategory = s.category === activeCatObj.category
      }
    }
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  }) || []

  const timeSlots = generateTimeSlots()

  const handleTabSwitch = (tab: 'home' | 'bookings' | 'profile') => {
    setActiveTab(tab)
    queryClient.invalidateQueries()
  }

  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = () => {
    setShowLogoutModal(true)
  }

  const confirmLogout = async () => {
    setShowLogoutModal(false)
    toast.success('Logged out successfully')
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#061510] via-[#092219] to-[#040E0A] text-white pb-24 font-body">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-[#061510]/90 backdrop-blur-md border-b border-gold/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Logo"
              className="w-10 h-10 rounded-full ring-2 ring-gold/40 shadow-lg object-cover"
            />
            <div>
              <p className="text-[10px] text-gold uppercase tracking-widest font-semibold flex items-center gap-1">
                <MapPin size={10} /> Main Salon Branch
              </p>
              <h1 className="font-heading font-bold text-base text-white">
                Hello, <span className="text-gold">{profile?.full_name?.split(' ')[0] || 'Valued Client'}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-white/5 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Client Notification Permission Banner */}
      {showClientNotifBanner && (
        <div className="bg-gradient-to-r from-[#0B251C] via-[#091E17] to-[#040E0A] text-white p-3 px-4 border-b border-gold/30 shadow-md">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <Bell size={16} className="text-gold animate-bounce flex-shrink-0" />
              <span>Enable notifications to receive instant audio chime & status updates when your appointment is confirmed or completed!</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAllowClientNotifications}
                className="btn-gold text-xs py-1.5 px-3.5 font-bold shadow-sm flex items-center gap-1"
              >
                <Check size={14} /> Allow Notifications
              </button>
              <button
                onClick={handleDismissClientBanner}
                className="p-1 rounded bg-white/10 text-gray-300 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* TAB 1: EXPLORE / HOME */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fade-in">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find & book best services, stylists..."
                className="w-full pl-11 pr-12 py-3.5 bg-black/40 border border-gold/20 rounded-2xl text-xs text-white placeholder-emerald-200/40 focus:outline-none focus:border-gold/60 shadow-inner"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-gold/10 text-gold">
                <SlidersHorizontal size={16} />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-950 via-emerald-900 to-black border border-gold/30 p-5 shadow-xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full blur-3xl" />
              <div className="relative z-10 space-y-2 max-w-xs">
                <span className="text-[10px] font-bold text-gold bg-gold/15 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Special Package & Offers
                </span>
                <h3 className="font-heading font-extrabold text-xl text-white leading-tight">
                  LOOK AWESOME & SAVE 20% DISCOUNT
                </h3>
                <p className="text-xs text-emerald-200/80">
                  Hair Color + Rebond Special Combo Package
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => handleOpenBookingModal(services?.find(s => s.name.includes('Color')) || services?.[0])}
                    className="btn-gold text-xs py-2 px-4 font-bold shadow-md"
                  >
                    Book Now • ₱1,500
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-base text-white">Top Categories</h3>
                <span className="text-xs text-gold hover:underline cursor-pointer">View all</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[72px] transition-all border",
                      selectedCategory === cat.id
                        ? "bg-gold/20 border-gold text-gold shadow-lg font-bold"
                        : "bg-black/30 border-white/5 text-emerald-200 hover:border-gold/30"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-900/60 border border-gold/20 flex items-center justify-center text-xl shadow-md">
                      <cat.icon size={20} className="text-gold" />
                    </div>
                    <span className="text-[11px] font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {staffList && staffList.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-bold text-base text-white">Stylist Specialists</h3>
                  <span className="text-xs text-gold hover:underline cursor-pointer">View all</span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {staffList.map((staff) => {
                    const AvatarIcon = getStaffAvatarIcon(staff.color_code)
                    return (
                      <button
                        key={staff.id}
                        onClick={() => { setSelectedStaff(staff); handleOpenBookingModal() }}
                        className="bg-black/30 border border-gold/15 p-3 rounded-2xl min-w-[130px] text-center space-y-2 flex-shrink-0 hover:border-gold/50 transition-all text-left group"
                      >
                        <div
                          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg ring-2 ring-gold/30 shadow-md transition-transform group-hover:scale-105"
                          style={{ backgroundColor: staff.color_code || '#0A3D2E' }}
                        >
                          <AvatarIcon size={24} className="text-white drop-shadow-md" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-white truncate text-center">{staff.name}</p>
                          <p className="text-[10px] text-emerald-300/70 truncate text-center">{(staff as any).specialty || 'Senior Stylist'}</p>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-gold font-semibold">
                          <Star size={10} className="fill-gold" /> 4.9
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-base text-white">Popular Salon Treatments</h3>
                <span className="text-xs text-gold hover:underline cursor-pointer">View all</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-black/40 border border-emerald-800/40 p-4 rounded-2xl flex items-center justify-between hover:border-gold/40 transition-all group"
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-gold uppercase tracking-wider bg-gold/10 px-2 py-0.5 rounded-md">
                        {service.category}
                      </span>
                      <h4 className="font-bold text-sm text-white group-hover:text-gold transition-colors">
                        {service.name}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-emerald-200/70">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {formatDuration(service.duration_minutes)}
                        </span>
                        <span className="flex items-center gap-1 text-gold font-semibold">
                          <Star size={10} className="fill-gold" /> 4.9
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="font-heading font-bold text-lg text-gold block">
                        {formatCurrency(service.price)}
                      </span>
                      <button
                        onClick={() => handleOpenBookingModal(service)}
                        className="btn-gold inline-flex text-[11px] py-1.5 px-3 font-bold shadow-md"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-xl text-white flex items-center gap-2">
                <Calendar size={20} className="text-gold" /> My Appointments
              </h2>
              <button
                onClick={() => handleOpenBookingModal()}
                className="btn-gold text-xs py-2 px-3 font-bold flex items-center gap-1"
              >
                <Plus size={14} /> New Appointment
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gold uppercase tracking-wider">UPCOMING ({upcomingBookings.length})</h3>

              {bookingsLoading ? (
                <div className="space-y-2">
                  <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                  <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="bg-black/30 border border-emerald-800/40 p-8 rounded-2xl text-center space-y-2">
                  <CheckCircle size={36} className="text-gold/40 mx-auto" />
                  <p className="font-medium text-sm text-gray-300">No active upcoming appointments</p>
                  <p className="text-xs text-emerald-200/60">Schedule your next hair or nail service now.</p>
                  <button onClick={() => handleOpenBookingModal()} className="btn-gold inline-flex text-xs py-2 px-4 mt-2 font-bold">
                    Book Appointment
                  </button>
                </div>
              ) : (
                upcomingBookings.map((b: any, idx: number) => (
                  <div key={b.id ? `upcoming-${b.id}-${idx}` : `upcoming-${idx}`} className="bg-black/40 border border-gold/20 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-gold/30"
                          style={{ backgroundColor: b.staff?.color_code || '#0A3D2E' }}
                        >
                          {b.services?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{b.services?.name}</h4>
                          <p className="text-xs text-emerald-200/70">Stylist: {b.staff?.name || 'Any Available'}</p>
                        </div>
                      </div>
                      <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold capitalize', getStatusColor(b.status))}>
                        {b.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-emerald-200/80">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar size={12} className="text-gold" /> {formatDate(b.booking_date)}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <Clock size={12} className="text-gold" /> {formatTime(b.start_time)}
                          </span>
                        </div>
                        <span className="hidden sm:inline text-white/20">•</span>
                        <span className="text-[10px] text-emerald-200/50">
                          Booked: {new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold text-gold text-sm">{formatCurrency(b.total_price)}</span>
                        <button
                          onClick={() => setCancelModalBookingId(b.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors w-full sm:w-auto justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {pastBookings.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-emerald-800/40">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Past History ({pastBookings.length})</h3>
                <div className="space-y-2">
                  {pastBookings.map((b: any, idx: number) => (
                    <div key={b.id ? `past-${b.id}-${idx}` : `past-${idx}`} className="bg-black/20 border border-white/5 p-3 rounded-xl flex flex-col text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">{b.services?.name}</p>
                          <p className="text-[11px] text-gray-400">{formatDate(b.booking_date)} • {formatTime(b.start_time)}</p>
                          <p className="text-[9px] text-emerald-200/50 mt-0.5">Booked: {new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', getStatusColor(b.status))}>
                            {b.status}
                          </span>
                          <span className="font-bold text-gold">{formatCurrency(b.total_price)}</span>
                          {ratedIds.includes(b.id) ? (
                            <span className="text-[10px] bg-gold/15 text-gold px-2.5 py-1 rounded-full font-bold border border-gold/30 flex items-center gap-1">
                              <Star size={10} className="fill-gold" /> Rated
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenRatingModal(b)}
                              className="btn-gold text-[10px] py-1 px-2.5 font-bold shadow-sm flex items-center gap-1"
                            >
                              <Star size={10} className="fill-gold" /> Rate & Review
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenBookingModal(b.services, b.id)}
                            className="text-emerald-200/70 hover:text-gold text-[11px] font-medium flex items-center gap-1"
                          >
                            <RefreshCw size={10} /> Re-book
                          </button>
                        </div>
                      </div>
                      {b.status === 'cancelled' && b.cancellation_reason && (
                        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 mt-3">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-semibold text-red-400">Cancellation Reason: </span>
                              <span className="text-gray-300 italic">{b.cancellation_reason}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-black/40 border border-gold/20 p-6 rounded-2xl text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-emerald-900 border-2 border-gold mx-auto flex items-center justify-center font-bold text-2xl text-gold shadow-lg">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <h2 className="font-heading font-bold text-xl text-white">{profile?.full_name || 'Client Account'}</h2>
                <p className="text-xs text-emerald-200/80">{profile?.email || 'Registered User'}</p>
                {profile?.phone && <p className="text-xs text-gold font-semibold mt-1 flex items-center justify-center gap-1"><Phone size={12} /> {profile.phone}</p>}
                {profile?.location && <p className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-center gap-1"><MapPin size={10} /> {profile.location}</p>}
                <span className="inline-block mt-3 text-[10px] font-bold text-gold uppercase bg-gold/15 px-3 py-1 rounded-full border border-gold/30">
                  Verified Client Account
                </span>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5 text-sm">
              <button onClick={() => setActiveTab('bookings')} className="w-full p-4 text-left flex items-center justify-between text-white hover:bg-white/5">
                <span className="flex items-center gap-3"><Calendar size={16} className="text-gold" /> My Appointments</span>
                <span className="text-xs text-gray-400">→</span>
              </button>
              <button onClick={() => handleOpenBookingModal()} className="w-full p-4 text-left flex items-center justify-between text-white hover:bg-white/5">
                <span className="flex items-center gap-3"><Plus size={16} className="text-gold" /> Book New Service</span>
                <span className="text-xs text-gray-400">→</span>
              </button>
              <button onClick={handleLogout} className="w-full p-4 text-left flex items-center justify-between text-red-400 hover:bg-red-500/10">
                <span className="flex items-center gap-3"><LogOut size={16} /> Sign Out</span>
                <span className="text-xs text-red-400">→</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. Single-Screen Quick Book Appointment Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gradient-to-b from-[#0B251C] via-[#091E17] to-[#040E0A] text-white rounded-3xl border border-gold/30 w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in my-auto">
            <div className="p-5 border-b border-gold/20 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <Scissors size={20} className="text-gold" />
                <h3 className="font-heading font-bold text-lg text-white">Book Appointment</h3>
              </div>
              <button
                onClick={() => { setShowBookingModal(false); setRebookBookingId(null); }}
                className="p-1.5 rounded-full bg-white/10 text-gray-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickBookSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-gold uppercase tracking-wider text-[11px]">Choose Your Service</label>
                  <span className="font-heading font-extrabold text-base text-gold">
                    Total: {formatCurrency(selectedService?.price || 0)}
                  </span>
                </div>
                <select
                  value={selectedService?.id || ''}
                  onChange={(e) => {
                    const s = services?.find(item => item.id === e.target.value)
                    if (s) setSelectedService(s)
                  }}
                  className="w-full py-3 px-4 bg-black/60 border border-gold/30 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-gold"
                  required
                >
                  {services?.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#0B251C] text-white">
                      {s.name} ({formatDuration(s.duration_minutes)}) — {formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gold uppercase tracking-wider text-[11px]">Select Specialist Stylist</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className={cn(
                      "p-2.5 rounded-xl border text-center font-medium transition-all flex flex-col items-center gap-1",
                      selectedStaff === null
                        ? "bg-gold text-[#061510] border-gold shadow-md font-bold"
                        : "bg-black/40 border-white/10 text-emerald-200 hover:border-gold/30"
                    )}
                  >
                    <span>Any Stylist</span>
                    <span className="text-[9px] opacity-75">Auto-assign</span>
                  </button>

                  {staffList?.map(staff => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => setSelectedStaff(staff)}
                      className={cn(
                        "p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 truncate",
                        selectedStaff?.id === staff.id
                          ? "bg-gold text-[#061510] border-gold shadow-md font-bold"
                          : "bg-black/40 border-white/10 text-emerald-200 hover:border-gold/30"
                      )}
                    >
                      <span className="truncate w-full">{staff.name}</span>
                      <span className="text-[9px] opacity-75 truncate">Senior Stylist</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gold uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <Calendar size={12} /> Select Date (Opens Calendar) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={getTodayISO()}
                    className="w-full py-3 px-4 bg-black/60 border border-gold/30 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-gold cursor-pointer input-dark"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {/* Event Alert Banner */}
                {hasClientDateEvents && (
                  <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3 mb-2 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={15} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-amber-300">
                          {isWholeDayBlocked ? 'Date Unavailable (Whole Day Event)' : 'Scheduled Salon Event'}
                        </p>
                        <p className="text-[10px] text-amber-400/80">
                          {isWholeDayBlocked
                            ? 'The salon is closed for a full-day event. Please pick another date.'
                            : 'Time slots during the event are blocked. Other slots remain available!'}
                        </p>
                      </div>
                    </div>

                    {clientDateEvents?.map((evt: any) => (
                      <div key={evt.id} className="bg-black/40 border border-amber-500/20 rounded-lg p-2 flex items-center gap-2">
                        <Sparkles size={12} className="text-gold flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-gold truncate">{evt.title}</p>
                          <p className="text-[10px] text-gray-300">
                            {evt.is_all_day ? 'Whole Day' : `${formatTime(evt.start_time)} — ${formatTime(evt.end_time)}`}
                            {evt.notes ? ` · ${evt.notes}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isWholeDayBlocked && (
                  <>
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-gold uppercase tracking-wider text-[11px]">
                        Select Available Time Slot
                      </label>
                      <span className="text-[10px] text-emerald-300/70">
                        {dateBookings?.length || 0} slots taken today
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                      {timeSlots.map(slot => {
                        const isBooked = isTimeSlotTaken(slot)
                        const isEventBlocked = isSlotBlockedByPartialEvent(slot)
                        const disabled = isBooked || isEventBlocked

                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={disabled}
                            onClick={() => setBookingTime(slot)}
                            className={cn(
                              "py-2 rounded-lg text-[11px] font-semibold transition-all border relative overflow-hidden",
                              isEventBlocked
                                ? "bg-amber-950/60 text-amber-500/70 border-amber-500/30 cursor-not-allowed opacity-60"
                                : isBooked
                                ? "bg-gray-800/60 text-gray-500 border-gray-700/40 cursor-not-allowed line-through opacity-50"
                                : bookingTime === slot
                                ? "bg-gold text-[#061510] border-gold shadow-md font-bold"
                                : "bg-black/40 text-emerald-200 border-white/10 hover:border-gold/30"
                            )}
                            title={
                              isEventBlocked
                                ? 'Blocked by Salon Event'
                                : isBooked
                                ? 'Already booked'
                                : 'Available'
                            }
                          >
                            {formatTime(slot)}
                            {isEventBlocked && <span className="block text-[8px] no-underline text-amber-400 font-bold">Event</span>}
                            {!isEventBlocked && isBooked && <span className="block text-[8px] no-underline text-red-400">Booked</span>}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-gold/20 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Client Name:</span>
                  <span className="font-bold text-gold">{profile?.full_name || 'Registered Account'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Mobile Phone:</span>
                  <span className="font-bold text-white">{profile?.phone || '0917 123 4567'}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingBooking || isTimeSlotTaken(bookingTime) || isSlotBlockedByPartialEvent(bookingTime)}
                className="btn-gold w-full py-3.5 text-sm font-bold shadow-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {submittingBooking ? 'Booking Appointment...' : 'Book Now'} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4.5. Rate & Review Modal */}
      {showRatingModal && ratingBooking && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gradient-to-b from-[#0B251C] via-[#091E17] to-[#040E0A] text-white rounded-3xl border border-gold/30 w-full max-w-md overflow-hidden shadow-2xl animate-scale-in my-auto">
            <div className="p-5 border-b border-gold/20 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <Star size={20} className="text-gold fill-gold" />
                <h3 className="font-heading font-bold text-lg text-white">Rate Salon Service</h3>
              </div>
              <button
                onClick={() => setShowRatingModal(false)}
                className="p-1.5 rounded-full bg-white/10 text-gray-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRating} className="p-5 space-y-4 text-xs">
              <div className="text-center space-y-1 bg-black/30 p-3 rounded-xl border border-white/5">
                <p className="font-bold text-white text-sm">{ratingBooking.services?.name || 'Salon Treatment'}</p>
                <p className="text-[11px] text-emerald-200/70">Completed on {formatDate(ratingBooking.booking_date)}</p>
              </div>

              <div className="space-y-1.5 text-center">
                <label className="font-bold text-gold uppercase tracking-wider text-[11px]">Select Your Rating</label>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        size={28}
                        className={cn(
                          "transition-colors",
                          star <= ratingStars ? "fill-gold text-gold" : "text-gray-600"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gold uppercase tracking-wider text-[11px]">Your Review Comment</label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Tell us about your experience with your hair stylist, salon environment, or results..."
                  rows={3}
                  className="w-full p-3 bg-black/60 border border-gold/30 rounded-xl text-white text-xs placeholder-emerald-300/40 focus:outline-none focus:border-gold resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingRating || !ratingComment.trim()}
                className="btn-gold w-full py-3.5 text-sm font-bold shadow-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {submittingRating ? 'Submitting Review...' : 'Submit Review'} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Bottom Mobile Floating Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#061510]/95 backdrop-blur-lg border-t border-gold/20 py-2.5 px-6">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => handleTabSwitch('home')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              activeTab === 'home' ? "text-gold" : "text-emerald-200/50 hover:text-white"
            )}
          >
            <Home size={20} />
            <span>Explore</span>
          </button>

          <button
            onClick={() => handleTabSwitch('bookings')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors relative",
              activeTab === 'bookings' ? "text-gold" : "text-emerald-200/50 hover:text-white"
            )}
          >
            <Bookmark size={20} />
            <span>Bookings</span>
            {upcomingBookings.length > 0 && (
              <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-gold animate-ping" />
            )}
          </button>

          <button
            onClick={() => handleOpenBookingModal()}
            className="w-12 h-12 rounded-full bg-gold text-[#061510] flex items-center justify-center font-bold shadow-lg ring-4 ring-[#061510] -mt-5 hover:scale-105 transition-transform"
            title="Book Appointment"
          >
            <Scissors size={22} />
          </button>

          <button
            onClick={() => handleTabSwitch('profile')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              activeTab === 'profile' ? "text-gold" : "text-emerald-200/50 hover:text-white"
            )}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#092219] border border-gold/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 animate-scale-in my-auto">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-gold">Confirm Logout</h3>
              <p className="text-xs text-emerald-200/80 mt-1">
                Are you sure you want to log out of your MarQuevedo client account?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 rounded-xl border border-white/20 text-white font-bold text-xs hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {cancelModalBookingId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-gold/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl scale-in-center">
            <div className="flex justify-between items-center p-5 border-b border-gold/10 bg-neutral-900/50">
              <h3 className="font-playfair text-xl font-bold text-gold flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" />
                Cancel Appointment
              </h3>
              <button 
                onClick={() => {
                  setCancelModalBookingId(null)
                  setCancelReason('')
                }}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-sm text-red-200 leading-relaxed">
                You are about to cancel this appointment. If you wish, please provide a reason below so the salon is informed.
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Reason (Optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Scheduling conflict, feeling unwell..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all resize-none h-24"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setCancelModalBookingId(null)
                    setCancelReason('')
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-medium text-sm text-gray-300"
                >
                  Keep Appointment
                </button>
                <button
                  onClick={cancelBooking}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors font-medium text-sm flex justify-center items-center gap-2 shadow-lg shadow-red-900/20"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
