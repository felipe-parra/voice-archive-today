import { VoiceNote } from '@/components/VoiceNote'
import { AppShell } from '@/components/AppShell'
import { useAuthGuard } from '@/data/auth'

const Index = () => {
  const isAuthenticated = useAuthGuard()

  return (
    <AppShell>
      <VoiceNote isAuthenticated={isAuthenticated} />
    </AppShell>
  )
}

export default Index
