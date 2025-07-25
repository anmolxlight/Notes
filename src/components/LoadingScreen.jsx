import React from 'react'
import { Loader2 } from 'lucide-react'

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-4">
          <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto" />
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">AI Keep</h2>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

export default LoadingScreen