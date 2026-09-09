import { supabase } from '@/integrations/supabase/client'
import { USE_FIXTURES } from './mode'
import { FIXTURE_SESSION } from './fixtures'

export const getSession = async () => {
  if (USE_FIXTURES) {
    return { data: { session: FIXTURE_SESSION as any }, error: null }
  }
  return supabase.auth.getSession()
}

type AuthChangeCallback = Parameters<
  typeof supabase.auth.onAuthStateChange
>[0]

export const onAuthChange = (cb: AuthChangeCallback) => {
  if (USE_FIXTURES) {
    return { data: { subscription: { unsubscribe() {} } } } as ReturnType<
      typeof supabase.auth.onAuthStateChange
    >
  }
  return supabase.auth.onAuthStateChange(cb)
}
