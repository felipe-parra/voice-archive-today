import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const NotFoundMessage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-24 md:px-6">
        <p className="va-eyebrow">404 / Not found</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          This note isn&apos;t here.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          It may have been deleted, or the link is wrong.
        </p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </Button>
      </div>
    </div>
  )
}
