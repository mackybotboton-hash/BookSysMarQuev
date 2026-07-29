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
  Home, Bookmark, Compass, X, ArrowRight, Check, AlertTriangle, Palette, Package, Info, Sun, Moon,
  ChevronRight, BadgeCheck, XCircle, CheckCircle2, Droplets
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

  // Light Mode State
  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('marquevedo_light_mode')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('marquevedo_light_mode', String(isLightMode))
  }, [isLightMode])

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
  const [isHomeService, setIsHomeService] = useState(false)
  const [homeAddress, setHomeAddress] = useState('')
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
  
  // History Filter State
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [historyDate, setHistoryDate] = useState('')
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'confirmed'>('all')

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
    setIsHomeService(false)
    setHomeAddress('')
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

    if (isHomeService && !homeAddress.trim()) {
      toast.error('Please provide the exact home address.')
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

      let finalNotes = bookingNotes
      if (isHomeService) {
        finalNotes = `[HOME SERVICE] Address: ${homeAddress.trim()}\n${finalNotes}`.trim()
      }

      const basePrice = selectedService.price || 0
      const homeServiceFee = selectedService.home_service_price || 0
      const finalPrice = isHomeService ? basePrice + homeServiceFee : basePrice

      const newBooking = {
        client_name: profile?.full_name || 'Registered Account',
        client_phone: profile?.phone || '',
        service_id: selectedService.id,
        staff_id: selectedStaff?.id || null,
        booking_date: bookingDate,
        start_time: bookingTime,
        end_time: endTime,
        total_price: finalPrice,
        notes: rebookBookingId ? `[RE-BOOKED] ${finalNotes || ''}`.trim() : finalNotes,
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

  const allUpcoming = processedBookings.filter(b => b.status === 'pending' || b.status === 'confirmed') || []
  const upcomingBookings = upcomingFilter === 'all' ? allUpcoming : allUpcoming.filter(b => b.status === upcomingFilter)
  const pastBookings = processedBookings.filter(b => b.status === 'completed' || b.status === 'cancelled') || []

  // Derive dynamic categories from DB
  const dbCategories = Array.from(new Set(services?.map(s => s.category) || []))
  
  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase()
    if (lower.includes('hair')) return Scissors
    if (lower.includes('nail')) return Sparkles
    if (lower.includes('color')) return Palette
    if (lower.includes('spa') || lower.includes('facial')) return Droplets
    return Package
  }

  const categories = [
    { id: 'All', category: 'All', icon: Sparkles, label: 'All' },
    ...dbCategories.map(cat => ({
      id: cat,
      category: cat,
      icon: getCategoryIcon(cat),
      label: cat,
    }))
  ]

  const filteredServices = services?.filter(s => {
    const matchesCategory = selectedCategory === 'All' ? true : s.category === selectedCategory
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  }) || []

  const timeSlots = generateTimeSlots(8, 21)

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
    <div className={cn(
      "min-h-screen pb-24 font-body transition-colors duration-500",
      isLightMode ? "bg-offwhite text-charcoal" : "bg-gradient-to-b from-[#061510] via-[#092219] to-[#040E0A] text-white"
    )}>
      {/* 1. Header Bar */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b px-4 py-3 transition-colors duration-500",
        isLightMode ? "bg-white/70 border-emerald-100/50" : "bg-[#061510]/90 border-gold/10"
      )}>
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
              <h1 className={cn("font-heading font-bold text-base capitalize", isLightMode ? "text-emerald-950" : "text-white")}>
                Hello, <span className={cn(isLightMode ? "text-emerald-600" : "text-gold")}>{profile?.full_name?.split(' ')[0] || 'Valued Client'}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className={cn(
                "p-2 rounded-full transition-colors flex items-center justify-center",
                isLightMode ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100" : "bg-white/5 text-gold hover:bg-white/10 border border-gold/20"
              )}
              title="Toggle Theme"
            >
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={handleLogout}
              className={cn(
                "p-2 rounded-full border transition-colors flex items-center justify-center",
                isLightMode ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100" : "bg-white/5 border-red-500/20 text-red-400 hover:bg-red-500/20"
              )}
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
                className={cn(
                  "w-full pl-11 pr-12 py-3.5 border rounded-2xl text-xs focus:outline-none shadow-inner transition-colors",
                  isLightMode ? "bg-white border-emerald-100 text-charcoal placeholder-gray-400 focus:border-emerald-300" : "bg-black/40 border-gold/20 text-white placeholder-emerald-200/40 focus:border-gold/60"
                )}
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-gold/10 text-gold">
                <SlidersHorizontal size={16} />
              </button>
            </div>

            <div className={cn(
              "relative rounded-2xl overflow-hidden border p-5 transition-all duration-300",
              isLightMode ? "bg-emerald-50 border-emerald-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:-translate-y-1" : "bg-gradient-to-r from-emerald-950 via-emerald-900 to-black border-gold/30 shadow-xl hover:border-gold/50"
            )}>
              <div className={cn("absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl", isLightMode ? "bg-emerald-200/50" : "bg-gold/10")} />
              <div className="relative z-10 space-y-2 max-w-xs">
                <span className="text-[10px] font-bold text-gold bg-gold/15 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Special Package & Offers
                </span>
                <h3 className={cn("font-heading font-extrabold text-xl leading-tight", isLightMode ? "text-emerald-950" : "text-white")}>
                  LOOK AWESOME & SAVE 20% DISCOUNT
                </h3>
                <p className={cn("text-xs", isLightMode ? "text-emerald-800" : "text-emerald-200/80")}>
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
                <h3 className={cn("font-heading font-bold text-base", isLightMode ? "text-emerald-950" : "text-white")}>Top Categories</h3>
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
                        : isLightMode 
                          ? "bg-white border-emerald-100 text-emerald-800 hover:border-emerald-300 shadow-sm"
                          : "bg-black/30 border-white/10 text-emerald-200 hover:border-gold/30"
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
                  <h3 className={cn("font-heading font-bold text-base", isLightMode ? "text-emerald-950" : "text-white")}>Stylist Specialists</h3>
                  <span className="text-xs text-gold hover:underline cursor-pointer">View all</span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {staffList.map((staff) => {
                    const AvatarIcon = getStaffAvatarIcon(staff.color_code)
                    return (
                      <button
                        key={staff.id}
                        onClick={() => { setSelectedStaff(staff); handleOpenBookingModal() }}
                        className={cn(
                          "p-3 rounded-2xl min-w-[130px] text-center space-y-2 flex-shrink-0 transition-all text-left group border",
                          isLightMode ? "bg-white border-emerald-100 hover:border-emerald-300 shadow-sm" : "bg-black/30 border-gold/15 hover:border-gold/50"
                        )}
                      >
                        <div
                          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl ring-2 ring-gold/30 shadow-md transition-transform group-hover:scale-105 drop-shadow-sm"
                          style={{ backgroundColor: staff.color_code || '#0A3D2E' }}
                        >
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={cn("font-bold text-xs truncate text-center capitalize", isLightMode ? "text-emerald-950" : "text-white")}>{staff.name}</p>
                          <p className={cn("text-[10px] truncate text-center", isLightMode ? "text-emerald-700" : "text-emerald-300/70")}>{(staff as any).specialty || 'Senior Stylist'}</p>
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
                <h3 className={cn("font-heading font-bold text-base", isLightMode ? "text-emerald-950" : "text-white")}>Popular Salon Treatments</h3>
                <span className="text-xs text-gold hover:underline cursor-pointer">View all</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    className={cn(
                      "p-4 rounded-2xl flex items-center justify-between transition-all group border",
                      isLightMode ? "bg-white border-emerald-100 hover:border-emerald-300 shadow-sm" : "bg-black/40 border-emerald-800/40 hover:border-gold/40"
                    )}
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-gold uppercase tracking-wider bg-gold/10 px-2 py-0.5 rounded-md">
                        {service.category}
                      </span>
                      <h4 className={cn("font-bold text-sm transition-colors", isLightMode ? "text-emerald-950 group-hover:text-emerald-600" : "text-white group-hover:text-gold")}>
                        {service.name}
                      </h4>
                      <div className={cn("flex items-center gap-3 text-[11px]", isLightMode ? "text-emerald-900 font-medium" : "text-emerald-200/70")}>
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
          <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <h2 className={cn("font-heading font-bold text-xl flex items-center gap-2", isLightMode ? "text-emerald-950" : "text-white")}>
                <Calendar size={20} className={cn(isLightMode ? "text-amber-600" : "text-gold")} /> My Appointments
              </h2>
              <button
                onClick={() => handleOpenBookingModal()}
                className="btn-gold text-xs py-2 px-3 font-bold flex items-center gap-1"
              >
                <Plus size={14} /> New Appointment
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={cn("text-xs font-bold uppercase tracking-wider", isLightMode ? "text-amber-600" : "text-gold")}>
                  UPCOMING ({allUpcoming.length})
                </h3>
                <div className={cn("flex items-center gap-1 p-0.5 rounded-lg border", isLightMode ? "bg-gray-100 border-gray-200" : "bg-black/30 border-white/10")}>
                  <button 
                    onClick={() => setUpcomingFilter('all')} 
                    className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", upcomingFilter === 'all' ? (isLightMode ? "bg-amber-500 text-white" : "bg-gold text-black") : (isLightMode ? "text-gray-500 hover:text-amber-600" : "text-gray-400 hover:text-white"))}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setUpcomingFilter('confirmed')} 
                    className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", upcomingFilter === 'confirmed' ? (isLightMode ? "bg-amber-500 text-white" : "bg-gold text-black") : (isLightMode ? "text-gray-500 hover:text-amber-600" : "text-gray-400 hover:text-white"))}
                  >
                    Confirmed
                  </button>
                </div>
              </div>

              {bookingsLoading ? (
                <div className="space-y-2">
                  <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                  <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className={cn("p-8 rounded-2xl text-center space-y-2 border", isLightMode ? "bg-white border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" : "bg-black/30 border-emerald-800/40")}>
                  <CheckCircle size={36} className={cn("mx-auto", isLightMode ? "text-amber-600/50" : "text-gold/40")} />
                  <p className={cn("font-medium text-sm", isLightMode ? "text-charcoal" : "text-gray-300")}>No active upcoming appointments</p>
                  <p className={cn("text-xs", isLightMode ? "text-emerald-800/70" : "text-emerald-200/60")}>Schedule your next hair or nail service now.</p>
                  <button onClick={() => handleOpenBookingModal()} className="btn-gold inline-flex text-xs py-2 px-4 mt-2 font-bold">
                    Book Appointment
                  </button>
                </div>
              ) : (
                upcomingBookings.map((b: any, idx: number) => (
                  <div key={b.id ? `upcoming-${b.id}-${idx}` : `upcoming-${idx}`} className={cn("p-4 rounded-2xl space-y-3 border transition-all duration-300", isLightMode ? "bg-white border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:-translate-y-1" : "bg-black/40 border-gold/20 hover:border-gold/50")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-gold/30"
                          style={{ backgroundColor: b.staff?.color_code || '#0A3D2E' }}
                        >
                          {b.services?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <h4 className={cn("font-bold text-sm", isLightMode ? "text-emerald-950" : "text-white")}>{b.services?.name}</h4>
                          <p className={cn("text-xs capitalize", isLightMode ? "text-emerald-700" : "text-emerald-200/70")}>Stylist: {b.staff?.name || 'Any Available'}</p>
                        </div>
                      </div>
                      <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold capitalize flex items-center gap-1.5', getStatusColor(b.status))}>
                        {b.status === 'completed' ? <CheckCircle2 size={12} /> : b.status === 'cancelled' ? <XCircle size={12} /> : b.status === 'confirmed' ? <Check size={12} /> : <Clock size={12} />}
                        {b.status}
                      </span>
                    </div>

                    <div className={cn("pt-2 border-t flex flex-col gap-2", isLightMode ? "border-emerald-50 text-emerald-950 font-medium" : "border-white/5 text-emerald-200/80")}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar size={12} className={cn(isLightMode ? "text-amber-600" : "text-gold")} /> {formatDate(b.booking_date)}
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <Clock size={12} className={cn(isLightMode ? "text-amber-600" : "text-gold")} /> {formatTime(b.start_time)}
                            </span>
                          </div>
                          <span className="hidden sm:inline text-white/20">•</span>
                          <span className={cn("text-[10px]", isLightMode ? "text-emerald-800/80 font-medium" : "text-emerald-200/50")}>
                            Booked: {new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("font-heading font-bold text-sm", isLightMode ? "text-amber-600" : "text-gold")}>{formatCurrency(b.total_price)}</span>
                          <button
                            onClick={() => setCancelModalBookingId(b.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors w-full sm:w-auto justify-center"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                      
                      {b.notes?.includes('[HOME SERVICE]') && (
                        <div className={cn("px-2.5 py-2 rounded-lg flex items-start gap-2", isLightMode ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-gold/10 text-gold border border-gold/20")}>
                          <Home size={14} className="shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight break-words">
                            <span className="font-bold uppercase tracking-wider block mb-0.5">Home Service</span>
                            {b.notes.replace('[HOME SERVICE]', '').trim().replace(/^Address:\s*/, '')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {pastBookings.length > 0 && (
              <div className={cn("space-y-3 pt-4 border-t", isLightMode ? "border-emerald-100" : "border-emerald-800/40")}>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Past History ({pastBookings.length})</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full sm:w-48">
                      <Search className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", isLightMode ? "text-emerald-700/50" : "text-gray-400")} size={14} />
                      <input
                        type="text"
                        placeholder="Search history..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className={cn("w-full pl-8 pr-3 py-1.5 text-[11px] font-medium border rounded-lg focus:outline-none", isLightMode ? "bg-white border-emerald-100 text-emerald-950 focus:border-amber-500" : "bg-black/40 border-gold/20 text-white focus:border-gold")}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="date"
                        value={historyDate}
                        onChange={(e) => setHistoryDate(e.target.value)}
                        className={cn("py-1.5 px-2 flex-1 sm:flex-none text-[11px] font-medium border rounded-lg focus:outline-none cursor-pointer", isLightMode ? "bg-white border-emerald-100 text-emerald-950 focus:border-amber-500" : "bg-black/40 border-gold/20 text-white focus:border-gold")}
                        title="Filter by date"
                      />
                      <select
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value as any)}
                        className={cn("py-1.5 px-2 flex-1 sm:flex-none text-[11px] font-medium border rounded-lg focus:outline-none appearance-none cursor-pointer", isLightMode ? "bg-white border-emerald-100 text-emerald-950 focus:border-amber-500" : "bg-black/40 border-gold/20 text-white focus:border-gold")}
                      >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {pastBookings.filter((b: any) => {
                    const matchesSearch = b.services?.name?.toLowerCase().includes(historySearch.toLowerCase()) || b.notes?.toLowerCase().includes(historySearch.toLowerCase());
                    const matchesFilter = historyFilter === 'all' || b.status === historyFilter;
                    const matchesDate = !historyDate || b.booking_date === historyDate;
                    return matchesSearch && matchesFilter && matchesDate;
                  }).map((b: any, idx: number) => (
                    <div key={b.id ? `past-${b.id}-${idx}` : `past-${idx}`} className={cn("p-3 rounded-xl flex flex-col text-xs border transition-all duration-300", isLightMode ? "bg-white border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:-translate-y-1" : "bg-black/20 border-white/10 hover:border-gold/30")}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("font-semibold", isLightMode ? "text-emerald-950" : "text-white")}>{b.services?.name}</p>
                          <p className={cn("text-[11px]", isLightMode ? "text-emerald-900 font-medium" : "text-gray-400")}>{formatDate(b.booking_date)} • {formatTime(b.start_time)}</p>
                          <p className={cn("text-[9px] mt-0.5", isLightMode ? "text-emerald-800/80 font-medium" : "text-emerald-200/50")}>Booked: {new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize flex items-center gap-1', getStatusColor(b.status))}>
                            {b.status === 'completed' ? <CheckCircle2 size={10} /> : b.status === 'cancelled' ? <XCircle size={10} /> : b.status === 'confirmed' ? <Check size={10} /> : <Clock size={10} />}
                            {b.status}
                          </span>
                          <span className={cn("font-bold", isLightMode ? "text-amber-600" : "text-gold")}>{formatCurrency(b.total_price)}</span>
                          {b.status === 'completed' && (
                            ratedIds.includes(b.id) ? (
                              <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1", isLightMode ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-gold/15 text-gold border-gold/30")}>
                                <Star size={10} className={cn(isLightMode ? "fill-amber-500 text-amber-500" : "fill-gold text-gold")} /> Rated
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenRatingModal(b)}
                                className="btn-gold text-[10px] py-1 px-2.5 font-bold shadow-sm flex items-center gap-1"
                              >
                                <Star size={10} className="fill-gold" /> Rate & Review
                              </button>
                            )
                          )}
                          <button
                            onClick={() => handleOpenBookingModal(b.services, b.id)}
                            className={cn("text-[11px] font-medium flex items-center gap-1", isLightMode ? "text-emerald-500 hover:text-amber-600" : "text-emerald-200/70 hover:text-gold")}
                          >
                            <RefreshCw size={10} /> Re-book
                          </button>
                        </div>
                      </div>
                      {b.status === 'cancelled' && b.cancellation_reason && b.cancellation_reason.trim() !== '' && (
                        <div className={cn("border rounded-md px-2.5 py-2 mt-2", isLightMode ? "bg-red-50 border-red-200" : "bg-red-950/20 border-red-900/30")}>
                          <div className="flex items-start gap-1.5">
                            <Info className={cn("w-3.5 h-3.5 shrink-0 mt-[1px]", isLightMode ? "text-red-500" : "text-red-400")} />
                            <div className="text-[11px] leading-tight">
                              <span className={cn("font-semibold", isLightMode ? "text-red-700" : "text-red-400")}>Cancellation Reason: </span>
                              <span className={cn("italic", isLightMode ? "text-red-900" : "text-gray-300")}>{b.cancellation_reason}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {b.notes?.includes('[HOME SERVICE]') && (
                        <div className={cn("border rounded-md px-2.5 py-2 mt-2 flex items-start gap-1.5", isLightMode ? "bg-amber-50 border-amber-200" : "bg-gold/10 border-gold/30")}>
                          <Home className={cn("w-3.5 h-3.5 shrink-0 mt-[1px]", isLightMode ? "text-amber-600" : "text-gold")} />
                          <div className="text-[11px] leading-tight">
                            <span className={cn("font-bold uppercase tracking-wider", isLightMode ? "text-amber-800" : "text-gold")}>Home Service: </span>
                            <span className={cn("italic", isLightMode ? "text-amber-900" : "text-gray-300")}>{b.notes.replace('[HOME SERVICE]', '').trim().replace(/^Address:\s*/, '')}</span>
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
          <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            <div className={cn("p-6 rounded-2xl text-center space-y-3 border", isLightMode ? "bg-white border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" : "bg-black/40 border-gold/20")}>
              <div className="w-20 h-20 rounded-full bg-emerald-900 border-2 border-gold mx-auto flex items-center justify-center font-bold text-2xl text-gold shadow-lg">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <h2 className={cn("font-heading font-bold text-xl capitalize", isLightMode ? "text-emerald-950" : "text-white")}>{profile?.full_name || 'Client Account'}</h2>
                <p className={cn("text-xs", isLightMode ? "text-emerald-700" : "text-emerald-200/80")}>{profile?.email || 'Registered User'}</p>
                {profile?.phone && <p className="text-xs text-gold font-semibold mt-1 flex items-center justify-center gap-1"><Phone size={12} /> {profile.phone}</p>}
                {profile?.location && <p className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-center gap-1"><MapPin size={10} /> {profile.location}</p>}
                <span className="inline-flex mt-3 text-[10px] font-bold text-gold uppercase bg-gold/15 px-3 py-1 rounded-full border border-gold/30 items-center gap-1">
                  <BadgeCheck size={12} className="text-gold" /> Verified Client Account
                </span>
              </div>
            </div>

            <div className={cn("rounded-2xl overflow-hidden divide-y text-sm border", isLightMode ? "bg-white border-emerald-100 divide-emerald-50 shadow-sm" : "bg-black/30 border-white/10 divide-white/10")}>
              <button onClick={() => setActiveTab('bookings')} className={cn("w-full p-4 text-left flex items-center justify-between", isLightMode ? "text-emerald-950 hover:bg-emerald-50" : "text-white hover:bg-white/5")}>
                <span className="flex items-center gap-3"><Calendar size={16} className="text-gold" /> My Appointments</span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
              <button onClick={() => handleOpenBookingModal()} className={cn("w-full p-4 text-left flex items-center justify-between", isLightMode ? "text-emerald-950 hover:bg-emerald-50" : "text-white hover:bg-white/5")}>
                <span className="flex items-center gap-3"><Plus size={16} className="text-gold" /> Book New Service</span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
              <button onClick={() => handleLogout()} className={cn("w-full p-4 text-left flex items-center justify-between", isLightMode ? "text-red-600 hover:bg-red-50" : "text-red-400 hover:bg-red-500/10")}>
                <span className="flex items-center gap-3"><LogOut size={16} className="text-red-400" /> Sign Out</span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. Single-Screen Quick Book Appointment Modal */}
      {showBookingModal && (
        <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-md transition-colors", isLightMode ? "bg-white/60" : "bg-black/85")}>
          <div className={cn("rounded-3xl border w-full max-w-lg overflow-hidden animate-scale-in my-auto transition-colors", isLightMode ? "bg-white border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)]" : "bg-gradient-to-b from-[#0B251C] via-[#091E17] to-[#040E0A] text-white border-gold/30 shadow-2xl")}>
            <div className={cn("p-5 border-b flex items-center justify-between", isLightMode ? "bg-emerald-50 border-emerald-100" : "border-gold/20 bg-black/40")}>
              <div className="flex items-center gap-2">
                <Scissors size={20} className={cn(isLightMode ? "text-amber-600" : "text-gold")} />
                <h3 className={cn("font-heading font-bold text-lg", isLightMode ? "text-emerald-950" : "text-white")}>Book Appointment</h3>
              </div>
              <button
                onClick={() => { setShowBookingModal(false); setRebookBookingId(null); }}
                className={cn("p-1.5 rounded-full transition-colors", isLightMode ? "bg-black/5 hover:bg-black/10 text-gray-500" : "bg-white/10 text-gray-300 hover:text-white")}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickBookSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start">
                  <label className={cn("font-bold uppercase tracking-wider text-[11px]", isLightMode ? "text-amber-600" : "text-gold")}>Choose Your Service</label>
                  <div className="text-right">
                    {isHomeService && (selectedService?.home_service_price || 0) > 0 ? (
                      <>
                        <div className={cn("text-[10px] font-medium opacity-80", isLightMode ? "text-emerald-700" : "text-emerald-200")}>
                          {formatCurrency(selectedService?.price || 0)} + {formatCurrency(selectedService?.home_service_price || 0)} (Home)
                        </div>
                        <span className={cn("font-heading font-extrabold text-base block mt-0.5", isLightMode ? "text-amber-600" : "text-gold")}>
                          Total: {formatCurrency((selectedService?.price || 0) + (selectedService?.home_service_price || 0))}
                        </span>
                      </>
                    ) : (
                      <span className={cn("font-heading font-extrabold text-base", isLightMode ? "text-amber-600" : "text-gold")}>
                        Total: {formatCurrency(selectedService?.price || 0)}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={selectedService?.id || ''}
                  onChange={(e) => {
                    const s = services?.find(item => item.id === e.target.value)
                    if (s) setSelectedService(s)
                  }}
                  className={cn("w-full py-3 px-4 border rounded-xl font-medium text-xs focus:outline-none transition-colors", isLightMode ? "bg-white border-emerald-200 text-emerald-950 focus:border-amber-500" : "bg-black/60 border-gold/30 text-white focus:border-gold")}
                  required
                >
                  {services?.map(s => (
                    <option key={s.id} value={s.id} className={cn(isLightMode ? "bg-white text-emerald-950" : "bg-[#0B251C] text-white")}>
                      {s.name} ({formatDuration(s.duration_minutes)}) — {formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={cn("font-bold uppercase tracking-wider text-[11px]", isLightMode ? "text-amber-600" : "text-gold")}>Select Specialist Stylist</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className={cn(
                      "p-2.5 rounded-xl border text-center font-medium transition-all flex flex-col items-center gap-1",
                      selectedStaff === null
                        ? isLightMode ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm font-bold" : "bg-gold text-[#061510] border-gold shadow-md font-bold"
                        : isLightMode ? "bg-white border-emerald-100 text-emerald-700 hover:border-emerald-300" : "bg-black/40 border-white/10 text-emerald-200 hover:border-gold/30"
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
                          ? isLightMode ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm font-bold" : "bg-gold text-[#061510] border-gold shadow-md font-bold"
                          : isLightMode ? "bg-white border-emerald-100 text-emerald-700 hover:border-emerald-300" : "bg-black/40 border-white/10 text-emerald-200 hover:border-gold/30"
                      )}
                    >
                      <span className="truncate w-full">{staff.name}</span>
                      <span className="text-[9px] opacity-75 truncate">Senior Stylist</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={cn("font-bold uppercase tracking-wider text-[11px] flex items-center gap-1", isLightMode ? "text-amber-600" : "text-gold")}>
                  <Calendar size={12} /> Select Date (Opens Calendar) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={getTodayISO()}
                    className={cn("w-full py-3 px-4 border rounded-xl font-medium text-xs focus:outline-none cursor-pointer", isLightMode ? "bg-white border-emerald-200 text-emerald-950 focus:border-amber-500" : "bg-black/60 border-gold/30 text-white focus:border-gold input-dark")}
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
                      <label className={cn("font-bold uppercase tracking-wider text-[11px]", isLightMode ? "text-amber-600" : "text-gold")}>
                        Select Available Time Slot
                      </label>
                      <span className={cn("text-[10px]", isLightMode ? "text-emerald-500" : "text-emerald-300/70")}>
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
                                ? isLightMode ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through opacity-70" : "bg-gray-800/60 text-gray-500 border-gray-700/40 cursor-not-allowed line-through opacity-50"
                                : bookingTime === slot
                                ? isLightMode ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm font-bold" : "bg-gold text-[#061510] border-gold shadow-md font-bold"
                                : isLightMode ? "bg-white text-emerald-700 border-emerald-100 hover:border-emerald-300" : "bg-black/40 text-emerald-200 border-white/10 hover:border-gold/30"
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

              <div className={cn("p-3 rounded-xl border space-y-3", isLightMode ? "bg-emerald-50 border-emerald-100" : "bg-black/40 border-gold/20")}>
                
                <div className={cn("flex items-center justify-between pb-3", !isHomeService && "border-b", isLightMode ? "border-emerald-200/50" : "border-white/10")}>
                  <div>
                    <p className={cn("font-bold text-xs", isLightMode ? "text-emerald-950" : "text-white")}>Home Service</p>
                    <p className={cn("text-[10px]", isLightMode ? "text-emerald-700" : "text-gray-400")}>Will this be a home service appointment?</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isHomeService} onChange={() => setIsHomeService(!isHomeService)} />
                    <div className={cn("w-9 h-5 bg-gray-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all", isLightMode ? "peer-checked:bg-amber-500" : "peer-checked:bg-gold")}></div>
                  </label>
                </div>

                {isHomeService && (
                  <div className={cn("pb-3 border-b animate-scale-in", isLightMode ? "border-emerald-200/50" : "border-white/10")}>
                    <label className={cn("font-bold uppercase tracking-wider text-[10px] mb-1.5 block", isLightMode ? "text-amber-600" : "text-gold")}>Exact Home Address *</label>
                    <textarea
                      value={homeAddress}
                      onChange={e => setHomeAddress(e.target.value)}
                      placeholder="e.g. 123 Main St, Brgy. San Jose, Block 4 Lot 2"
                      className={cn("w-full p-2.5 rounded-lg text-xs resize-none border focus:outline-none transition-colors", isLightMode ? "bg-white border-emerald-200 focus:border-amber-500 text-emerald-950" : "bg-black/40 border-gold/30 focus:border-gold text-white")}
                      rows={2}
                      required={isHomeService}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className={cn(isLightMode ? "text-emerald-700" : "text-gray-400")}>Client Name:</span>
                    <span className={cn("font-bold", isLightMode ? "text-amber-600" : "text-gold")}>{profile?.full_name || 'Registered Account'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className={cn(isLightMode ? "text-emerald-700" : "text-gray-400")}>Mobile Phone:</span>
                    <span className={cn("font-bold", isLightMode ? "text-emerald-950" : "text-white")}>{profile?.phone || '0917 123 4567'}</span>
                  </div>
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

      {/* 5. Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t pb-safe transition-colors duration-500",
        isLightMode ? "bg-white/70 border-emerald-100/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" : "bg-[#061510]/95 border-gold/10"
      )}>
        <div className="max-w-4xl mx-auto flex items-center justify-around h-16 px-6">
          <button
            onClick={() => handleTabSwitch('home')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              activeTab === 'home' ? "text-gold" : isLightMode ? "text-emerald-300 hover:text-emerald-600" : "text-emerald-200/50 hover:text-white"
            )}
          >
            <Home size={20} />
            <span>Explore</span>
          </button>

          <button
            onClick={() => handleTabSwitch('bookings')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors relative",
              activeTab === 'bookings' ? "text-gold" : isLightMode ? "text-emerald-300 hover:text-emerald-600" : "text-emerald-200/50 hover:text-white"
            )}
          >
            <Bookmark size={20} />
            <span>Bookings</span>
            {allUpcoming.some(b => b.status === 'confirmed') && (
              <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-gold animate-ping" />
            )}
          </button>

          <button
            onClick={() => handleOpenBookingModal()}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              isLightMode ? "text-emerald-300 hover:text-emerald-600" : "text-emerald-200/50 hover:text-white"
            )}
            title="Book Appointment"
          >
            <Plus size={20} />
            <span>Book</span>
          </button>

          <button
            onClick={() => handleTabSwitch('profile')}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              activeTab === 'profile' ? "text-gold" : isLightMode ? "text-emerald-300 hover:text-emerald-600" : "text-emerald-200/50 hover:text-white"
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
