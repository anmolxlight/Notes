import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useToasts } from 'react-toast-notifications'
import { useAuth } from './AuthContext'
import { useOffline } from './OfflineContext'
import { notesService, labelsService } from '../services/supabase'
import aiService from '../services/ai'
import config from '../config'

const NotesContext = createContext({})

export const useNotes = () => {
  const context = useContext(NotesContext)
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider')
  }
  return context
}

export const NotesProvider = ({ children }) => {
  const [notes, setNotes] = useState([])
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  
  const { userId, isAuthenticated } = useAuth()
  const { isOnline, offlineService } = useOffline()
  const { addToast } = useToasts()

  // Load data on authentication
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadData()
    } else {
      setNotes([])
      setLabels([])
      setLoading(false)
    }
  }, [isAuthenticated, userId])

  // Load data from appropriate source (online/offline)
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (isOnline) {
        // Load from server
        const [notesData, labelsData] = await Promise.all([
          notesService.getNotes(userId, { archived: showArchived }),
          labelsService.getLabels(userId)
        ])
        setNotes(notesData)
        setLabels(labelsData)
      } else {
        // Load from offline storage
        const [notesData, labelsData] = await Promise.all([
          offlineService.notes.getAll(userId, { archived: showArchived }),
          offlineService.labels.getAll(userId)
        ])
        setNotes(notesData)
        setLabels(labelsData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      addToast('Failed to load notes', {
        appearance: 'error',
        autoDismiss: true,
      })
    } finally {
      setLoading(false)
    }
  }, [userId, isOnline, showArchived, offlineService, addToast])

  // Filtered notes based on search, color, and label
  const filteredNotes = React.useMemo(() => {
    let filtered = notes

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      )
    }

    if (selectedColor) {
      filtered = filtered.filter(note => note.color === selectedColor)
    }

    if (selectedLabel) {
      filtered = filtered.filter(note =>
        note.labels?.some(label => label.id === selectedLabel)
      )
    }

    // Sort: pinned notes first, then by updated date
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.updated_at) - new Date(a.updated_at)
    })
  }, [notes, searchQuery, selectedColor, selectedLabel])

  // Note operations
  const createNote = useCallback(async (noteData) => {
    try {
      let newNote
      if (isOnline) {
        newNote = await notesService.createNote(userId, noteData)
      } else {
        newNote = await offlineService.notes.create(userId, noteData)
      }

      setNotes(prev => [newNote, ...prev])
      
      // Store embedding for AI search if online
      if (isOnline && aiService.isPineconeAvailable()) {
        aiService.storeNoteEmbedding(newNote).catch(console.error)
      }

      addToast('Note created successfully', {
        appearance: 'success',
        autoDismiss: true,
      })

      return newNote
    } catch (error) {
      console.error('Failed to create note:', error)
      addToast('Failed to create note', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const updateNote = useCallback(async (noteId, updates) => {
    try {
      let updatedNote
      if (isOnline) {
        updatedNote = await notesService.updateNote(noteId, userId, updates)
      } else {
        updatedNote = await offlineService.notes.update(noteId, userId, updates)
      }

      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, ...updatedNote } : note
      ))

      // Update embedding for AI search if online
      if (isOnline && aiService.isPineconeAvailable()) {
        aiService.storeNoteEmbedding(updatedNote).catch(console.error)
      }

      return updatedNote
    } catch (error) {
      console.error('Failed to update note:', error)
      addToast('Failed to update note', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const deleteNote = useCallback(async (noteId, permanent = false) => {
    try {
      if (isOnline) {
        if (permanent) {
          await notesService.deleteNote(noteId, userId)
        } else {
          await notesService.moveToTrash(noteId, userId)
        }
      } else {
        await offlineService.notes.delete(noteId, userId, permanent)
      }

      if (permanent) {
        setNotes(prev => prev.filter(note => note.id !== noteId))
        
        // Remove embedding from AI search
        if (isOnline && aiService.isPineconeAvailable()) {
          aiService.deleteNoteEmbedding(noteId).catch(console.error)
        }
      } else {
        setNotes(prev => prev.map(note => 
          note.id === noteId ? { ...note, deleted: true, deleted_at: new Date().toISOString() } : note
        ))
      }

      addToast(permanent ? 'Note deleted permanently' : 'Note moved to trash', {
        appearance: 'success',
        autoDismiss: true,
      })
    } catch (error) {
      console.error('Failed to delete note:', error)
      addToast('Failed to delete note', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const restoreNote = useCallback(async (noteId) => {
    try {
      let restoredNote
      if (isOnline) {
        restoredNote = await notesService.restoreNote(noteId, userId)
      } else {
        restoredNote = await offlineService.notes.restore(noteId, userId)
      }

      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, deleted: false, deleted_at: null } : note
      ))

      addToast('Note restored successfully', {
        appearance: 'success',
        autoDismiss: true,
      })

      return restoredNote
    } catch (error) {
      console.error('Failed to restore note:', error)
      addToast('Failed to restore note', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const togglePin = useCallback(async (noteId) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    return updateNote(noteId, { pinned: !note.pinned })
  }, [notes, updateNote])

  const toggleArchive = useCallback(async (noteId) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    return updateNote(noteId, { archived: !note.archived })
  }, [notes, updateNote])

  const changeColor = useCallback(async (noteId, color) => {
    return updateNote(noteId, { color })
  }, [updateNote])

  // Label operations
  const createLabel = useCallback(async (name) => {
    try {
      let newLabel
      if (isOnline) {
        newLabel = await labelsService.createLabel(userId, name)
      } else {
        newLabel = await offlineService.labels.create(userId, name)
      }

      setLabels(prev => [...prev, newLabel])
      
      addToast('Label created successfully', {
        appearance: 'success',
        autoDismiss: true,
      })

      return newLabel
    } catch (error) {
      console.error('Failed to create label:', error)
      addToast('Failed to create label', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const updateLabel = useCallback(async (labelId, name) => {
    try {
      let updatedLabel
      if (isOnline) {
        updatedLabel = await labelsService.updateLabel(labelId, userId, name)
      } else {
        updatedLabel = await offlineService.labels.update(labelId, userId, name)
      }

      setLabels(prev => prev.map(label => 
        label.id === labelId ? { ...label, name } : label
      ))

      return updatedLabel
    } catch (error) {
      console.error('Failed to update label:', error)
      addToast('Failed to update label', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const deleteLabel = useCallback(async (labelId) => {
    try {
      if (isOnline) {
        await labelsService.deleteLabel(labelId, userId)
      } else {
        await offlineService.labels.delete(labelId, userId)
      }

      setLabels(prev => prev.filter(label => label.id !== labelId))
      
      addToast('Label deleted successfully', {
        appearance: 'success',
        autoDismiss: true,
      })
    } catch (error) {
      console.error('Failed to delete label:', error)
      addToast('Failed to delete label', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [userId, isOnline, offlineService, addToast])

  const addLabelToNote = useCallback(async (noteId, labelId) => {
    try {
      if (isOnline) {
        await labelsService.addLabelToNote(noteId, labelId)
      } else {
        await offlineService.labels.addToNote(noteId, labelId)
      }

      // Update local state
      setNotes(prev => prev.map(note => {
        if (note.id === noteId) {
          const label = labels.find(l => l.id === labelId)
          const currentLabels = note.labels || []
          if (label && !currentLabels.find(l => l.id === labelId)) {
            return { ...note, labels: [...currentLabels, label] }
          }
        }
        return note
      }))
    } catch (error) {
      console.error('Failed to add label to note:', error)
      addToast('Failed to add label', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [isOnline, offlineService, labelsService, labels, addToast])

  const removeLabelFromNote = useCallback(async (noteId, labelId) => {
    try {
      if (isOnline) {
        await labelsService.removeLabelFromNote(noteId, labelId)
      } else {
        await offlineService.labels.removeFromNote(noteId, labelId)
      }

      // Update local state
      setNotes(prev => prev.map(note => {
        if (note.id === noteId) {
          const currentLabels = note.labels || []
          return { ...note, labels: currentLabels.filter(l => l.id !== labelId) }
        }
        return note
      }))
    } catch (error) {
      console.error('Failed to remove label from note:', error)
      addToast('Failed to remove label', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [isOnline, offlineService, labelsService, addToast])

  // Search operations
  const searchNotes = useCallback(async (query) => {
    try {
      if (isOnline && aiService.isPineconeAvailable()) {
        // Use semantic search when available
        const semanticResults = await aiService.searchNotesSemantic(query, userId)
        if (semanticResults.length > 0) {
          return semanticResults
        }
      }

      // Fallback to text search
      if (isOnline) {
        return await notesService.searchNotes(userId, query)
      } else {
        return await offlineService.notes.search(userId, query)
      }
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  }, [userId, isOnline, offlineService])

  // Trash operations
  const getTrashedNotes = useCallback(async () => {
    try {
      if (isOnline) {
        return await notesService.getTrashedNotes(userId)
      } else {
        return await offlineService.notes.getTrashed(userId)
      }
    } catch (error) {
      console.error('Failed to load trashed notes:', error)
      return []
    }
  }, [userId, isOnline, offlineService])

  // Bulk operations
  const bulkDelete = useCallback(async (noteIds, permanent = false) => {
    const operations = noteIds.map(id => deleteNote(id, permanent))
    await Promise.allSettled(operations)
  }, [deleteNote])

  const bulkArchive = useCallback(async (noteIds, archived = true) => {
    const operations = noteIds.map(id => updateNote(id, { archived }))
    await Promise.allSettled(operations)
  }, [updateNote])

  const bulkChangeColor = useCallback(async (noteIds, color) => {
    const operations = noteIds.map(id => updateNote(id, { color }))
    await Promise.allSettled(operations)
  }, [updateNote])

  const value = {
    // State
    notes: filteredNotes,
    allNotes: notes,
    labels,
    loading,
    viewMode,
    searchQuery,
    selectedColor,
    selectedLabel,
    showArchived,

    // Actions
    setViewMode,
    setSearchQuery,
    setSelectedColor,
    setSelectedLabel,
    setShowArchived,
    loadData,

    // Note operations
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    togglePin,
    toggleArchive,
    changeColor,

    // Label operations
    createLabel,
    updateLabel,
    deleteLabel,
    addLabelToNote,
    removeLabelFromNote,

    // Search
    searchNotes,

    // Trash
    getTrashedNotes,

    // Bulk operations
    bulkDelete,
    bulkArchive,
    bulkChangeColor,

    // Helpers
    getNoteById: (id) => notes.find(note => note.id === id),
    getLabelById: (id) => labels.find(label => label.id === id),
    getNotesCount: () => notes.length,
    getPinnedNotesCount: () => notes.filter(note => note.pinned).length,
    getArchivedNotesCount: () => notes.filter(note => note.archived).length,
  }

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  )
}

export default NotesContext