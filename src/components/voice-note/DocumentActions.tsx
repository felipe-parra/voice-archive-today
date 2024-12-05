import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Mail } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface DocumentActionsProps {
  documentId?: string
  markdownUrl?: string | null
}

export const DocumentActions = ({ documentId, markdownUrl }: DocumentActionsProps) => {
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const handleDownload = async () => {
    if (!markdownUrl) {
      toast({
        title: 'Error',
        description: 'No markdown file available to download',
        variant: 'destructive',
      })
      return
    }

    const response = await fetch(markdownUrl)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleSendEmail = async () => {
    if (!documentId) {
      toast({
        title: 'Error',
        description: 'No document available to send',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSending(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase.functions.invoke('send-markdown-email', {
        body: {
          documentId,
          to: email,
          from: 'notifications@yourdomain.com', // Replace with your verified Resend domain
        },
      })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Document sent successfully',
      })
    } catch (error) {
      console.error('Error sending email:', error)
      toast({
        title: 'Error',
        description: 'Failed to send document',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex gap-2 mt-4">
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={!markdownUrl}
      >
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Send via Email
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Document via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter recipient's email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSendEmail}
              disabled={!email || isSending}
              className="w-full"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}