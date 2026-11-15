import { useEffect } from 'react'
import { supabase } from './supabase'

// NFR-07: end the session after 30 minutes without activity.
const LIMIT_MS = 30 * 60 * 1000

export function useInactivityLogout(active, onTimeout) {
  useEffect(() => {
    if (!active) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        onTimeout?.()
      }, LIMIT_MS)
    }
    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [active, onTimeout])
}
