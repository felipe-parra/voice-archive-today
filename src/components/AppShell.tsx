import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { signOut } from '@/data/auth'
import CreatedBy from './CreatedBy'

interface AppShellProps {
  children: ReactNode
}

export const AppShell = ({ children }: AppShellProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      await signOut()
      queryClient.clear()
      navigate('/login')
    } catch (error) {
      toast({ title: 'Could not sign out', description: 'Please try again.', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            felipeparra
            <span className="text-muted-foreground"> / voice-archive-today</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Account menu"
              >
                <UserRound className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => navigate('/account')}>
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:px-6">
        {children}
      </main>

      <footer className="border-t border-border">
        <CreatedBy />
      </footer>
    </div>
  )
}
