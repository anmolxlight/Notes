import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react'
import { validateConfig } from '../config'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const { isLoaded, isSignedIn, userId, signOut } = useClerkAuth()
  const { user } = useUser()
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    userId: null,
  })

  useEffect(() => {
    // Validate configuration on startup
    try {
      validateConfig()
    } catch (error) {
      console.error('Configuration validation failed:', error)
    }
  }, [])

  useEffect(() => {
    if (isLoaded) {
      setAuthState({
        isLoading: false,
        isAuthenticated: isSignedIn,
        user: user ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          imageUrl: user.imageUrl,
          createdAt: user.createdAt,
          lastSignInAt: user.lastSignInAt,
        } : null,
        userId: userId,
      })
    }
  }, [isLoaded, isSignedIn, user, userId])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const value = {
    ...authState,
    signOut: handleSignOut,
    // Helper methods
    getUserDisplayName: () => {
      if (!authState.user) return 'Guest'
      return authState.user.fullName || 
             `${authState.user.firstName} ${authState.user.lastName}`.trim() ||
             authState.user.email ||
             'User'
    },
    getUserInitials: () => {
      if (!authState.user) return 'G'
      const firstName = authState.user.firstName || ''
      const lastName = authState.user.lastName || ''
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase()
      }
      if (firstName) return firstName[0].toUpperCase()
      if (authState.user.email) return authState.user.email[0].toUpperCase()
      return 'U'
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext