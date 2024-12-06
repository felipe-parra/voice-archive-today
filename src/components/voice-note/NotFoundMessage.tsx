import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const NotFoundMessage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Voice note not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    </div>
  )
}
