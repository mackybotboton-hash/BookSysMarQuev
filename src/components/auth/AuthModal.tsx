import { useState } from 'react'
import { X, Lock, User, Mail, Phone, MapPin, Sparkles, Check, ArrowRight, Eye, EyeOff, LogIn, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

interface AuthModalProps {
  onSuccess: () => void
  onClose: () => void
  initialMode?: 'signin' | 'signup'
}

export default function AuthModal({ onSuccess, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>(initialMode)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [gender, setGender] = useState('Female')
  const [location, setLocation] = useState('Metro Manila')
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [loading, setLoading] = useState(false)

  // Handle Standard Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Signed in successfully!')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  // Handle Registration (Create an Account)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !fullName || !mobileNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!agreedTerms) {
      toast.error('You must agree to the Terms & Conditions')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, fullName, mobileNumber, gender, location)
      setUnverifiedEmail(email)
      setMode('verify')
      toast.success('Account created! Please check your email for the verification link.')
    } catch (err: any) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-b from-[#091E17] via-[#071712] to-[#040E0A] text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gold/30 animate-scale-in my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-gold/20 relative bg-black/30">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 p-2 rounded-full bg-white/10 text-emerald-200 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-full ring-2 ring-gold/50 shadow-md object-cover" />
            <div>
              <span className="text-[10px] font-bold text-gold tracking-widest uppercase flex items-center gap-1">
                <Sparkles size={12} /> MarQuevedo Hair Studio
              </span>
              <h3 className="font-heading font-extrabold text-2xl text-white mt-0.5">
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create an Account' : 'Verify Email'}
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* MODE 1: STANDARD SIGN IN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-emerald-200 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full pl-10 pr-4 py-3.5 bg-black/50 border border-emerald-700/60 rounded-xl text-sm text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-emerald-200 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3.5 bg-black/50 border border-emerald-700/60 rounded-xl text-sm text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/70 hover:text-gold transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-3.5 text-sm font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} />
              </button>

              <div className="pt-3 text-center">
                <p className="text-xs text-gray-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-gold font-bold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE 2: REGISTRATION (Create an Account) */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
              {/* Full Name */}
              <div>
                <label className="block font-medium text-emerald-200 mb-1">User Name / Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block font-medium text-emerald-200 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block font-medium text-emerald-200 mb-1">Mobile Number *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="0917 123 4567"
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Select Gender & Location Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-emerald-200 mb-1">Select Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full py-3 px-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-gold"
                  >
                    <option value="Female" className="bg-[#091E17]">Female</option>
                    <option value="Male" className="bg-[#091E17]">Male</option>
                    <option value="Prefer not to say" className="bg-[#091E17]">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-emerald-200 mb-1">Location</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/70" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Metro Manila"
                      className="w-full pl-8 pr-3 py-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block font-medium text-emerald-200 mb-1">Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    className="w-full pl-10 pr-11 py-3 bg-black/50 border border-emerald-700/60 rounded-xl text-xs text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/70 hover:text-gold transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Checkbox Terms & Conditions */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 accent-gold cursor-pointer"
                  required
                />
                <label htmlFor="terms" className="text-[11px] text-emerald-200/80 cursor-pointer leading-tight">
                  By continuing Sign up you agree to the following our{' '}
                  <span className="text-gold font-bold hover:underline">Terms & Conditions</span>.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-3.5 text-sm font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating account...' : 'Sign Up'} <ArrowRight size={16} />
              </button>

              <div className="pt-2 text-center">
                <p className="text-xs text-gray-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="text-gold font-bold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE 3: EMAIL VERIFICATION REQUIRED SCREEN */}
          {mode === 'verify' && (
            <div className="p-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gold/15 border border-gold/30 text-gold mx-auto flex items-center justify-center shadow-lg animate-bounce">
                <Mail size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-heading font-extrabold text-xl text-white">Verify Your Email Address</h3>
                <p className="text-xs text-emerald-200/80 leading-relaxed max-w-xs mx-auto">
                  A verification email has been sent to{' '}
                  <span className="font-bold text-gold underline block mt-1">{unverifiedEmail || email}</span>
                </p>
                <p className="text-[11px] text-gray-400 pt-2">
                  Please check your email inbox (and spam folder), click the confirmation link to activate your account, then sign in.
                </p>
              </div>

              <div className="pt-4 border-t border-gold/20">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="btn-gold w-full py-3 text-xs font-bold shadow-md flex items-center justify-center gap-2"
                >
                  <LogIn size={16} /> Proceed to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
