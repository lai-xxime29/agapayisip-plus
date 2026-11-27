// AgapayIsip+ service worker: shows push reminders. It caches nothing, so a new deploy is never stale.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data.json() } catch { /* plain text or empty */ }
  event.waitUntil(self.registration.showNotification(data.title || 'AgapayIsip+', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/dashboard' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) { if ('focus' in w) { w.navigate?.(url); return w.focus() } }
    return self.clients.openWindow(url)
  }))
})
