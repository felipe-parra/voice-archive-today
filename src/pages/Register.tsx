import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout } from '@/components/AuthLayout'
import { useToast } from '@/components/ui/use-toast'
import { USE_FIXTURES } from '@/data/mode'
import { getSession } from '@/data/session'
import { signUp } from '@/data/auth'

interface RegisterFields {
  email: string
}

const Register = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFields>({ defaultValues: { email: '' } })

  useEffect(() => {
    if (USE_FIXTURES) return
    const checkSession = async () => {
      const {
        data: { session },
      } = await getSession()
      if (session) navigate('/')
    }
    checkSession().catch(() => setError('Unable to check your session. Please try again.'))
  }, [navigate])

  const onSubmit = async (values: RegisterFields) => {
    setError(null)
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'Sign-up is disabled in the fixture preview.',
      })
      return
    }
    try {
      await signUp(values.email)
      toast({ title: 'Check your inbox', description: 'If delivery is available, a sign-in link will arrive shortly. Open it to continue.' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to send link. Please try again.')
    }
  }

  return (
    <AuthLayout>
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div className="md:pr-6">
          <p className="va-eyebrow">01 / Create account</p>
          <h1 className="mt-6 text-balance text-6xl font-bold leading-[0.95] tracking-[-0.045em] text-foreground md:text-7xl">
            Start your archive.
          </h1>
          <p className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
            Capture a thought by voice, keep the transcript, and find it later.
            One account, everything in one place.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 shadow-[0_18px_32px_rgba(38,32,41,0.08)] md:p-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                {...register('email', { required: true })}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="va-text-link text-foreground">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Register
