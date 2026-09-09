import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { USE_FIXTURES } from './mode'
import { getSession, onAuthChange } from './session'

/**
 * Route guard used by the authenticated screens. In fixture mode it is a no-op
 * so every screen renders without a backend. In live mode it replicates the
 * current gate: no session → redirect to /login, with subscription cleanup.
 */
export const useAuthGuard = () => {
  const navigate = useNavigate()

  useEffect(() => {
    if (USE_FIXTURES) return

    const checkAuth = async () => {
      const {
        data: { session },
      } = await getSession()
      if (!session) {
        navigate('/login')
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = onAuthChange((_event, session) => {
      if (!session) {
        navigate('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])
}

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
