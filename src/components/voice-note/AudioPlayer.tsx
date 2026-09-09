interface AudioPlayerProps {
  audioUrl: string
}

const WAVE_BARS = Array.from({ length: 40 }, (_, i) => 10 + ((i * 13) % 46))

export const AudioPlayer = ({ audioUrl }: AudioPlayerProps) => {
  if (!audioUrl) return null

  return (
    <div className="va-specimen">
      <p className="va-eyebrow">Audio</p>
      <div className="va-wave mt-4" data-recording="false" aria-hidden="true">
        {WAVE_BARS.map((h, i) => (
          <i key={i} style={{ height: `${h}px` }} />
        ))}
      </div>
      <audio controls className="mt-5 w-full" src={audioUrl}>
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}
