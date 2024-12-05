import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Index from './pages/Index'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import VoiceNoteDetail from './pages/VoiceNoteDetail'
import CreatedBy from './components/CreatedBy'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <main className="w-screen h-full relative">
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Index />} />
            <Route path="/account" element={<Account />} />
            <Route path="/voice-note/:id" element={<VoiceNoteDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CreatedBy />
        </main>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
)

export default App