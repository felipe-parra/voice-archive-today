import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { USE_FIXTURES } from './mode'
import { getSession, onAuthChange } from './session'

/**
 * Route guard used by the authenticated screens. In fixture mode it is a no-op
 * so every screen renders without a backend. In live mode it replicates the
 * current gate: no session → redirect to /login, with subscription cleanup.
 *
 * Returns whether the session has been confirmed authenticated, so callers can
 * defer protected data loading until this resolves to `true`.
 */
export const useAuthGuard = () => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(USE_FIXTURES)

  useEffect(() => {
    if (USE_FIXTURES) return

    const checkAuth = async () => {
      const {
        data: { session },
      } = await getSession()
      if (!session) {
        navigate('/login')
      } else {
        setIsAuthenticated(true)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = onAuthChange((_event, session) => {
      if (!session) {
        setIsAuthenticated(false)
        navigate('/login')
      } else {
        setIsAuthenticated(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return isAuthenticated
}

// AUTH DIRECTION (Founder, 2026-09-09): drop email+password. Login/signup should
// be a single email field → magic link (`supabase.auth.signInWithOtp`, or the
// equivalent on the Render backend once migrated), and add passkeys / WebAuthn
// as a second factor-free option later. `password` here is transitional.
export const signIn = async (email: string, password: string) => {
  if (USE_FIXTURES) return { demo: true }
  return supabase.auth.signInWithPassword({ email, password })
}

export const signUp = async (email: string, password: string) => {
  if (USE_FIXTURES) return { demo: true }
  return supabase.auth.signUp({ email, password })
}

export const signOut = async () => {
  if (USE_FIXTURES) return { demo: true }
  return supabase.auth.signOut()
}
