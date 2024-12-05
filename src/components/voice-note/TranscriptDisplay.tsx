import React from 'react';
import { FileText } from 'lucide-react';

interface TranscriptDisplayProps {
  transcript: string;
}

export const TranscriptDisplay = ({ transcript }: TranscriptDisplayProps) => {
  if (!transcript) return null;

  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <div className="flex items-center mb-4">
        <FileText className="mr-2 h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-primary">Transcript</h3>
      </div>
      <p className="text-gray-300 whitespace-pre-wrap">{transcript}</p>
    </div>
  );
};