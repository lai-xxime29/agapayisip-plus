import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '')

function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

// 'unsupported' | 'needs_install' (iPhone, not added to home screen) | 'not_set_up' | 'denied' | 'off' | 'on'
export async function pushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isInstalled() ? 'needs_install' : 'unsupported'
  }
  if (!VAPID_PUBLIC_KEY) return 'not_set_up'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch { return 'off' }
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').insert({ endpoint: json.endpoint, keys: json.keys })
  if (error && error.code !== '23505') throw new Error(error.message) // 23505 = this phone is already registered
  return 'on'
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}

// Asks the server to send a test message to this user's phones. Returns how many were reached.
export async function sendTestPush() {
  if (!SERVER_URL) throw new Error('The reminder server is not set up yet.')
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${SERVER_URL}/api/push/test`, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not send the test')
  return body
}
