import React, { createContext, useContext, useState, useCallback } from 'react'
import { useToasts } from 'react-toast-notifications'
import { useAuth } from './AuthContext'
import { useNotes } from './NotesContext'
import aiService from '../services/ai'
import transcriptionService from '../services/deepgram'
import { v4 as uuidv4 } from 'uuid'

const AIContext = createContext({})

export const useAI = () => {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}

export const AIProvider = ({ children }) => {
  const [isAIAvailable, setIsAIAvailable] = useState(aiService.isAvailable())
  const [isTranscriptionAvailable, setIsTranscriptionAvailable] = useState(transcriptionService.isAvailable())
  const [chatMessages, setChatMessages] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [chatVisible, setChatVisible] = useState(false)
  const [currentConversation, setCurrentConversation] = useState(null)
  
  const { userId } = useAuth()
  const { 
    allNotes, 
    createNote, 
    updateNote, 
    deleteNote, 
    searchNotes,
    labels,
    createLabel 
  } = useNotes()
  const { addToast } = useToasts()

  // Initialize conversation
  const startConversation = useCallback(() => {
    const conversationId = uuidv4()
    setCurrentConversation(conversationId)
    setChatMessages([{
      id: uuidv4(),
      type: 'assistant',
      content: 'Hi! I\'m your AI assistant. I can help you with your notes. Try asking me things like:\n\n• "Show me my shopping lists"\n• "Summarize my notes from this week"\n• "Create a note about my meeting tomorrow"\n• "What were my thoughts on the project?"',
      timestamp: new Date().toISOString(),
      conversationId,
    }])
    setChatVisible(true)
  }, [])

  // Add message to chat
  const addMessage = useCallback((type, content, metadata = {}) => {
    const message = {
      id: uuidv4(),
      type, // 'user' or 'assistant'
      content,
      timestamp: new Date().toISOString(),
      conversationId: currentConversation,
      metadata,
    }
    
    setChatMessages(prev => [...prev, message])
    return message
  }, [currentConversation])

  // Send message to AI
  const sendMessage = useCallback(async (message, includeContext = true) => {
    if (!isAIAvailable) {
      addToast('AI features are not configured', {
        appearance: 'warning',
        autoDismiss: true,
      })
      return
    }

    if (!currentConversation) {
      startConversation()
    }

    // Add user message
    addMessage('user', message)
    setIsProcessing(true)

    try {
      // Get relevant notes for context
      let context = []
      if (includeContext) {
        // Use semantic search if available, otherwise use simple search
        const searchResults = await searchNotes(message)
        context = searchResults.slice(0, 5) // Limit context to 5 most relevant notes
      }

      // Generate AI response
      const response = await aiService.generateResponse(message, context)
      
      // Add AI response
      addMessage('assistant', response, { 
        contextNotes: context.length,
        hasContext: context.length > 0 
      })

    } catch (error) {
      console.error('AI response failed:', error)
      addMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.')
      addToast('Failed to get AI response', {
        appearance: 'error',
        autoDismiss: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isAIAvailable, currentConversation, startConversation, addMessage, searchNotes, addToast])

  // Process note command through AI
  const processNoteCommand = useCallback(async (command) => {
    if (!isAIAvailable) {
      addToast('AI features are not configured', {
        appearance: 'warning',
        autoDismiss: true,
      })
      return
    }

    setIsProcessing(true)

    try {
      const result = await aiService.processNoteCommand(command, allNotes, userId)
      const { action, parameters, response } = result

      // Execute the action
      switch (action) {
        case 'CREATE_NOTE':
          if (parameters.title || parameters.content) {
            const newNote = await createNote({
              title: parameters.title || '',
              content: parameters.content || '',
              type: parameters.type || 'text',
            })
            addMessage('assistant', `${response}\n\nNote created: "${newNote.title || 'Untitled'}"`)
          } else {
            addMessage('assistant', response)
          }
          break

        case 'UPDATE_NOTE':
          if (parameters.noteId && (parameters.title || parameters.content)) {
            await updateNote(parameters.noteId, {
              title: parameters.title,
              content: parameters.content,
            })
            addMessage('assistant', `${response}\n\nNote updated successfully.`)
          } else {
            addMessage('assistant', response)
          }
          break

        case 'DELETE_NOTE':
          if (parameters.noteId) {
            await deleteNote(parameters.noteId)
            addMessage('assistant', `${response}\n\nNote moved to trash.`)
          } else {
            addMessage('assistant', response)
          }
          break

        case 'SEARCH_NOTES':
          if (parameters.query) {
            const results = await searchNotes(parameters.query)
            const summary = results.length > 0 
              ? `Found ${results.length} notes:\n${results.slice(0, 3).map(note => `• ${note.title || 'Untitled'}`).join('\n')}`
              : 'No notes found matching your search.'
            addMessage('assistant', `${response}\n\n${summary}`)
          } else {
            addMessage('assistant', response)
          }
          break

        case 'SUMMARIZE':
          const summary = await aiService.summarizeNotes(allNotes.slice(0, 10))
          addMessage('assistant', `${response}\n\n${summary}`)
          break

        default:
          addMessage('assistant', response)
      }

    } catch (error) {
      console.error('Note command processing failed:', error)
      addMessage('assistant', 'Sorry, I couldn\'t process that command. Please try rephrasing your request.')
      addToast('Failed to process command', {
        appearance: 'error',
        autoDismiss: true,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isAIAvailable, allNotes, userId, createNote, updateNote, deleteNote, searchNotes, addMessage, addToast])

  // Transcribe audio
  const transcribeAudio = useCallback(async (audioFile) => {
    if (!isTranscriptionAvailable) {
      addToast('Transcription service is not configured', {
        appearance: 'warning',
        autoDismiss: true,
      })
      return null
    }

    setIsTranscribing(true)

    try {
      // Validate audio file
      transcriptionService.validateAudioFile(audioFile)

      // Transcribe the audio
      const result = await transcriptionService.transcribeFile(audioFile)
      const formatted = transcriptionService.formatTranscription(result)

      addToast(`Audio transcribed successfully (${formatted.confidence}% confidence)`, {
        appearance: 'success',
        autoDismiss: true,
      })

      return {
        transcript: formatted.text,
        confidence: formatted.confidence,
        duration: formatted.duration,
        wordCount: formatted.wordCount,
        metadata: result.metadata,
        timestamps: formatted.timestamps,
      }

    } catch (error) {
      console.error('Transcription failed:', error)
      addToast(`Transcription failed: ${error.message}`, {
        appearance: 'error',
        autoDismiss: true,
      })
      return null
    } finally {
      setIsTranscribing(false)
    }
  }, [isTranscriptionAvailable, addToast])

  // Create note from transcription
  const createNoteFromTranscription = useCallback(async (transcriptionResult, title = '') => {
    try {
      const noteData = {
        title: title || 'Voice Note',
        content: transcriptionResult.transcript,
        type: 'voice',
        metadata: {
          transcription: {
            confidence: transcriptionResult.confidence,
            duration: transcriptionResult.duration,
            wordCount: transcriptionResult.wordCount,
            service: 'deepgram',
            model: transcriptionResult.metadata.model,
            language: transcriptionResult.metadata.language,
          },
          voice: {
            originalFile: true,
            transcribedAt: new Date().toISOString(),
          }
        }
      }

      const newNote = await createNote(noteData)
      
      addToast('Voice note created successfully', {
        appearance: 'success',
        autoDismiss: true,
      })

      return newNote

    } catch (error) {
      console.error('Failed to create voice note:', error)
      addToast('Failed to create voice note', {
        appearance: 'error',
        autoDismiss: true,
      })
      throw error
    }
  }, [createNote, addToast])

  // Get AI suggestions for note organization
  const getSuggestions = useCallback(async (type = 'organization') => {
    if (!isAIAvailable) return []

    try {
      switch (type) {
        case 'organization':
          return await aiService.suggestOrganization(allNotes.slice(0, 20))
        
        case 'labels':
          const labelSuggestions = await aiService.suggestOrganization(allNotes.slice(0, 20))
          return labelSuggestions.filter(suggestion => 
            !labels.find(label => label.name.toLowerCase() === suggestion.toLowerCase())
          )
        
        default:
          return []
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      return []
    }
  }, [isAIAvailable, allNotes, labels])

  // Smart content suggestions
  const getContentSuggestions = useCallback(async (partialContent, noteType = 'text') => {
    if (!isAIAvailable || !partialContent?.trim()) return []

    try {
      return await aiService.suggestContent(partialContent, noteType)
    } catch (error) {
      console.error('Failed to get content suggestions:', error)
      return []
    }
  }, [isAIAvailable])

  // Extract information from notes
  const extractInformation = useCallback(async (query) => {
    if (!isAIAvailable) {
      addToast('AI features are not configured', {
        appearance: 'warning',
        autoDismiss: true,
      })
      return ''
    }

    try {
      // Get relevant notes
      const relevantNotes = await searchNotes(query)
      
      if (relevantNotes.length === 0) {
        return 'No relevant notes found for your query.'
      }

      return await aiService.extractKeyInfo(relevantNotes.slice(0, 10), query)
    } catch (error) {
      console.error('Information extraction failed:', error)
      addToast('Failed to extract information', {
        appearance: 'error',
        autoDismiss: true,
      })
      return 'Sorry, I couldn\'t extract the requested information.'
    }
  }, [isAIAvailable, searchNotes, addToast])

  // Clear chat
  const clearChat = useCallback(() => {
    setChatMessages([])
    setCurrentConversation(null)
  }, [])

  // Toggle chat visibility
  const toggleChat = useCallback(() => {
    if (!chatVisible && !currentConversation) {
      startConversation()
    } else {
      setChatVisible(!chatVisible)
    }
  }, [chatVisible, currentConversation, startConversation])

  const value = {
    // State
    isAIAvailable,
    isTranscriptionAvailable,
    chatMessages,
    isProcessing,
    isTranscribing,
    chatVisible,
    currentConversation,

    // Chat operations
    startConversation,
    sendMessage,
    addMessage,
    clearChat,
    toggleChat,
    setChatVisible,

    // AI note operations
    processNoteCommand,
    extractInformation,
    getSuggestions,
    getContentSuggestions,

    // Transcription
    transcribeAudio,
    createNoteFromTranscription,
    getSupportedLanguages: transcriptionService.getSupportedLanguages,

    // Service availability
    checkAIAvailability: () => aiService.isAvailable(),
    checkTranscriptionAvailability: () => transcriptionService.isAvailable(),
    checkSemanticSearchAvailability: () => aiService.isPineconeAvailable(),

    // AI service access (for advanced usage)
    aiService,
    transcriptionService,
  }

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  )
}

export default AIContext