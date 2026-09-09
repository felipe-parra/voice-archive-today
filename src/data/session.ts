import type { Session } from '../../shared/contracts'
import { api } from './api'
import { USE_FIXTURES } from './mode'
import { FIXTURE_SESSION } from './fixtures'

export const getSession = async () => {
  const session: Session | null = USE_FIXTURES ? FIXTURE_SESSION : await api<Session | null>('/auth/session')
  return { data: { session }, error: null }
}
export const onAuthChange = (cb: (event: string, session: Session | null) => void) => {
  const expired = () => cb('SIGNED_OUT', null)
  window.addEventListener('session-expired', expired)
  return { data: { subscription: { unsubscribe: () => window.removeEventListener('session-expired', expired) } } }
}
