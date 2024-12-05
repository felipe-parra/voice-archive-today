import React from 'react';

interface AudioPlayerProps {
  audioUrl: string;
}

export const AudioPlayer = ({ audioUrl }: AudioPlayerProps) => {
  if (!audioUrl) return null;

  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-primary mb-4">Audio</h3>
      <audio controls className="w-full" src={audioUrl}>
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};