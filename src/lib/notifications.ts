// Luxury Web Audio API Chime & Native Push Notification Utility

// Global pre-warmed AudioContext singleton
let globalAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass()
    }
  }

  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {})
  }

  return globalAudioCtx
}

// Pre-warm audio context on user interaction (bypasses Chrome Autoplay Policy)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }

  window.addEventListener('click', unlockAudio)
  window.addEventListener('touchstart', unlockAudio)
  window.addEventListener('keydown', unlockAudio)
}

// Synthesizes a crisp, elegant dual-pitch gold bell chime (C6 -> G6)
export function playLuxuryChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playChimeNodes(ctx)).catch(() => {})
    } else {
      playChimeNodes(ctx)
    }
  } catch (e) {
    console.warn('Audio chime playback error:', e)
  }
}

function playChimeNodes(ctx: AudioContext) {
  try {
    const now = ctx.currentTime

    // Tone 1: High C6 (1046.5 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1046.5, now)
    gain1.gain.setValueAtTime(0.4, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.7)

    // Tone 2: Perfect Fifth G6 (1567.98 Hz) starting slightly delayed
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1567.98, now + 0.12)
    gain2.gain.setValueAtTime(0.45, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.9)
  } catch (err) {
    console.warn('Error rendering chime nodes:', err)
  }
}

// VAPID Public Key for Web Push
const VAPID_PUBLIC_KEY = 'BLt92sHxS8LM3tyCRgdTVy8U_RflljZ5fyjkNQyB0S3zd9-8JNOiW9F9-n6wkT6K41OBmx101geNaaoUEUrei2o'

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Subscribe to Background Push Notifications
export async function subscribeToPushNotifications(userId: string, role: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    const p256dh = subscription.getKey('p256dh')
    const auth = subscription.getKey('auth')

    if (!p256dh || !auth) return false

    const { supabase } = await import('@/lib/supabase')
    
    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (!existing) {
      await supabase.from('push_subscriptions').insert({
        user_id: userId,
        role: role,
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh) as unknown as number[])),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth) as unknown as number[]))
      })
    }
    return true
  } catch (error) {
    console.error('Error subscribing to push notifications:', error)
    return false
  }
}

// Request Browser Push Notification Permission (Facebook-style prompt)
export async function requestNotificationPermission(userId?: string, role?: string): Promise<boolean> {
  if (!('Notification' in window)) {
    return false
  }

  let granted = Notification.permission === 'granted'
  
  if (!granted && Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    granted = permission === 'granted'
  }

  if (granted && userId && role) {
    // If granted and user info provided, setup background push
    await subscribeToPushNotifications(userId, role)
  }

  return granted
}

// Trigger OS/Browser Native Desktop Notification
export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/logo.jpg',
        badge: '/logo.jpg',
        ...options,
      })
    }
  } catch (e) {
    console.warn('Browser notification error:', e)
  }
}
