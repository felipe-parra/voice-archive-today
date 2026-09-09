import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, jsonBody } from './api'
import type { Session } from '../../shared/contracts'
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
  const queryClient = useQueryClient()
  const [isAuthenticated, setIsAuthenticated] = useState(USE_FIXTURES)

  useEffect(() => {
    if (USE_FIXTURES) return

    let active = true
    let expired = false
    const checkAuth = async () => {
      const {
        data: { session },
      } = await getSession()
      if (!active || expired) return
      if (!session) {
        queryClient.clear()
        navigate('/login', { replace: true })
      } else {
        setIsAuthenticated(true)
      }
    }

    checkAuth().catch(() => {
      if (active) navigate('/login', { replace: true })
    })

    const {
      data: { subscription },
    } = onAuthChange((_event, session) => {
      if (!session) {
        expired = true
        queryClient.clear()
        setIsAuthenticated(false)
        navigate('/login')
      } else {
        setIsAuthenticated(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate, queryClient])

  return isAuthenticated
}

// Future passkey verification can issue the same server session.
export const signIn = async (email: string) => {
  if (USE_FIXTURES) return { demo: true }
  return api<{ ok: true }>('/auth/magic-link', { method: 'POST', body: jsonBody({ email }) })
}
export const signUp = signIn
export const verifyMagicLink = (token: string) => api<Session>('/auth/verify', { method: 'POST', body: jsonBody({ token }) })
export const signOut = async () => {
  if (USE_FIXTURES) return { demo: true }
  await api<void>('/auth/logout', { method: 'POST' })
  window.dispatchEvent(new Event('session-expired'))
}
