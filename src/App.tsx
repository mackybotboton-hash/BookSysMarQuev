import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Suspense, lazy } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth-store'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// Lazy loaded pages
const Home = lazy(() => import('@/pages/Home'))
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const Bookings = lazy(() => import('@/pages/Bookings'))
const Services = lazy(() => import('@/pages/Services'))
const Staff = lazy(() => import('@/pages/Staff'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Reports = lazy(() => import('@/pages/Reports'))
const Inventory = lazy(() => import('@/pages/Inventory'))
const PublicBooking = lazy(() => import('@/pages/PublicBooking'))
const ClientDashboard = lazy(() => import('@/pages/ClientDashboard'))
const UpdatePassword = lazy(() => import('@/pages/UpdatePassword'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <img src="/logo.jpg" alt="Loading" className="w-12 h-12 rounded-full mx-auto mb-3 animate-pulse ring-2 ring-gold/20" />
        <p className="text-xs text-gray-400 font-body">Loading...</p>
      </div>
    </div>
  )
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuth()
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Landing Homepage */}
              <Route path="/" element={<Home />} />

              {/* Public & Client Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/book" element={<PublicBooking />} />
              <Route path="/client-dashboard" element={<ClientDashboard />} />
              <Route path="/update-password" element={<UpdatePassword />} />

              {/* Protected Admin/Staff Routes */}
              <Route
                element={
                  <ProtectedRoute requiredRole="staff">
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/services" element={<Services />} />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Staff />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Inventory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Expenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Reports />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Default fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                fontFamily: 'Poppins, sans-serif',
                fontSize: '13px',
                borderRadius: '10px',
                padding: '10px 16px',
              },
              success: {
                iconTheme: { primary: '#0A3D2E', secondary: '#fff' },
              },
            }}
          />
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
