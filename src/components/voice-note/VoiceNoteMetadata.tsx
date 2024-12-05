import React from 'react';
import { Calendar, Clock, Tags } from 'lucide-react';
import { format } from 'date-fns';

interface VoiceNoteMetadataProps {
  title: string;
  createdAt: string;
  duration?: number;
  tags?: string[];
  description?: string;
}

export const VoiceNoteMetadata = ({
  title,
  createdAt,
  duration,
  tags,
  description,
}: VoiceNoteMetadataProps) => {
  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <h1 className="text-3xl font-bold text-primary mb-4">{title}</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center text-gray-400">
            <Calendar className="mr-2 h-4 w-4" />
            {format(new Date(createdAt), "PPP")}
          </div>
          
          {duration !== undefined && duration > 0 && (
            <div className="flex items-center text-gray-400">
              <Clock className="mr-2 h-4 w-4" />
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Tags className="h-4 w-4 text-gray-400 mr-2" />
              {tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {description && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">Description</h3>
            <p className="text-gray-300">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
};