import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'staff'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.jpg" alt="MarQuevedo" className="w-16 h-16 rounded-full mx-auto mb-4 animate-pulse ring-2 ring-gold/30" />
          <p className="text-sm text-gray-400 font-body">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect clients to their dedicated Client Dashboard
  if (profile?.role === 'client') {
    return <Navigate to="/client-dashboard" replace />
  }

  if (requiredRole === 'admin' && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
