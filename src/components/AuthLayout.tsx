import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="min-h-screen bg-background grid place-items-center p-6">
    <div className="w-full max-w-5xl">{children}</div>
  </div>
)
