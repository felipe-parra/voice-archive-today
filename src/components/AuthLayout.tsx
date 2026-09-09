import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: ReactNode
}

export const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto w-full max-w-5xl px-6 py-6">
      <Link
        to="/"
        className="font-display text-lg font-bold tracking-[-0.02em]"
      >
        felipeparra
        <span className="text-muted-foreground"> / voice-archive-today</span>
      </Link>
    </header>
    <div className="grid flex-1 place-items-center px-6 pb-16">
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  </div>
)
