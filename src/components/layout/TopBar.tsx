import { useState } from 'react'
import { Menu, LogOut, User, AlertTriangle } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/useAuth'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/bookings': 'Bookings',
  '/services': 'Services',
  '/staff': 'Staff Management',
  '/inventory': 'Inventory & Stock Control',
  '/expenses': 'Expenses & Salary',
  '/reports': 'History & Audit Logs',
}

export default function TopBar() {
  const { toggleSidebar } = useUIStore()
  const { profile } = useAuthStore()
  const { signOut } = useAuth()
  const location = useLocation()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const pageTitle = pageNames[location.pathname] || 'Dashboard'

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false)
    toast.success('Logged out successfully')
    await signOut()
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} className="text-charcoal" />
            </button>
            <h2 className="page-header text-xl md:text-2xl">{pageTitle}</h2>
          </div>

          {/* Right: User info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-charcoal">
                {profile?.full_name || profile?.email || 'User'}
              </p>
              <p className="text-xs text-gray-400 capitalize">{profile?.role || 'admin'}</p>
            </div>

            <div className="w-9 h-9 rounded-full bg-emerald/10 flex items-center justify-center font-bold text-emerald">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={18} />}
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Sign out"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in border border-gray-100 p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-charcoal">Confirm Logout</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to log out of the MarQuevedo Hair Studio Admin system?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-outline flex-1 py-2.5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} /> Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
