import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useActiveServices } from '@/hooks/useServices'
import { useActiveStaff } from '@/hooks/useStaff'
import { useAuthStore } from '@/stores/auth-store'
import { formatCurrency, formatDuration, cn } from '@/lib/utils'
import {
  Scissors, Sparkles, Clock, Star, ShieldCheck, CalendarCheck,
  CheckCircle, ArrowRight, Phone, MapPin, Search, User, LogIn, LayoutDashboard,
  Edit3, Save, RotateCcw, Check, Eye
} from 'lucide-react'
import AuthModal from '@/components/auth/AuthModal'
import type { Service } from '@/lib/database.types'
import toast from 'react-hot-toast'

const defaultCms = {
  heroBadge: 'Premier Luxury Salon & Styling',
  heroTitle: 'Transform Your Hair Beyond Your Expectations',
  heroDescription: 'Discover expert haircutting, vibrant hair coloring, smoothing rebond & brazilian treatments, and relaxing nail care at MarQuevedo Hair Studio.',
  heroCta: 'Book Appointment Now',
  heroSecondaryCta: 'View Services & Rates',

  featuredBadge: 'Featured Special',
  featuredTitle: 'Brazilian & Color Package',
  featuredDesc: 'Smooth, shiny, vibrant finish',
  featuredDuration: '150 Minutes',
  featuredStylist: 'Senior Colorist',
  featuredPrice: '₱1,500.00',
  featuredBtn: 'Book This Service',

  statRating: '4.9★',
  statRatingLabel: 'Client Rating',
  statClients: '1,200+',
  statClientsLabel: 'Happy Clients',
  statGuarantee: '100%',
  statGuaranteeLabel: 'Quality Guarantee',

  menuTitle: 'Our Service Menu',
  menuHeading: 'Popular Salon Treatments & Rates',
  menuSubheading: 'Select any service to begin your online booking appointment.',

  whyBadge: 'Why MarQuevedo',
  whyHeading: 'The Ultimate Salon Experience',
  why1Title: 'Master Stylists',
  why1Desc: 'Trained colorists and hair technicians with years of salon experience.',
  why2Title: 'Premium Products',
  why2Desc: 'We use high-end hair care products to ensure healthy, shiny results.',
  why3Title: 'Verified Bookings',
  why3Desc: 'Instant account verification ensures genuine, prompt appointments.',
  why4Title: '24/7 Online Booking',
  why4Desc: 'Schedule your haircut or beauty treatment anytime, anywhere on mobile.',

  footerTagline: 'Your premier destination for luxury hair styling, coloring, rebonding, and nail care.',
  salonBranch: 'Main Salon Studio',
  salonHours: 'Mon - Sat: 9:00 AM - 7:00 PM',
  contactPhone: '0917 123 4567',
  contactFb: 'MarQuevedo Hair Studio FB Page',
  contactFbUrl: 'https://www.facebook.com/mar.mar.quevedo',
  footerPoweredBy: 'Powered by Mark Vincent B. Alegre | Freelance Web/App Developer',
}

function FacebookIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

export default function Home() {
  const queryClient = useQueryClient()
  const { data: services } = useActiveServices()
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase().includes('admin')

  // CMS State
  const [cms, setCms] = useState(() => {
    const saved = localStorage.getItem('marquevedo_home_cms_data')
    return saved ? { ...defaultCms, ...JSON.parse(saved) } : defaultCms
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSavingCms, setIsSavingCms] = useState(false)

  const [activeCategory, setActiveCategory] = useState<'All' | 'Hair' | 'Nails' | 'Other'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [pendingService, setPendingService] = useState<Service | null>(null)

  // Fetch home page CMS content from Supabase site_content table
  const { data: dbCms, refetch: refetchCms } = useQuery({
    queryKey: ['homeSiteContent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'home_cms')
        .maybeSingle()
      
      if (error || !data) return null
      return data.content
    },
  })

  // Sync dbCms into local state when fetched or updated
  useEffect(() => {
    if (dbCms) {
      setCms((prev: any) => ({ ...defaultCms, ...dbCms }))
      localStorage.setItem('marquevedo_home_cms_data', JSON.stringify(dbCms))
    }
  }, [dbCms])

  // Supabase Realtime Subscription for instant cross-device updates!
  useEffect(() => {
    const channel = supabase
      .channel('home_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: 'key=eq.home_cms',
        },
        (payload: any) => {
          if (payload.new && payload.new.content) {
            const updatedContent = payload.new.content
            setCms((prev: any) => ({ ...defaultCms, ...updatedContent }))
            localStorage.setItem('marquevedo_home_cms_data', JSON.stringify(updatedContent))
            toast.success('Home page content updated live by Admin!', { id: 'cms-live-update' })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['services'] })
        }
      )
      .subscribe()

    const handleLocalServiceUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    }
    window.addEventListener('marquevedo_service_updated', handleLocalServiceUpdate)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('marquevedo_service_updated', handleLocalServiceUpdate)
    }
  }, [queryClient])

  // Fetch customer reviews
  const { data: dbReviews } = useQuery({
    queryKey: ['publicReviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return []
      return (data || []) as any[]
    },
  })

  // Sample fallback reviews
  const sampleReviews = [
    {
      id: '1',
      client_name: 'Maria Santos',
      service_name: 'Brazilian Blowout & Rebond',
      rating: 5,
      comment: 'Super love my new hair! The Brazilian treatment made it so smooth and shiny. Best salon in town!',
      created_at: '2026-07-25',
    },
    {
      id: '2',
      client_name: 'Bea Alonzo',
      service_name: 'Vibrant Hair Color & Highlights',
      rating: 5,
      comment: 'The Senior Stylist did an unbelievable job matching my exact reference photo. Highly recommended!',
      created_at: '2026-07-24',
    },
    {
      id: '3',
      client_name: 'Kendra L.',
      service_name: 'Gel Manicure & Nail Spa',
      rating: 5,
      comment: 'Very relaxing ambiance and extremely clean tools. My gel polish lasts for weeks without chipping.',
      created_at: '2026-07-22',
    },
  ]

  const customLocalReviews = JSON.parse(localStorage.getItem('marquevedo_custom_reviews') || '[]')
  const allReviews = [...customLocalReviews, ...(dbReviews || []), ...sampleReviews]

  const filteredServices = services?.filter(s => {
    const matchesCat = activeCategory === 'All' || s.category === activeCategory
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  }) || []

  // CMS Field Updater
  const handleCmsChange = (field: keyof typeof defaultCms, value: string) => {
    setCms((prev: any) => ({ ...prev, [field]: value }))
  }

  // Save CMS Content to Supabase & LocalStorage
  const handleSaveCms = async () => {
    setIsSavingCms(true)
    try {
      localStorage.setItem('marquevedo_home_cms_data', JSON.stringify(cms))

      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'home_cms',
          content: cms,
          updated_at: new Date().toISOString(),
        } as any)

      if (error) {
        console.warn('Supabase site_content save warning:', error.message)
      }

      toast.success('Home page text updated live across all devices!')
      setIsEditMode(false)
      refetchCms()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save changes')
    } finally {
      setIsSavingCms(false)
    }
  }

  // Reset CMS Defaults
  const handleResetCms = async () => {
    if (confirm('Reset home page text back to salon defaults for all visitors?')) {
      setCms(defaultCms)
      localStorage.removeItem('marquevedo_home_cms_data')

      await supabase
        .from('site_content')
        .upsert({
          key: 'home_cms',
          content: defaultCms,
          updated_at: new Date().toISOString(),
        } as any)

      toast.success('Restored default home page content')
      refetchCms()
    }
  }

  // Handler for Hero "Book Appointment Now" button
  const handleHeroBookClick = () => {
    if (isAdmin) {
      toast.error('Booking is disabled in Admin Mode. Click "Enable Edit Mode (Pen)" to customize home page text.')
      return
    }
    if (user) {
      navigate('/client-dashboard')
    } else {
      setAuthMode('signup')
      setShowAuthModal(true)
    }
  }

  // Handler for booking a specific service from catalog or featured card
  const handleServiceBookClick = (service?: Service) => {
    if (isAdmin) {
      toast.error('Booking is disabled in Admin Mode. Click "Enable Edit Mode (Pen)" to customize home page text.')
      return
    }
    const targetService = service || services?.[0]
    if (user) {
      navigate('/client-dashboard', { state: { bookingService: targetService } })
    } else {
      if (targetService) setPendingService(targetService)
      setAuthMode('signup')
      setShowAuthModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-offwhite flex flex-col font-body relative">
      {/* Admin Floating CMS Toolbar */}
      {isAdmin && (
        <div className="sticky top-0 z-50 bg-[#061510] text-white border-b-2 border-gold py-2.5 px-4 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gold animate-ping" />
              <span className="text-xs font-bold text-gold uppercase tracking-wider">Admin Live Editor</span>
              <span className="text-[11px] text-gray-400 hidden sm:inline">• Booking disabled in Admin Mode</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <LayoutDashboard size={14} className="text-gold" /> Admin Dashboard
              </button>

              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md",
                  isEditMode
                    ? "bg-gold text-[#061510] ring-2 ring-white"
                    : "bg-gold/20 text-gold hover:bg-gold/30 border border-gold/40"
                )}
              >
                <Edit3 size={14} /> {isEditMode ? 'Editing Active (Click text to edit)' : 'Enable Edit Mode (Pen)'}
              </button>

              {isEditMode && (
                <>
                  <button
                    onClick={handleSaveCms}
                    disabled={isSavingCms}
                    className="btn-gold text-xs py-1.5 px-3.5 font-bold flex items-center gap-1.5 shadow-lg"
                  >
                    <Save size={14} /> Save Changes
                  </button>
                  <button
                    onClick={handleResetCms}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs border border-red-500/30"
                    title="Reset Defaults"
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-emerald/95 backdrop-blur-md border-b border-emerald-800/40 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="MarQuevedo Hair Studio"
              className="w-11 h-11 rounded-full ring-2 ring-gold/40 shadow-md object-cover"
            />
            <div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-gold tracking-wide leading-none">
                MarQuevedo
              </h1>
              <p className="text-[10px] text-emerald-200/80 uppercase tracking-widest font-semibold mt-0.5">
                Hair Studio
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#services" className="text-emerald-100 hover:text-gold transition-colors">Services</a>
            <a href="#why-us" className="text-emerald-100 hover:text-gold transition-colors">Why Choose Us</a>
            <a href="#reviews" className="text-emerald-100 hover:text-gold transition-colors flex items-center gap-1">
              <Star size={14} className="fill-gold text-gold" /> Customer Reviews
            </a>
            <a href="#contact" className="text-emerald-100 hover:text-gold transition-colors">Contact</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={profile?.role === 'admin' ? '/dashboard' : '/client-dashboard'}
                className="btn-gold flex items-center gap-2 text-xs py-2 px-4 shadow-sm"
              >
                <LayoutDashboard size={15} /> My Dashboard
              </Link>
            ) : (
              <button
                onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-100 hover:text-gold transition-colors"
              >
                <LogIn size={15} /> Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative bg-emerald text-white overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 z-0">
          <img
            src="/salon_hero.png"
            alt="Salon Interior"
            className="w-full h-full object-cover opacity-20 filter brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-emerald-950/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Text */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-gold/15 border border-gold/30 px-3 py-1.5 rounded-full text-gold text-xs font-semibold tracking-wider uppercase">
                <Sparkles size={14} />
                {isEditMode ? (
                  <input
                    type="text"
                    value={cms.heroBadge}
                    onChange={(e) => handleCmsChange('heroBadge', e.target.value)}
                    className="bg-black/60 border border-gold rounded px-2 py-0.5 text-gold text-xs font-semibold focus:outline-none"
                  />
                ) : (
                  <span>{cms.heroBadge}</span>
                )}
              </div>

              {/* Editable Hero Title */}
              {isEditMode ? (
                <textarea
                  value={cms.heroTitle}
                  onChange={(e) => handleCmsChange('heroTitle', e.target.value)}
                  rows={2}
                  className="w-full bg-black/60 border-2 border-gold rounded-xl p-3 text-2xl sm:text-3xl font-heading font-extrabold text-white focus:outline-none"
                />
              ) : (
                <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
                  {cms.heroTitle}
                </h1>
              )}

              {/* Editable Hero Description */}
              {isEditMode ? (
                <textarea
                  value={cms.heroDescription}
                  onChange={(e) => handleCmsChange('heroDescription', e.target.value)}
                  rows={3}
                  className="w-full bg-black/60 border-2 border-gold rounded-xl p-3 text-xs sm:text-sm text-emerald-100 focus:outline-none"
                />
              ) : (
                <p className="text-emerald-100/90 text-base sm:text-lg max-w-2xl font-light leading-relaxed">
                  {cms.heroDescription}
                </p>
              )}

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={handleHeroBookClick}
                  className="btn-gold py-3.5 px-6 text-sm font-bold shadow-xl flex items-center gap-2"
                >
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cms.heroCta}
                      onChange={(e) => handleCmsChange('heroCta', e.target.value)}
                      className="bg-black/40 border border-black/30 text-[#061510] font-bold px-2 py-0.5 rounded text-sm"
                    />
                  ) : (
                    <span>{cms.heroCta}</span>
                  )}
                  <ArrowRight size={18} />
                </button>

                <a
                  href="#services"
                  className="px-6 py-3.5 rounded-lg border border-emerald-300/30 text-emerald-100 hover:bg-white/10 text-sm font-medium transition-all"
                >
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cms.heroSecondaryCta}
                      onChange={(e) => handleCmsChange('heroSecondaryCta', e.target.value)}
                      className="bg-black/40 border border-emerald-300 text-emerald-100 font-medium px-2 py-0.5 rounded text-sm"
                    />
                  ) : (
                    <span>{cms.heroSecondaryCta}</span>
                  )}
                </a>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-emerald-800/60 max-w-lg">
                <div>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cms.statRating}
                      onChange={(e) => handleCmsChange('statRating', e.target.value)}
                      className="bg-black/60 border border-gold text-gold font-bold text-xl rounded px-1 w-20"
                    />
                  ) : (
                    <p className="font-heading text-2xl font-bold text-gold">{cms.statRating}</p>
                  )}
                  <p className="text-xs text-emerald-200/70">{cms.statRatingLabel}</p>
                </div>

                <div>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cms.statClients}
                      onChange={(e) => handleCmsChange('statClients', e.target.value)}
                      className="bg-black/60 border border-gold text-gold font-bold text-xl rounded px-1 w-24"
                    />
                  ) : (
                    <p className="font-heading text-2xl font-bold text-gold">{cms.statClients}</p>
                  )}
                  <p className="text-xs text-emerald-200/70">{cms.statClientsLabel}</p>
                </div>

                <div>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cms.statGuarantee}
                      onChange={(e) => handleCmsChange('statGuarantee', e.target.value)}
                      className="bg-black/60 border border-gold text-gold font-bold text-xl rounded px-1 w-20"
                    />
                  ) : (
                    <p className="font-heading text-2xl font-bold text-gold">{cms.statGuarantee}</p>
                  )}
                  <p className="text-xs text-emerald-200/70">{cms.statGuaranteeLabel}</p>
                </div>
              </div>
            </div>

            {/* Right Hero Card Overlay (Featured Special) */}
            <div className="lg:col-span-5 relative">
              <div className="card-premium p-6 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-gold/30 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald flex-shrink-0">
                    <Scissors size={28} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{cms.featuredBadge}</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={cms.featuredTitle}
                        onChange={(e) => handleCmsChange('featuredTitle', e.target.value)}
                        className="font-heading font-bold text-base text-charcoal border border-gold rounded px-2 w-full mt-1"
                      />
                    ) : (
                      <h3 className="font-heading font-bold text-lg text-charcoal">{cms.featuredTitle}</h3>
                    )}
                    {isEditMode ? (
                      <input
                        type="text"
                        value={cms.featuredDesc}
                        onChange={(e) => handleCmsChange('featuredDesc', e.target.value)}
                        className="text-xs text-gray-500 border border-gray-300 rounded px-2 w-full mt-1"
                      />
                    ) : (
                      <p className="text-xs text-gray-500">{cms.featuredDesc}</p>
                    )}
                  </div>
                </div>

                <div className="bg-offwhite p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-500">Service Duration</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={cms.featuredDuration}
                        onChange={(e) => handleCmsChange('featuredDuration', e.target.value)}
                        className="text-charcoal font-semibold border border-gold rounded px-1.5 text-right w-28"
                      />
                    ) : (
                      <span className="text-charcoal">{cms.featuredDuration}</span>
                    )}
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-500">Stylist</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={cms.featuredStylist}
                        onChange={(e) => handleCmsChange('featuredStylist', e.target.value)}
                        className="text-emerald font-semibold border border-gold rounded px-1.5 text-right w-28"
                      />
                    ) : (
                      <span className="text-emerald font-semibold">{cms.featuredStylist}</span>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                    <span className="font-semibold text-charcoal">Price</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={cms.featuredPrice}
                        onChange={(e) => handleCmsChange('featuredPrice', e.target.value)}
                        className="font-heading font-bold text-lg text-emerald border border-gold rounded px-1.5 text-right w-28"
                      />
                    ) : (
                      <span className="font-heading font-bold text-xl text-emerald">{cms.featuredPrice}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleServiceBookClick(services?.find(s => s.name.includes('Color')) || services?.[0])}
                  className="btn-primary w-full text-center block py-3 text-xs font-semibold shadow-md"
                >
                  {cms.featuredBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Quick Filter Bar */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {(['All', 'Hair', 'Nails', 'Other'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                    activeCategory === cat
                      ? "bg-emerald text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {cat === 'All' ? 'All Services' : cat === 'Hair' ? 'Hair Care' : cat === 'Nails' ? 'Nail Spa' : 'Other Treatments'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search service name..."
                className="input-field pl-9 text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Popular Services Catalog Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-emerald uppercase tracking-widest">{cms.menuTitle}</span>
          {isEditMode ? (
            <input
              type="text"
              value={cms.menuHeading}
              onChange={(e) => handleCmsChange('menuHeading', e.target.value)}
              className="font-heading text-2xl sm:text-3xl font-extrabold text-charcoal text-center border border-gold rounded p-2 w-full mt-1"
            />
          ) : (
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-charcoal mt-1">
              {cms.menuHeading}
            </h2>
          )}
          <p className="text-gray-500 text-sm mt-2">{cms.menuSubheading}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              No services found matching your filter.
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className="card-premium p-6 flex flex-col justify-between hover:border-emerald hover:shadow-lg transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-emerald bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {service.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                      <Clock size={12} className="text-emerald" /> {formatDuration(service.duration_minutes)}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-lg text-charcoal group-hover:text-emerald transition-colors">
                    {service.name}
                  </h3>

                  <p className="text-xs text-gray-400 mt-1">
                    Professional salon treatment tailored for smooth, gorgeous results.
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-100 flex items-center justify-between mt-6">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Rate</span>
                    <span className="font-heading font-bold text-2xl text-emerald">
                      {formatCurrency(service.price)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleServiceBookClick(service)}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
                  >
                    Book Now <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. Customer Reviews Section */}
      <section id="reviews" className="bg-emerald-950 text-white py-16 border-t border-emerald-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-gold uppercase tracking-widest flex items-center justify-center gap-1">
              <Star size={14} className="fill-gold" /> Client Testimonials
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mt-1">
              What Our Clients Say About Us
            </h2>
            <p className="text-emerald-200/70 text-sm mt-2">
              Read real 5-star ratings and reviews submitted by clients after their salon treatments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {allReviews.slice(0, 6).map((rev, idx) => (
              <div key={rev.id ? `review-${rev.id}-${idx}` : `review-${idx}`} className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-800/50 space-y-4 hover:border-gold/40 transition-all shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={16} className={s <= rev.rating ? "fill-gold text-gold" : "text-gray-600"} />
                    ))}
                  </div>
                  <span className="text-[10px] text-gold font-bold bg-gold/15 px-2.5 py-0.5 rounded-full border border-gold/30">
                    Verified Client
                  </span>
                </div>

                <p className="text-xs text-emerald-100/90 leading-relaxed italic">
                  "{rev.comment}"
                </p>

                <div className="pt-3 border-t border-emerald-800/50 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{rev.client_name}</h4>
                    <p className="text-[11px] text-gold font-medium">{rev.service_name}</p>
                  </div>
                  <span className="text-[10px] text-emerald-300/60">
                    {rev.created_at ? rev.created_at.split('T')[0] : 'Recent'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Why Choose Us / Quality Features */}
      <section id="why-us" className="bg-emerald text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-gold uppercase tracking-widest">{cms.whyBadge}</span>
            {isEditMode ? (
              <input
                type="text"
                value={cms.whyHeading}
                onChange={(e) => handleCmsChange('whyHeading', e.target.value)}
                className="font-heading text-2xl sm:text-3xl font-extrabold text-white text-center border border-gold bg-black/50 rounded p-2 w-full mt-1"
              />
            ) : (
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mt-1">
                {cms.whyHeading}
              </h2>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                icon: Scissors,
                titleKey: 'why1Title' as const,
                descKey: 'why1Desc' as const,
              },
              {
                icon: Sparkles,
                titleKey: 'why2Title' as const,
                descKey: 'why2Desc' as const,
              },
              {
                icon: ShieldCheck,
                titleKey: 'why3Title' as const,
                descKey: 'why3Desc' as const,
              },
              {
                icon: Clock,
                titleKey: 'why4Title' as const,
                descKey: 'why4Desc' as const,
              },
            ].map((f, i) => (
              <div key={i} className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-800/50 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
                  <f.icon size={24} />
                </div>
                {isEditMode ? (
                  <input
                    type="text"
                    value={cms[f.titleKey]}
                    onChange={(e) => handleCmsChange(f.titleKey, e.target.value)}
                    className="font-heading font-bold text-base text-white border border-gold bg-black/50 rounded px-2 w-full"
                  />
                ) : (
                  <h3 className="font-heading font-bold text-lg text-white">{cms[f.titleKey]}</h3>
                )}
                {isEditMode ? (
                  <textarea
                    value={cms[f.descKey]}
                    onChange={(e) => handleCmsChange(f.descKey, e.target.value)}
                    rows={2}
                    className="text-xs text-emerald-200/70 border border-gold bg-black/50 rounded p-1.5 w-full"
                  />
                ) : (
                  <p className="text-xs text-emerald-200/70 leading-relaxed">{cms[f.descKey]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer id="contact" className="bg-emerald-950 text-emerald-100 border-t border-emerald-800/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.jpg" alt="Logo" className="w-10 h-10 rounded-full ring-2 ring-gold/40" />
              <h3 className="font-heading font-bold text-gold text-lg">MarQuevedo Hair Studio</h3>
            </div>
            {isEditMode ? (
              <textarea
                value={cms.footerTagline}
                onChange={(e) => handleCmsChange('footerTagline', e.target.value)}
                rows={2}
                className="text-xs text-emerald-200 border border-gold bg-black/50 rounded p-2 w-full"
              />
            ) : (
              <p className="text-xs text-emerald-200/70 leading-relaxed">
                {cms.footerTagline}
              </p>
            )}
          </div>

          <div>
            <h4 className="font-heading font-bold text-white text-sm mb-3">Salon Location & Hours</h4>
            <p className="text-xs text-emerald-200/80 flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-gold" />
              {isEditMode ? (
                <input
                  type="text"
                  value={cms.salonBranch}
                  onChange={(e) => handleCmsChange('salonBranch', e.target.value)}
                  className="bg-black/50 border border-gold text-white text-xs rounded px-1.5"
                />
              ) : (
                <span>{cms.salonBranch}</span>
              )}
            </p>
            <p className="text-xs text-emerald-200/80 flex items-center gap-2">
              <Clock size={14} className="text-gold" />
              {isEditMode ? (
                <input
                  type="text"
                  value={cms.salonHours}
                  onChange={(e) => handleCmsChange('salonHours', e.target.value)}
                  className="bg-black/50 border border-gold text-white text-xs rounded px-1.5 w-full"
                />
              ) : (
                <span>{cms.salonHours}</span>
              )}
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold text-white text-sm mb-3">Contact & Support</h4>
            <div className="space-y-2 mb-3">
              <p className="text-xs text-emerald-200/80 flex items-center gap-2">
                <Phone size={14} className="text-gold flex-shrink-0" />
                {isEditMode ? (
                  <input
                    type="text"
                    value={cms.contactPhone}
                    onChange={(e) => handleCmsChange('contactPhone', e.target.value)}
                    className="bg-black/50 border border-gold text-white text-xs rounded px-1.5"
                  />
                ) : (
                  <span>{cms.contactPhone}</span>
                )}
              </p>

              <div className="text-xs text-emerald-200/80 flex items-center gap-2">
                <FacebookIcon size={14} className="text-gold flex-shrink-0" />
                {isEditMode ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={cms.contactFb || 'MarQuevedo Hair Studio FB Page'}
                      onChange={(e) => handleCmsChange('contactFb', e.target.value)}
                      placeholder="Page Label"
                      className="bg-black/50 border border-gold text-white text-xs rounded px-1.5 w-full"
                    />
                    <input
                      type="text"
                      value={cms.contactFbUrl || 'https://www.facebook.com/mar.mar.quevedo'}
                      onChange={(e) => handleCmsChange('contactFbUrl', e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="bg-black/50 border border-gold text-gold text-[10px] rounded px-1.5 w-full"
                    />
                  </div>
                ) : (
                  <a
                    href={cms.contactFbUrl || 'https://www.facebook.com/mar.mar.quevedo'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold transition-colors hover:underline cursor-pointer"
                  >
                    {cms.contactFb || 'MarQuevedo Hair Studio FB Page'}
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={handleHeroBookClick}
              className="btn-gold inline-flex text-xs py-2 px-4 shadow-sm"
            >
              Book Appointment
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 border-t border-emerald-800/60 text-center text-xs text-emerald-300/50 mt-8 flex flex-col items-center justify-center gap-1.5">
          <p className="font-medium text-emerald-200/70">
            MarQuevedo Hair Studio © {new Date().getFullYear()} • All Rights Reserved
          </p>
          <p className="text-emerald-300/60 font-normal">
            {isEditMode ? (
              <input
                type="text"
                value={cms.footerPoweredBy || 'Powered by Mark Vincent B. Alegre | Freelance Web/App Developer'}
                onChange={(e) => handleCmsChange('footerPoweredBy', e.target.value)}
                className="bg-black/60 border border-gold text-gold text-xs rounded px-2 font-semibold text-center w-80 sm:w-96"
              />
            ) : (
              <a
                href="https://www.facebook.com/itsm4ck"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors hover:underline cursor-pointer"
              >
                {cms.footerPoweredBy || 'Powered by Mark Vincent B. Alegre | Freelance Web/App Developer'}
              </a>
            )}
          </p>
        </div>
      </footer>

      {/* Centered Login / Sign Up Modal */}
      {showAuthModal && (
        <AuthModal
          initialMode={authMode}
          onSuccess={() => {
            setShowAuthModal(false)
            const activeProfile = useAuthStore.getState().profile
            const sessionUser = useAuthStore.getState().user
            const isAdminUser = activeProfile?.role === 'admin' || activeProfile?.role === 'staff' || sessionUser?.email?.toLowerCase().includes('admin')
            
            if (isAdminUser) {
              navigate('/dashboard')
            } else if (pendingService) {
              navigate('/client-dashboard', { state: { bookingService: pendingService } })
              setPendingService(null)
            } else {
              navigate('/client-dashboard')
            }
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  )
}
