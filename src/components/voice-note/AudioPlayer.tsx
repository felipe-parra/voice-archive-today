interface AudioPlayerProps {
  audioUrl: string
}

// Static decorative waveform — same envelope shape as the recorder specimen.
const WAVE_BARS = Array.from({ length: 40 }, (_, i) => {
  const envelope = Math.sin((i / 39) * Math.PI)
  const texture = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))
  return Math.round(12 + 68 * envelope * texture)
})

export const AudioPlayer = ({ audioUrl }: AudioPlayerProps) => {
  if (!audioUrl) return null

  return (
    <div className="va-specimen">
      <p className="va-eyebrow">Audio</p>
      <div
        className="va-wave mt-4 overflow-hidden"
        data-recording="false"
        aria-hidden="true"
      >
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
