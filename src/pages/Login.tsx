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
import { signIn } from '@/data/auth'

interface LoginFields {
  email: string
  password: string
}

const Login = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFields>({ defaultValues: { email: '', password: '' } })

  useEffect(() => {
    if (USE_FIXTURES) return
    const checkSession = async () => {
      const {
        data: { session },
      } = await getSession()
      if (session) navigate('/')
    }
    checkSession()
  }, [navigate])

  const onSubmit = async (values: LoginFields) => {
    setError(null)
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'Sign-in is disabled in the fixture preview.',
      })
      return
    }
    const result = await signIn(values.email, values.password)
    if (result && 'error' in result && result.error) {
      setError(result.error.message)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout>
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p className="va-eyebrow">01 / Sign in</p>
          <h1 className="mt-6 text-5xl font-bold leading-[0.96] tracking-tight text-foreground md:text-6xl">
            Welcome back.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Pick up your archive where you left it. Every note you have captured
            is one search away.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 shadow-[0_18px_32px_rgba(38,32,41,0.08)]">
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
                {...register('email', { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password', { required: true })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="va-text-link text-foreground">
              Start your archive
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Login
