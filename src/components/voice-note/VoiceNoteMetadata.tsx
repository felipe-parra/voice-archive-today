import { format } from 'date-fns'

interface VoiceNoteMetadataProps {
  title: string
  createdAt: string
  duration?: number
  tags?: string[]
  description?: string
}

export const VoiceNoteMetadata = ({
  title,
  createdAt,
  duration,
  tags,
  description,
}: VoiceNoteMetadataProps) => {
  const durationLabel =
    duration !== undefined && duration > 0
      ? `${Math.floor(duration / 60)}:${(duration % 60)
          .toString()
          .padStart(2, '0')}`
      : null

  return (
    <div>
      <p className="va-eyebrow">
        {format(new Date(createdAt), 'PPP')}
        {durationLabel ? ` · ${durationLabel}` : ''}
      </p>

      <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
        {title}
      </h1>

      {description && (
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>
      )}

      {tags && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
