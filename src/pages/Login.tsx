import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth-store'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isUpdatePassword, setIsUpdatePassword] = useState(() => {
    return localStorage.getItem('marquevedo_password_recovery') === 'true'
  })
  
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Redirect if already logged in (unless they are updating password)
  if (user && !isUpdatePassword) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isUpdatePassword) {
      if (!password) return toast.error('Please enter a new password')
      setLoading(true)
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        toast.success('Password updated successfully!')
        localStorage.removeItem('marquevedo_password_recovery')
        setIsUpdatePassword(false)
        navigate('/dashboard', { replace: true })
      } catch (err: any) {
        toast.error(err.message || 'Failed to update password')
      } finally {
        setLoading(false)
      }
      return
    }

    if (isForgotPassword) {
      if (!email) return toast.error('Please enter your email')
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/login',
        })
        if (error) throw error
        toast.success('Password reset link sent! Check your email.')
        setIsForgotPassword(false)
      } catch (err: any) {
        toast.error(err.message || 'Failed to send reset link')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email || !password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (isSignUp && !fullName) {
      toast.error('Please enter your full name')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password, fullName)
        toast.success('Account created successfully!')
        navigate('/dashboard', { replace: true })
      } else {
        await signIn(email, password)
        toast.success('Welcome back!')
        navigate('/dashboard', { replace: true })
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-emerald flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-emerald-700/30" />
        <div className="absolute -bottom-1/3 -left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-900/40" />
        <div className="absolute top-1/4 left-1/3 w-[200px] h-[200px] rounded-full bg-gold/5" />
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md animate-scale-in">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <img
              src="/logo.jpg"
              alt="MarQuevedo Hair Studio"
              className="w-24 h-24 rounded-full mx-auto mb-4 ring-4 ring-gold/20 shadow-lg object-cover"
            />
            <h1 className="font-heading text-2xl font-bold text-charcoal">
              {isUpdatePassword ? 'Reset Password' : isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-gray-400 mt-1 font-body">
              {isUpdatePassword ? 'Enter your new password below' : isForgotPassword ? 'Enter your email to receive a reset link' : isSignUp ? 'Sign up for MarQuevedo Hair Studio' : 'Sign in to MarQuevedo Hair Studio'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isUpdatePassword && (!isForgotPassword && isSignUp) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="input-field"
                  required
                />
              </div>
            )}

            {!isUpdatePassword && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="input-field"
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {(!isForgotPassword || isUpdatePassword) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">
                    {isUpdatePassword ? 'New Password *' : 'Password *'}
                  </label>
                  {!isUpdatePassword && !isSignUp && (
                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[11px] text-emerald hover:text-emerald-700 font-semibold transition-colors">
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isUpdatePassword ? "Enter new password" : "Enter your password"}
                    className="input-field pr-10"
                    autoComplete={isSignUp || isUpdatePassword ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isSignUp ? 'Creating Account...' : 'Signing in...'}
                </span>
              ) : isUpdatePassword ? (
                'Update Password'
              ) : isForgotPassword ? (
                'Send Reset Link'
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Toggle Sign In / Sign Up / Forgot Password */}
          {!isUpdatePassword && (
            <div className="mt-6 text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (isForgotPassword) {
                    setIsForgotPassword(false)
                  } else {
                    setIsSignUp(!isSignUp)
                  }
                }}
                className="text-xs text-emerald hover:text-emerald-700 font-semibold transition-colors"
              >
                {isForgotPassword
                  ? 'Back to Sign In'
                  : isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </button>

              <p className="text-[11px] text-gray-400 pt-2">
                MarQuevedo Hair Studio © {new Date().getFullYear()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
