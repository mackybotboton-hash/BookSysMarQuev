import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Scissors,
  Users,
  Receipt,
  History,
  Package,
  Globe,
  ChevronLeft,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useBookings } from '@/hooks/useBookings'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/bookings', label: 'Bookings', icon: BookOpen },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { to: '/inventory', label: 'Inventory', icon: Package, adminOnly: true },
  { to: '/expenses', label: 'Expenses', icon: Receipt, adminOnly: true },
  { to: '/reports', label: 'History', icon: History, adminOnly: true },
]

export default function Sidebar() {
  const queryClient = useQueryClient()
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleCollapsed } = useUIStore()
  const { profile } = useAuthStore()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'

  const handleNavClick = () => {
    setSidebarOpen(false)
    queryClient.invalidateQueries()
  }

  const { data: bookings, refetch } = useBookings()
  const pendingCount = (bookings || []).filter((b: any) => b.status === 'pending').length

  // Realtime subscription for live pending bookings count in Sidebar
  useEffect(() => {
    const channel = supabase
      .channel('sidebar_live_pending_bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
          refetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, refetch])

  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-emerald z-50 flex flex-col transition-all duration-300 shadow-xl",
          sidebarCollapsed ? "w-[70px]" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Area */}
        <div className={cn(
          "flex items-center border-b border-white/10 p-4",
          sidebarCollapsed ? "justify-center" : "gap-3"
        )}>
          <img
            src="/logo.jpg"
            alt="MarQuevedo Hair Studio"
            className={cn(
              "rounded-full object-cover flex-shrink-0 ring-2 ring-gold/40",
              sidebarCollapsed ? "w-10 h-10" : "w-11 h-11"
            )}
          />
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-gold font-heading font-bold text-sm leading-tight truncate">
                MarQuevedo
              </h1>
              <p className="text-emerald-200/60 text-[10px] tracking-wider uppercase">
                Hair Studio
              </p>
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {filteredItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              className={({ isActive }) => cn(
                "sidebar-link relative flex items-center justify-between",
                isActive && "active",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={20} className="flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </div>

              {to === '/bookings' && pendingCount > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gold text-[#061510] shadow-sm flex items-center justify-center min-w-[20px]",
                  sidebarCollapsed && "absolute -top-1 -right-1 w-4 h-4 p-0"
                )}>
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Public booking link */}
        <div className="p-3 border-t border-white/10">
          <NavLink
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
              "bg-gold/10 text-gold hover:bg-gold/20 transition-colors",
              sidebarCollapsed && "justify-center"
            )}
          >
            <Globe size={16} />
            {!sidebarCollapsed && <span>Public Booking Page</span>}
          </NavLink>
        </div>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center p-3 border-t border-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <ChevronLeft
            size={18}
            className={cn("transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </button>
      </aside>
    </>
  )
}
