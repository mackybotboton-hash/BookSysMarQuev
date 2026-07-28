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

// Request Browser Push Notification Permission (Facebook-style prompt)
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
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
