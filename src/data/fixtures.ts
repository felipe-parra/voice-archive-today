/**
 * Seed content for fixture / screenshot mode. Shapes mirror
 * src/integrations/supabase/types.ts (voice_notes, documents, profiles).
 */

export const FIXTURE_SESSION = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'demo-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'hola@felipeparra.dev',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
} as const

export const FIXTURE_PROFILE = {
  email: 'hola@felipeparra.dev',
  full_name: 'Felipe Parra',
  gender: 'prefer_not_to_say' as const,
  birthdate: new Date('1993-05-01'),
  avatar_url: '',
}

export interface FixtureVoiceNote {
  id: string
  title: string
  audio_url: string
  created_at: string
  duration: number | null
  description: string | null
  tags: string[] | null
  transcript: string | null
  user_id: string
}

export const FIXTURE_VOICE_NOTES: FixtureVoiceNote[] = [
  {
    id: 'vn-001',
    title: 'Field notes — the smallest useful version',
    created_at: '2026-08-31T09:12:00Z',
    duration: 92,
    tags: ['product', 'ideas'],
    description: 'Voice memo from a morning walk.',
    transcript:
      'Every feature I want to add is really a question in disguise. Ship the smallest version that answers one question, then listen to what people do with it.',
    audio_url: '/sample-note.mp3',
    user_id: 'demo-user',
  },
  {
    id: 'vn-002',
    title: 'Weekly review — what to drop',
    created_at: '2026-08-28T18:03:00Z',
    duration: 210,
    tags: ['review', 'focus'],
    description: 'End-of-week reflection.',
    transcript:
      'Three things carried the week. The rest was motion without progress. Next week starts with the task I keep postponing.',
    audio_url: '/sample-note.mp3',
    user_id: 'demo-user',
  },
  {
    id: 'vn-003',
    title: 'Reading highlight — attention',
    created_at: '2026-08-24T21:40:00Z',
    duration: 47,
    tags: ['reading'],
    description: 'Captured while reading.',
    transcript: '',
    audio_url: '/sample-note.mp3',
    user_id: 'demo-user',
  },
]

export interface FixtureDocument {
  id: string
  voice_note_id: string
  title: string
  content: string
  markdown_url: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export const FIXTURE_DOCUMENTS: FixtureDocument[] = [
  {
    id: 'doc-001',
    voice_note_id: 'vn-001',
    title: 'Field notes — summary',
    markdown_url: null,
    user_id: 'demo-user',
    created_at: '2026-08-31T09:20:00Z',
    updated_at: '2026-08-31T09:20:00Z',
    content: `## Summary
- A backlog is a list of open questions, not tasks.
- Ship the smallest version that answers one question.
- Decide the next step by watching what people do with it.

## Next step
Cut the next release down to a single question.`,
  },
]
