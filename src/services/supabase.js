import { createClient } from '@supabase/supabase-js'
import config from '../config'

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
)

// Database schema
export const initializeDatabase = async () => {
  // Notes table
  const { error: notesError } = await supabase.rpc('create_notes_table', {})
  if (notesError && !notesError.message.includes('already exists')) {
    console.error('Error creating notes table:', notesError)
  }

  // Labels table
  const { error: labelsError } = await supabase.rpc('create_labels_table', {})
  if (labelsError && !labelsError.message.includes('already exists')) {
    console.error('Error creating labels table:', labelsError)
  }

  // Note labels junction table
  const { error: junctionError } = await supabase.rpc('create_note_labels_table', {})
  if (junctionError && !junctionError.message.includes('already exists')) {
    console.error('Error creating note_labels table:', junctionError)
  }
}

// Notes CRUD operations
export const notesService = {
  // Get all notes for user
  async getNotes(userId, filters = {}) {
    let query = supabase
      .from('notes')
      .select(`
        *,
        note_labels!inner(
          labels(*)
        )
      `)
      .eq('user_id', userId)
      .eq('deleted', false)

    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived)
    }

    if (filters.labelId) {
      query = query.eq('note_labels.label_id', filters.labelId)
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%, content.ilike.%${filters.search}%`)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get notes from trash
  async getTrashedNotes(userId) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('deleted', true)
      .order('deleted_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Create new note
  async createNote(userId, noteData) {
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

    const { data, error } = await supabase
      .from('notes')
      .insert([note])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update note
  async updateNote(noteId, userId, updates) {
    const { data, error } = await supabase
      .from('notes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Move note to trash
  async moveToTrash(noteId, userId) {
    const { data, error } = await supabase
      .from('notes')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Restore note from trash
  async restoreNote(noteId, userId) {
    const { data, error } = await supabase
      .from('notes')
      .update({
        deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Permanently delete note
  async deleteNote(noteId, userId) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  },

  // Archive/unarchive note
  async toggleArchive(noteId, userId, archived) {
    return this.updateNote(noteId, userId, { archived })
  },

  // Pin/unpin note
  async togglePin(noteId, userId, pinned) {
    return this.updateNote(noteId, userId, { pinned })
  },

  // Search notes with full-text search
  async searchNotes(userId, query) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('deleted', false)
      .or(`title.ilike.%${query}%, content.ilike.%${query}%`)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  },
}

// Labels CRUD operations
export const labelsService = {
  // Get all labels for user
  async getLabels(userId) {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data || []
  },

  // Create new label
  async createLabel(userId, name) {
    const { data, error } = await supabase
      .from('labels')
      .insert([{
        user_id: userId,
        name,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update label
  async updateLabel(labelId, userId, name) {
    const { data, error } = await supabase
      .from('labels')
      .update({ name })
      .eq('id', labelId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete label
  async deleteLabel(labelId, userId) {
    // First remove all associations
    await supabase
      .from('note_labels')
      .delete()
      .eq('label_id', labelId)

    // Then delete the label
    const { error } = await supabase
      .from('labels')
      .delete()
      .eq('id', labelId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  },

  // Add label to note
  async addLabelToNote(noteId, labelId) {
    const { data, error } = await supabase
      .from('note_labels')
      .insert([{ note_id: noteId, label_id: labelId }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Remove label from note
  async removeLabelFromNote(noteId, labelId) {
    const { error } = await supabase
      .from('note_labels')
      .delete()
      .eq('note_id', noteId)
      .eq('label_id', labelId)

    if (error) throw error
    return true
  },
}

// File storage operations
export const storageService = {
  // Upload image
  async uploadImage(file, userId) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('note-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('note-images')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  },

  // Delete image
  async deleteImage(fileName) {
    const { error } = await supabase.storage
      .from('note-images')
      .remove([fileName])

    if (error) throw error
    return true
  },
}

export default supabase