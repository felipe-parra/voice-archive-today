import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ProfileForm } from '@/components/ProfileForm'
import { useAuthGuard } from '@/data/auth'
import { getSession } from '@/data/session'
import { getProfile } from '@/data/voiceNotes'
import { USE_FIXTURES } from '@/data/mode'
import { FIXTURE_PROFILE } from '@/data/fixtures'

interface ProfileData {
  email: string
  full_name: string
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  birthdate: Date
  avatar_url: string
}

const Account = () => {
  useAuthGuard()
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  const loadProfile = async () => {
    if (USE_FIXTURES) {
      setProfileData({
        email: FIXTURE_PROFILE.email,
        full_name: FIXTURE_PROFILE.full_name,
        gender: FIXTURE_PROFILE.gender,
        birthdate: FIXTURE_PROFILE.birthdate,
        avatar_url: FIXTURE_PROFILE.avatar_url,
      })
      setIsLoading(false)
      return
    }

    try {
      const {
        data: { session },
      } = await getSession()
      if (!session) {
        setIsLoading(false)
        return
      }

      const profile = await getProfile(session.user.id)
      if (profile) {
        setProfileData({
          email: session.user.email ?? '',
          full_name: profile.full_name || '',
          gender:
            (profile.gender as ProfileData['gender']) || 'prefer_not_to_say',
          birthdate: profile.birthdate
            ? new Date(profile.birthdate)
            : new Date(),
          avatar_url: profile.avatar_url || '',
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell>
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <p className="va-eyebrow">04 / Profile</p>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[0.95] tracking-[-0.045em] text-foreground md:text-6xl">
            Your account.
          </h1>
          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            Your name and details, used across the archive.
          </p>

          <div className="mt-10 rounded-lg border border-border bg-card p-8 shadow-[0_18px_32px_rgba(38,32,41,0.08)]">
            {profileData ? (
              <ProfileForm initialData={profileData} onSave={loadProfile} />
            ) : (
              <p className="text-muted-foreground">
                We couldn&apos;t load your profile. Try again shortly.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default Account
