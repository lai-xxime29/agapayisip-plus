import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useInactivityLogout } from './useInactivityLogout'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, role, purok_assigned, status, consent_at')
        .eq('user_id', session.user.id)
        .single()
      if (cancelled) return
      if (error || !data || data.status !== 'active') {
        setNotice('Your account has no active profile. Ask the LGU IT office.')
        await supabase.auth.signOut()
        return
      }
      setNotice('')
      setProfile(data)
      supabase.rpc('log_audit', { p_action: 'login' }) // audit trail (FR-03)
    })()
    return () => { cancelled = true }
  }, [session])

  useInactivityLogout(!!session, () => setNotice('You were signed out after 30 minutes of inactivity.'))

  async function acceptPrivacy() {
    const { error } = await supabase.rpc('accept_privacy_notice')
    if (error) return error.message
    setProfile((p) => ({ ...p, consent_at: new Date().toISOString() }))
    return ''
  }

  const loading = session === undefined || (!!session && !profile)

  return (
    <AuthContext.Provider value={{ session, profile, loading, notice, acceptPrivacy }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
