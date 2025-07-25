import Dexie from 'dexie'
import config from '../config'

// Define the database schema
class OfflineDatabase extends Dexie {
  constructor() {
    super('AIKeepOfflineDB')
    
    this.version(1).stores({
      notes: '++id, user_id, title, content, type, color, pinned, archived, deleted, created_at, updated_at, deleted_at, sync_status, last_modified',
      labels: '++id, user_id, name, created_at, sync_status',
      note_labels: '++id, note_id, label_id, sync_status',
      sync_queue: '++id, table_name, record_id, operation, data, created_at, retries',
      user_preferences: '++id, user_id, key, value',
      cached_ai_responses: '++id, query_hash, response, created_at, expires_at',
    })

    // Hooks for automatic sync status tracking
    this.notes.hook('creating', (primKey, obj, trans) => {
      obj.sync_status = 'pending'
      obj.last_modified = new Date().toISOString()
    })

    this.notes.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.sync_status = 'pending'
      modifications.last_modified = new Date().toISOString()
    })

    this.labels.hook('creating', (primKey, obj, trans) => {
      obj.sync_status = 'pending'
    })

    this.labels.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.sync_status = 'pending'
    })
  }
}

const db = new OfflineDatabase()

export const offlineService = {
  // Initialize the database
  async initialize() {
    try {
      await db.open()
      console.log('Offline database initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize offline database:', error)
      return false
    }
  },

  // Check storage quota
  async checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0,
        percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0,
      }
    }
    return { used: 0, available: 0, percentage: 0 }
  },

  // Notes operations
  notes: {
    async getAll(userId, filters = {}) {
      let collection = db.notes.where('user_id').equals(userId).and(note => !note.deleted)

      if (filters.archived !== undefined) {
        collection = collection.and(note => note.archived === filters.archived)
      }

      if (filters.labelId) {
        const noteIds = await db.note_labels.where('label_id').equals(filters.labelId).toArray()
        const noteIdSet = new Set(noteIds.map(nl => nl.note_id))
        collection = collection.and(note => noteIdSet.has(note.id))
      }

      return collection.reverse().sortBy('updated_at')
    },

    async getTrashed(userId) {
      return db.notes
        .where('user_id').equals(userId)
        .and(note => note.deleted)
        .reverse()
        .sortBy('deleted_at')
    },

    async create(userId, noteData) {
      const note = {
        user_id: userId,
        title: noteData.title || '',
        content: noteData.content || '',
        type: noteData.type || 'text',
        color: noteData.color || 'default',
        pinned: noteData.pinned || false,
        archived: false,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: noteData.metadata || {},
      }

      const id = await db.notes.add(note)
      
      // Add to sync queue
      await this.addToSyncQueue('notes', id, 'create', note)
      
      return { ...note, id }
    },

    async update(noteId, userId, updates) {
      const updated = {
        ...updates,
        updated_at: new Date().toISOString(),
      }

      await db.notes.where('id').equals(noteId).and(note => note.user_id === userId).modify(updated)
      
      // Add to sync queue
      await this.addToSyncQueue('notes', noteId, 'update', updated)
      
      return db.notes.get(noteId)
    },

    async delete(noteId, userId, permanent = false) {
      if (permanent) {
        await db.notes.where('id').equals(noteId).and(note => note.user_id === userId).delete()
        await this.addToSyncQueue('notes', noteId, 'delete', { permanent: true })
      } else {
        const updates = {
          deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        await db.notes.where('id').equals(noteId).and(note => note.user_id === userId).modify(updates)
        await this.addToSyncQueue('notes', noteId, 'update', updates)
      }

      return true
    },

    async restore(noteId, userId) {
      const updates = {
        deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }

      await db.notes.where('id').equals(noteId).and(note => note.user_id === userId).modify(updates)
      await this.addToSyncQueue('notes', noteId, 'update', updates)
      
      return db.notes.get(noteId)
    },

    async search(userId, query) {
      const searchTerm = query.toLowerCase()
      return db.notes
        .where('user_id').equals(userId)
        .and(note => !note.deleted)
        .filter(note => 
          note.title.toLowerCase().includes(searchTerm) ||
          note.content.toLowerCase().includes(searchTerm)
        )
        .reverse()
        .sortBy('updated_at')
    },

    async markSynced(noteId) {
      await db.notes.where('id').equals(noteId).modify({ sync_status: 'synced' })
    },

    async getPendingSync(userId) {
      return db.notes
        .where('user_id').equals(userId)
        .and(note => note.sync_status === 'pending')
        .toArray()
    },
  },

  // Labels operations
  labels: {
    async getAll(userId) {
      return db.labels.where('user_id').equals(userId).sortBy('name')
    },

    async create(userId, name) {
      const label = {
        user_id: userId,
        name,
        created_at: new Date().toISOString(),
      }

      const id = await db.labels.add(label)
      await this.addToSyncQueue('labels', id, 'create', label)
      
      return { ...label, id }
    },

    async update(labelId, userId, name) {
      await db.labels.where('id').equals(labelId).and(label => label.user_id === userId).modify({ name })
      await this.addToSyncQueue('labels', labelId, 'update', { name })
      
      return db.labels.get(labelId)
    },

    async delete(labelId, userId) {
      // Remove all note-label associations
      await db.note_labels.where('label_id').equals(labelId).delete()
      
      // Delete the label
      await db.labels.where('id').equals(labelId).and(label => label.user_id === userId).delete()
      
      await this.addToSyncQueue('labels', labelId, 'delete', {})
      return true
    },

    async addToNote(noteId, labelId) {
      const association = { note_id: noteId, label_id: labelId }
      const id = await db.note_labels.add(association)
      await this.addToSyncQueue('note_labels', id, 'create', association)
      return association
    },

    async removeFromNote(noteId, labelId) {
      const association = await db.note_labels.where(['note_id', 'label_id']).equals([noteId, labelId]).first()
      if (association) {
        await db.note_labels.delete(association.id)
        await this.addToSyncQueue('note_labels', association.id, 'delete', {})
      }
      return true
    },

    async markSynced(labelId) {
      await db.labels.where('id').equals(labelId).modify({ sync_status: 'synced' })
    },

    async getPendingSync(userId) {
      return db.labels
        .where('user_id').equals(userId)
        .and(label => label.sync_status === 'pending')
        .toArray()
    },
  },

  // Sync queue operations
  async addToSyncQueue(tableName, recordId, operation, data) {
    return db.sync_queue.add({
      table_name: tableName,
      record_id: recordId,
      operation,
      data,
      created_at: new Date().toISOString(),
      retries: 0,
    })
  },

  async getSyncQueue() {
    return db.sync_queue.orderBy('created_at').toArray()
  },

  async removeSyncQueueItem(queueId) {
    return db.sync_queue.delete(queueId)
  },

  async incrementSyncRetries(queueId) {
    await db.sync_queue.where('id').equals(queueId).modify(item => {
      item.retries = (item.retries || 0) + 1
    })
  },

  async clearSyncQueue() {
    return db.sync_queue.clear()
  },

  // User preferences
  async setPreference(userId, key, value) {
    const existing = await db.user_preferences.where(['user_id', 'key']).equals([userId, key]).first()
    
    if (existing) {
      await db.user_preferences.update(existing.id, { value })
    } else {
      await db.user_preferences.add({ user_id: userId, key, value })
    }
  },

  async getPreference(userId, key, defaultValue = null) {
    const pref = await db.user_preferences.where(['user_id', 'key']).equals([userId, key]).first()
    return pref ? pref.value : defaultValue
  },

  async getAllPreferences(userId) {
    const prefs = await db.user_preferences.where('user_id').equals(userId).toArray()
    return prefs.reduce((acc, pref) => {
      acc[pref.key] = pref.value
      return acc
    }, {})
  },

  // AI response caching
  async cacheAIResponse(queryHash, response, ttlMinutes = 60) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
    
    await db.cached_ai_responses.put({
      query_hash: queryHash,
      response,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
  },

  async getCachedAIResponse(queryHash) {
    const cached = await db.cached_ai_responses.where('query_hash').equals(queryHash).first()
    
    if (!cached) return null
    
    // Check if expired
    if (new Date(cached.expires_at) < new Date()) {
      await db.cached_ai_responses.delete(cached.id)
      return null
    }
    
    return cached.response
  },

  async clearExpiredCache() {
    const now = new Date().toISOString()
    await db.cached_ai_responses.where('expires_at').below(now).delete()
  },

  // Database maintenance
  async cleanup() {
    const retentionDate = new Date(Date.now() - config.app.trashRetentionDays * 24 * 60 * 60 * 1000)
    
    // Delete old trashed notes
    await db.notes
      .where('deleted').equals(true)
      .and(note => note.deleted_at && new Date(note.deleted_at) < retentionDate)
      .delete()
    
    // Clear expired cache
    await this.clearExpiredCache()
    
    // Remove old sync queue items (older than 7 days)
    const oldSyncDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await db.sync_queue.where('created_at').below(oldSyncDate).delete()
  },

  // Export/Import data
  async exportData(userId) {
    const [notes, labels, noteLabels, preferences] = await Promise.all([
      db.notes.where('user_id').equals(userId).toArray(),
      db.labels.where('user_id').equals(userId).toArray(),
      db.note_labels.toArray(),
      db.user_preferences.where('user_id').equals(userId).toArray(),
    ])

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      userId,
      data: {
        notes,
        labels,
        noteLabels,
        preferences,
      },
    }
  },

  async importData(exportData) {
    const { data } = exportData
    
    // Import in transaction for consistency
    await db.transaction('rw', [db.notes, db.labels, db.note_labels, db.user_preferences], async () => {
      if (data.notes) await db.notes.bulkAdd(data.notes)
      if (data.labels) await db.labels.bulkAdd(data.labels)
      if (data.noteLabels) await db.note_labels.bulkAdd(data.noteLabels)
      if (data.preferences) await db.user_preferences.bulkAdd(data.preferences)
    })
  },

  // Clear all data
  async clearAllData() {
    await db.delete()
    await db.open()
  },

  // Get database statistics
  async getStats() {
    const [notesCount, labelsCount, syncQueueCount, cacheCount] = await Promise.all([
      db.notes.count(),
      db.labels.count(),
      db.sync_queue.count(),
      db.cached_ai_responses.count(),
    ])

    const quota = await this.checkStorageQuota()

    return {
      notes: notesCount,
      labels: labelsCount,
      syncQueue: syncQueueCount,
      cache: cacheCount,
      storage: quota,
    }
  },
}

export default offlineService