import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { ProfileForm } from '@/components/ProfileForm'

const Account = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)

  const checkSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      navigate('/login')
      return
    }

    // Fetch profile data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return
    }

    if (profile) {
      setProfileData({
        email: session.user.email,
        full_name: profile.full_name || '',
        gender: profile.gender || 'prefer_not_to_say',
        birthdate: profile.birthdate ? new Date(profile.birthdate) : new Date(),
        avatar_url: profile.avatar_url || '',
      })
    }

    setIsLoading(false)
  }

  useEffect(() => {
    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {profileData && (
            <ProfileForm
              initialData={profileData}
              onSave={() => {
                // Refresh profile data after save
                checkSession()
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Account
