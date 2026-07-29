/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Precache Vite assets
precacheAndRoute(self.__WB_MANIFEST || [])

// Handle incoming Web Push
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'MarQuevedo Hair Studio'
  const options = {
    body: data.body || 'You have a new notification!',
    icon: data.icon || '/logo-192x192.png',
    badge: data.badge || '/logo-192x192.png',
    data: {
      url: data.url || '/',
    },
  }

  // Update App Badge if supported
  if ('setAppBadge' in navigator) {
    // Increment or set to 1
    // We would need to pass unread count in payload for accurate badging
    const count = data.unreadCount || 1;
    (navigator as any).setAppBadge(count).catch(console.error)
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

// Update App Badge on push subscription clear or app open (handled in client side mostly)
self.addEventListener('message', (event) => {
  if (event.data === 'clearBadge' && 'clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge().catch(console.error)
  }
})
