import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { requestNotificationPermission } from '@/lib/notifications'

export function useAuth() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    // 1. Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session) {
        setSession(session)
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // 2. Listen for auth state changes (e.g. user clicks email verification link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (event === 'PASSWORD_RECOVERY') {
          window.location.href = '/update-password'
        }

        if (session) {
          setSession(session)
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    const sessionUser = useAuthStore.getState().user
    const isEmailAdmin = sessionUser?.email?.toLowerCase().includes('admin')

    if (data) {
      if (isEmailAdmin && data.role !== 'admin') {
        data.role = 'admin'
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)
      }
      setProfile(data as any)
      localStorage.setItem('marquevedo_auth_profile', JSON.stringify(data))
    } else if (sessionUser) {
      const defaultRole = isEmailAdmin ? 'admin' : 'client'
      const newProfile = {
        id: userId,
        email: sessionUser.email || '',
        full_name: sessionUser.user_metadata?.full_name || sessionUser.email || 'Client',
        phone: sessionUser.user_metadata?.phone || '',
        gender: sessionUser.user_metadata?.gender || 'Female',
        location: sessionUser.user_metadata?.location || 'Metro Manila',
        role: defaultRole as any,
      }
      await supabase.from('profiles').upsert(newProfile)
      setProfile(newProfile as any)
      localStorage.setItem('marquevedo_auth_profile', JSON.stringify(newProfile))
    }
    
    // Request Push Notification permissions silently (will prompt if not granted)
    const activeProfile = useAuthStore.getState().profile
    if (activeProfile) {
      setTimeout(() => {
        requestNotificationPermission(activeProfile.id, activeProfile.role).catch(console.error)
      }, 2000)
    }
    
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('verify')) {
        throw new Error('Please check your email inbox and verify your account before signing in.')
      }
      throw error
    }

    if (data.user) {
      await fetchProfile(data.user.id)
    }

    return data
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string = '',
    gender: string = 'Female',
    location: string = 'Metro Manila'
  ) => {
    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          gender,
          location,
          role: 'client',
        },
      },
    })

    if (error) throw error

    // Pre-insert profile row in database table
    if (data.user) {
      const profileRow = {
        id: data.user.id,
        email,
        full_name: fullName,
        phone,
        gender,
        location,
        role: 'client',
      }
      try {
        await supabase.from('profiles').upsert(profileRow as any)
      } catch (e) {
        console.warn('Profile insert note:', e)
      }
    }

    return { user: data.user, requiresVerification: true, email }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('marquevedo_auth_profile')
    reset()
  }

  return { signIn, signUp, signOut }
}
