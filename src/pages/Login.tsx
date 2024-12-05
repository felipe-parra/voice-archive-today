import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'

const Login = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Session check error:', error)
          // Clear any existing session data
          await supabase.auth.signOut()
          toast({
            title: 'Session Error',
            description: 'Please sign in again',
            variant: 'destructive',
          })
          return
        }

        if (session) {
          navigate('/')
        }
      } catch (error) {
        console.error('Unexpected error during session check:', error)
        // Clear any existing session data
        await supabase.auth.signOut()
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session)

      if (event === 'SIGNED_IN' && session) {
        navigate('/')
      } else if (event === 'SIGNED_OUT') {
        // Clear any existing session data
        await supabase.auth.signOut()
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate, toast])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md space-y-8 bg-background/80 backdrop-blur-sm p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary">Welcome Back</h2>
          <p className="mt-2 text-muted-foreground">
            Please sign in to continue
          </p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
          view="sign_in"
        />
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link to="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
