import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { ToastProvider } from 'react-toast-notifications'

import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { NotesProvider } from './contexts/NotesContext'
import { AIProvider } from './contexts/AIContext'
import { OfflineProvider } from './contexts/OfflineContext'
import ErrorBoundary from './components/ErrorBoundary'

import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error("Missing Clerk Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={clerkPubKey}>
        <BrowserRouter>
          <AuthProvider>
            <OfflineProvider>
              <NotesProvider>
                <AIProvider>
                  <ToastProvider
                    autoDismiss
                    autoDismissTimeout={4000}
                    placement="top-right"
                  >
                    <App />
                  </ToastProvider>
                </AIProvider>
              </NotesProvider>
            </OfflineProvider>
          </AuthProvider>
        </BrowserRouter>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)