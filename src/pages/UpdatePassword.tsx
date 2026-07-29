import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match!')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success('Password updated successfully! You are now logged in.')
      
      // Check role to decide where to redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()
        
      if (profile?.role === 'admin') {
        navigate('/dashboard')
      } else {
        navigate('/client-dashboard')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#061A14] flex flex-col items-center justify-center p-4">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1974&auto=format&fit=crop')] bg-cover bg-center opacity-5" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="MarQuevedo Logo" className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-gold shadow-lg shadow-gold/20" />
          <h1 className="font-heading font-extrabold text-3xl text-white mb-2">Update Password</h1>
          <p className="text-emerald-200/80 text-sm">Please enter your new secure password below.</p>
        </div>

        <div className="bg-[#0A261E] rounded-2xl border border-emerald-900/50 shadow-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-medium text-emerald-200 mb-1.5 text-sm">New Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3.5 bg-black/50 border border-emerald-700/60 rounded-xl text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/70 hover:text-gold transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-emerald-200 mb-1.5 text-sm">Confirm Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 bg-black/50 border border-emerald-700/60 rounded-xl text-white placeholder-emerald-300/40 focus:outline-none focus:border-gold transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-4 text-base font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-4 rounded-xl"
            >
              {loading ? (
                <>Updating Password...</>
              ) : (
                <>
                  <Sparkles size={18} />
                  Save New Password
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
