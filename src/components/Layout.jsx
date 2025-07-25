import React, { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { 
  Menu, 
  Search, 
  Plus, 
  Settings, 
  Bot,
  X,
  Grid3X3,
  List,
  Archive,
  Trash2,
  Tag,
  StickyNote
} from 'lucide-react'

import Sidebar from './Sidebar'
import Header from './Header'
import AIChat from './AIChat'
import CreateNoteModal from './notes/CreateNoteModal'
import SearchModal from './SearchModal'
import { useNotes } from '../contexts/NotesContext'
import { useAI } from '../contexts/AIContext'
import { useAuth } from '../contexts/AuthContext'
import config from '../config'
import { cn } from '../utils'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  
  const { viewMode, setViewMode } = useNotes()
  const { chatVisible, toggleChat } = useAI()
  const { getUserDisplayName } = useAuth()

  // Keyboard shortcuts
  useHotkeys(config.shortcuts.newNote, () => setCreateNoteOpen(true))
  useHotkeys(config.shortcuts.search, (e) => {
    e.preventDefault()
    setSearchOpen(true)
  })
  useHotkeys(config.shortcuts.toggleView, () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid')
  })
  useHotkeys(config.shortcuts.openAI, () => toggleChat())

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div
        className={cn(
          'hidden md:flex md:flex-shrink-0',
          sidebarOpen ? 'md:w-64' : 'md:w-16'
        )}
      >
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <Sidebar 
              isOpen={true} 
              onToggle={() => setSidebarOpen(false)}
              mobile
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Header */}
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onSearchClick={() => setSearchOpen(true)}
          onCreateNoteClick={() => setCreateNoteOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Floating action buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
          {/* AI Chat toggle */}
          <button
            onClick={toggleChat}
            className={cn(
              'h-12 w-12 rounded-full shadow-lg transition-all duration-200',
              'flex items-center justify-center',
              chatVisible
                ? 'bg-primary-600 text-white'
                : 'bg-white text-primary-600 hover:bg-primary-50'
            )}
            title="AI Chat (A)"
          >
            {chatVisible ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
          </button>

          {/* Create note button */}
          <button
            onClick={() => setCreateNoteOpen(true)}
            className="h-14 w-14 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center"
            title="Create Note (C)"
          >
            <Plus className="h-8 w-8" />
          </button>
        </div>

        {/* View mode toggle (desktop only) */}
        <div className="hidden md:block fixed bottom-6 left-6">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="h-10 w-10 bg-white text-gray-600 rounded-lg shadow-md hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center"
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view (V)`}
          >
            {viewMode === 'grid' ? <List className="h-5 w-5" /> : <Grid3X3 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* AI Chat Panel */}
      {chatVisible && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <AIChat onClose={() => toggleChat()} />
        </div>
      )}

      {/* Modals */}
      <CreateNoteModal 
        isOpen={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
      />

      <SearchModal 
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  )
}

export default Layout