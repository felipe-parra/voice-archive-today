import React from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { uploadVoiceNote } from '@/data/voiceNotes'
import { USE_FIXTURES } from '@/data/mode'

interface AudioFileUploadProps {
  onUploadComplete: () => void
}

export const AudioFileUpload = ({ onUploadComplete }: AudioFileUploadProps) => {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'This action is disabled in the fixture preview.',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (!file.type.startsWith('audio/')) {
      toast({
        title: 'Error',
        description: 'Please upload an audio file',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsUploading(true)
      await uploadVoiceNote(file, file.name, 0, file.name)

      toast({
        title: 'Success',
        description: 'Audio file uploaded successfully!',
      })

      onUploadComplete()
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      })
    } finally { setIsUploading(false) }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
      <Button
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        variant="link"
        className="va-text-link gap-2 text-foreground"
      >
        <Upload className="h-4 w-4" />
        <span>{isUploading ? 'Uploading…' : 'Upload audio'}</span>
      </Button>
    </div>
  )
}
