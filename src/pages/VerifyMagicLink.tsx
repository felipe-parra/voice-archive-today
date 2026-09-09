import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { verifyMagicLink } from '@/data/auth'

export default function VerifyMagicLink() {
  const token = useRef('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    if (fragment.has('token')) token.current = fragment.get('token') || ''
    window.history.replaceState(null, '', window.location.pathname)
    setReady(Boolean(token.current))
  }, [])
  const verify = async () => {
    setBusy(true)
    setError('')
    try {
      await verifyMagicLink(token.current)
      token.current = ''
      queryClient.clear()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This link could not be verified. Request a new one.')
    } finally { setBusy(false) }
  }
  return <AuthLayout><div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8">
    <p className="va-eyebrow">Confirm sign in</p>
    <h1 className="mt-6 text-4xl font-bold">Open your archive.</h1>
    <p className="my-6 text-muted-foreground">Continue to confirm this email sign-in link. Links expire after 15 minutes and work once.</p>
    {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
    {ready ? <Button onClick={verify} disabled={busy}>{busy ? 'Confirming…' : 'Continue to archive'}</Button> : <p>This link is missing its token. Please request a new link.</p>}
    <p className="mt-6"><Link to="/login" className="va-text-link">Request another link</Link></p>
  </div></AuthLayout>
}
