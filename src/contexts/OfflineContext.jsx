import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useToasts } from 'react-toast-notifications'
import { useAuth } from './AuthContext'
import offlineService from '../services/offline'
import { notesService, labelsService } from '../services/supabase'

const OfflineContext = createContext({})

export const useOffline = () => {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [lastSync, setLastSync] = useState(null)
  const [syncStats, setSyncStats] = useState({ notes: 0, labels: 0, syncQueue: 0 })
  
  const { userId, isAuthenticated } = useAuth()
  const { addToast } = useToasts()

  // Initialize offline database
  useEffect(() => {
    const initOfflineDB = async () => {
      try {
        await offlineService.initialize()
        const stats = await offlineService.getStats()
        setSyncStats(stats)
      } catch (error) {
        console.error('Failed to initialize offline database:', error)
      }
    }

    initOfflineDB()
  }, [])

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      addToast('Back online! Syncing your changes...', {
        appearance: 'success',
        autoDismiss: true,
      })
      
      // Trigger sync when coming back online
      if (isAuthenticated && userId) {
        syncWithServer()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      addToast('You are now offline. Changes will be saved locally.', {
        appearance: 'warning',
        autoDismiss: false,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isAuthenticated, userId, addToast])

  // Periodic sync when online
  useEffect(() => {
    if (!isOnline || !isAuthenticated || !userId) return

    const syncInterval = setInterval(() => {
      syncWithServer(true) // Silent sync
    }, 30000) // Sync every 30 seconds

    return () => clearInterval(syncInterval)
  }, [isOnline, isAuthenticated, userId])

  // Main sync function
  const syncWithServer = useCallback(async (silent = false) => {
    if (!isOnline || !isAuthenticated || !userId || isSyncing) return

    setIsSyncing(true)
    
    try {
      const syncQueue = await offlineService.getSyncQueue()
      setSyncProgress({ current: 0, total: syncQueue.length })

      if (!silent && syncQueue.length > 0) {
        addToast(`Syncing ${syncQueue.length} changes...`, {
          appearance: 'info',
          autoDismiss: true,
        })
      }

      // Process sync queue
      for (let i = 0; i < syncQueue.length; i++) {
        const item = syncQueue[i]
        setSyncProgress({ current: i + 1, total: syncQueue.length })

        try {
          await processSyncQueueItem(item)
          await offlineService.removeSyncQueueItem(item.id)
        } catch (error) {
          console.error('Sync item failed:', error)
          await offlineService.incrementSyncRetries(item.id)
          
          // Remove items that have failed too many times
          if ((item.retries || 0) >= 3) {
            await offlineService.removeSyncQueueItem(item.id)
            if (!silent) {
              addToast(`Failed to sync ${item.table_name} after 3 attempts`, {
                appearance: 'error',
                autoDismiss: true,
              })
            }
          }
        }
      }

      // Update sync stats
      const stats = await offlineService.getStats()
      setSyncStats(stats)
      setLastSync(new Date().toISOString())

      if (!silent && syncQueue.length > 0) {
        addToast('Sync completed successfully!', {
          appearance: 'success',
          autoDismiss: true,
        })
      }

    } catch (error) {
      console.error('Sync failed:', error)
      if (!silent) {
        addToast('Sync failed. Will retry automatically.', {
          appearance: 'error',
          autoDismiss: true,
        })
      }
    } finally {
      setIsSyncing(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }, [isOnline, isAuthenticated, userId, isSyncing, addToast])

  // Process individual sync queue item
  const processSyncQueueItem = async (item) => {
    const { table_name, record_id, operation, data } = item

    switch (table_name) {
      case 'notes':
        await syncNote(record_id, operation, data)
        break
      case 'labels':
        await syncLabel(record_id, operation, data)
        break
      case 'note_labels':
        await syncNoteLabel(record_id, operation, data)
        break
      default:
        console.warn('Unknown table for sync:', table_name)
    }
  }

  // Sync individual note
  const syncNote = async (recordId, operation, data) => {
    switch (operation) {
      case 'create':
        const createdNote = await notesService.createNote(userId, data)
        await offlineService.notes.markSynced(recordId)
        return createdNote

      case 'update':
        const updatedNote = await notesService.updateNote(recordId, userId, data)
        await offlineService.notes.markSynced(recordId)
        return updatedNote

      case 'delete':
        if (data.permanent) {
          await notesService.deleteNote(recordId, userId)
        } else {
          await notesService.moveToTrash(recordId, userId)
        }
        return true

      default:
        throw new Error(`Unknown note operation: ${operation}`)
    }
  }

  // Sync individual label
  const syncLabel = async (recordId, operation, data) => {
    switch (operation) {
      case 'create':
        const createdLabel = await labelsService.createLabel(userId, data.name)
        await offlineService.labels.markSynced(recordId)
        return createdLabel

      case 'update':
        const updatedLabel = await labelsService.updateLabel(recordId, userId, data.name)
        await offlineService.labels.markSynced(recordId)
        return updatedLabel

      case 'delete':
        await labelsService.deleteLabel(recordId, userId)
        return true

      default:
        throw new Error(`Unknown label operation: ${operation}`)
    }
  }

  // Sync note-label association
  const syncNoteLabel = async (recordId, operation, data) => {
    switch (operation) {
      case 'create':
        return labelsService.addLabelToNote(data.note_id, data.label_id)

      case 'delete':
        return labelsService.removeLabelFromNote(data.note_id, data.label_id)

      default:
        throw new Error(`Unknown note_label operation: ${operation}`)
    }
  }

  // Cleanup old data
  const cleanup = useCallback(async () => {
    try {
      await offlineService.cleanup()
      const stats = await offlineService.getStats()
      setSyncStats(stats)
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }, [])

  // Export data
  const exportData = useCallback(async () => {
    if (!userId) return null
    return offlineService.exportData(userId)
  }, [userId])

  // Import data
  const importData = useCallback(async (exportData) => {
    try {
      await offlineService.importData(exportData)
      const stats = await offlineService.getStats()
      setSyncStats(stats)
      addToast('Data imported successfully!', {
        appearance: 'success',
        autoDismiss: true,
      })
    } catch (error) {
      console.error('Import failed:', error)
      addToast('Failed to import data', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [addToast])

  const value = {
    isOnline,
    isSyncing,
    syncProgress,
    lastSync,
    syncStats,
    
    // Methods
    syncWithServer,
    cleanup,
    exportData,
    importData,
    
    // Storage quota
    getStorageQuota: offlineService.checkStorageQuota,
    
    // Offline service access
    offlineService,
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

export default OfflineContext