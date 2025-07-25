import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useToasts } from 'react-toast-notifications'

import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import Notes from './pages/Notes'
import Archive from './pages/Archive'
import Trash from './pages/Trash'
import Labels from './pages/Labels'
import Settings from './pages/Settings'
import LoadingScreen from './components/LoadingScreen'
import { useOffline } from './contexts/OfflineContext'

function App() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isOnline } = useOffline()
  const { addToast } = useToasts()

  // Show loading screen while Clerk is initializing
  if (!isLoaded) {
    return <LoadingScreen />
  }

  // Show sign in page if user is not authenticated
  if (!isSignedIn) {
    return <SignIn />
  }

  // Show offline notification
  React.useEffect(() => {
    if (!isOnline) {
      addToast('You are offline. Changes will sync when connection is restored.', {
        appearance: 'warning',
        autoDismiss: false,
      })
    }
  }, [isOnline, addToast])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/notes" replace />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/labels" element={<Labels />} />
        <Route path="/labels/:labelId" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Routes>
    </Layout>
  )
}

export default App