import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { supabase } from '@/lib/supabase'
import { playLuxuryChime, requestNotificationPermission, sendBrowserNotification } from '@/lib/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AppLayout() {
  const { sidebarCollapsed } = useUIStore()
  const queryClient = useQueryClient()
  const [showNotifBanner, setShowNotifBanner] = useState(false)

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const dismissed = localStorage.getItem('marquevedo_notif_banner_dismissed')
      if (!dismissed) {
        setShowNotifBanner(true)
      }
    }
  }, [])

  const handleAllowNotifications = async () => {
    const granted = await requestNotificationPermission()
    setShowNotifBanner(false)
    if (granted) {
      toast.success('Desktop notifications enabled!')
      playLuxuryChime()
      sendBrowserNotification('Notifications Enabled!', {
        body: 'You will receive real-time audio and push alerts for new salon appointments.',
      })
    }
  }

  const handleDismissBanner = () => {
    setShowNotifBanner(false)
    localStorage.setItem('marquevedo_notif_banner_dismissed', 'true')
  }

  // Real-time Supabase subscription for Admin (New Bookings)
  useEffect(() => {
    const channel = supabase
      .channel('admin_realtime_bookings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
        },
        (payload: any) => {
          const newBooking = payload.new
          playLuxuryChime()
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          queryClient.invalidateQueries({ queryKey: ['clientBookings'] })

          const clientName = newBooking.client_name || 'A client'
          toast.success(`New Appointment: ${clientName} booked a service!`, {
            duration: 6000,
          })

          sendBrowserNotification('New Appointment Booked!', {
            body: `${clientName} booked a service for ${newBooking.booking_date} at ${newBooking.start_time}`,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <div className="min-h-screen bg-offwhite">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:ml-[70px]" : "lg:ml-64"
        )}
      >
        <TopBar />

        {/* Facebook-style Notification Permission Banner */}
        {showNotifBanner && (
          <div className="bg-gradient-to-r from-[#061510] via-[#092219] to-[#040E0A] text-white p-3.5 border-b border-gold/30 shadow-md animate-fade-in">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-center sm:text-left">
                <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold flex-shrink-0">
                  <Bell size={16} className="animate-bounce" />
                </div>
                <div>
                  <p className="font-bold text-gold">Enable Instant Appointment Notifications?</p>
                  <p className="text-emerald-200/80 text-[11px]">
                    Receive instant audio chime and desktop alerts when clients schedule new salon bookings.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleAllowNotifications}
                  className="btn-gold text-xs py-1.5 px-3.5 font-bold flex items-center gap-1 shadow-md"
                >
                  <Check size={14} /> Allow Notifications
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="p-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white text-xs"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
