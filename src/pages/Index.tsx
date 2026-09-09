import { VoiceNote } from '@/components/VoiceNote'
import { AppShell } from '@/components/AppShell'
import { useAuthGuard } from '@/data/auth'

const Index = () => {
  useAuthGuard()

  return (
    <AppShell>
      <VoiceNote />
    </AppShell>
  )
}

export default Index
