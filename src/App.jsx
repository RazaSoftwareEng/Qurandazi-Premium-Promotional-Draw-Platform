import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import AppRoutes from '@/routes/AppRoutes'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#101B31',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '12px',
                border: '1px solid rgba(212,175,87,0.25)',
              },
              success: { iconTheme: { primary: '#D4AF57', secondary: '#101B31' } },
              error: { iconTheme: { primary: '#F87171', secondary: '#101B31' } },
            }}
          />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
