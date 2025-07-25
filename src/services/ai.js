import { GoogleGenerativeAI } from '@google/generative-ai'
import { Pinecone } from '@pinecone-database/pinecone'
import config from '../config'

// Initialize Gemini AI
let genAI = null
if (config.ai.gemini.apiKey) {
  genAI = new GoogleGenerativeAI(config.ai.gemini.apiKey)
}

// Initialize Pinecone
let pinecone = null
let pineconeIndex = null

if (config.ai.pinecone.apiKey) {
  pinecone = new Pinecone({
    apiKey: config.ai.pinecone.apiKey,
    environment: config.ai.pinecone.environment,
  })
  
  try {
    pineconeIndex = pinecone.Index(config.ai.pinecone.indexName)
  } catch (error) {
    console.warn('Pinecone index not found, semantic search disabled')
  }
}

// Generate embeddings for text using a simple approach
// In production, you'd want to use a proper embedding model
const generateEmbedding = async (text) => {
  if (!text || text.length === 0) return new Array(1536).fill(0)
  
  // Simple character-based embedding for demo
  // In production, use OpenAI embeddings or similar
  const embedding = new Array(1536).fill(0)
  for (let i = 0; i < Math.min(text.length, 1536); i++) {
    embedding[i] = text.charCodeAt(i) / 1000
  }
  return embedding
}

export const aiService = {
  // Check if AI services are available
  isAvailable() {
    return !!genAI
  },

  isPineconeAvailable() {
    return !!pineconeIndex
  },

  // Generate AI response
  async generateResponse(prompt, context = []) {
    if (!genAI) throw new Error('Gemini AI not configured')

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      // Build context from notes
      let contextText = ''
      if (context.length > 0) {
        contextText = '\n\nRelevant notes:\n' + 
          context.map((note, i) => `${i + 1}. ${note.title}: ${note.content}`).join('\n')
      }

      const fullPrompt = `You are an AI assistant helping with note management. 
      Be helpful, concise, and accurate. If the user asks about their notes, 
      use the provided context to answer.${contextText}\n\nUser: ${prompt}`

      const result = await model.generateContent(fullPrompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('AI generation error:', error)
      throw new Error('Failed to generate AI response')
    }
  },

  // Store note embedding in Pinecone
  async storeNoteEmbedding(note) {
    if (!pineconeIndex) return false

    try {
      const text = `${note.title} ${note.content}`.trim()
      if (!text) return false

      const embedding = await generateEmbedding(text)
      
      await pineconeIndex.upsert([{
        id: note.id,
        values: embedding,
        metadata: {
          userId: note.user_id,
          title: note.title,
          content: note.content.substring(0, 500), // Limit metadata size
          type: note.type,
          color: note.color,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
        }
      }])

      return true
    } catch (error) {
      console.error('Error storing embedding:', error)
      return false
    }
  },

  // Search notes using semantic similarity
  async searchNotesSemantic(query, userId, limit = 10) {
    if (!pineconeIndex) return []

    try {
      const queryEmbedding = await generateEmbedding(query)
      
      const searchResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: limit,
        filter: { userId },
        includeMetadata: true,
      })

      return searchResults.matches.map(match => ({
        ...match.metadata,
        score: match.score,
      }))
    } catch (error) {
      console.error('Semantic search error:', error)
      return []
    }
  },

  // Delete note embedding
  async deleteNoteEmbedding(noteId) {
    if (!pineconeIndex) return false

    try {
      await pineconeIndex.deleteOne(noteId)
      return true
    } catch (error) {
      console.error('Error deleting embedding:', error)
      return false
    }
  },

  // Generate note summary
  async summarizeNotes(notes) {
    if (!genAI || !notes.length) return ''

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      const notesText = notes.map(note => 
        `Title: ${note.title}\nContent: ${note.content}`
      ).join('\n\n---\n\n')

      const prompt = `Please provide a concise summary of these notes:\n\n${notesText}`
      
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Summarization error:', error)
      return 'Unable to generate summary'
    }
  },

  // Extract key information from notes
  async extractKeyInfo(notes, query) {
    if (!genAI || !notes.length) return ''

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      const notesText = notes.map(note => 
        `Title: ${note.title}\nContent: ${note.content}`
      ).join('\n\n---\n\n')

      const prompt = `Based on these notes, ${query}:\n\n${notesText}`
      
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Information extraction error:', error)
      return 'Unable to extract information'
    }
  },

  // Suggest note organization
  async suggestOrganization(notes) {
    if (!genAI || !notes.length) return []

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      const notesText = notes.map(note => 
        `${note.title}: ${note.content.substring(0, 100)}...`
      ).join('\n')

      const prompt = `Analyze these notes and suggest labels or categories to organize them better. 
      Return only a JSON array of suggested label names:\n\n${notesText}`
      
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      try {
        const suggestions = JSON.parse(text)
        return Array.isArray(suggestions) ? suggestions : []
      } catch {
        // If JSON parsing fails, extract labels from text
        const matches = text.match(/"([^"]+)"/g)
        return matches ? matches.map(m => m.replace(/"/g, '')) : []
      }
    } catch (error) {
      console.error('Organization suggestion error:', error)
      return []
    }
  },

  // Generate note content suggestions
  async suggestContent(partialContent, noteType = 'text') {
    if (!genAI || !partialContent) return []

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      let prompt = ''
      switch (noteType) {
        case 'list':
          prompt = `Continue this checklist with relevant items:\n${partialContent}`
          break
        case 'text':
        default:
          prompt = `Suggest a few ways to continue or expand this note:\n${partialContent}`
      }
      
      const result = await model.generateContent(prompt)
      const response = await result.response
      const suggestions = response.text().split('\n').filter(s => s.trim())
      return suggestions.slice(0, 3) // Return top 3 suggestions
    } catch (error) {
      console.error('Content suggestion error:', error)
      return []
    }
  },

  // Chat-based note operations
  async processNoteCommand(command, notes, userId) {
    if (!genAI) throw new Error('AI not configured')

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      const notesContext = notes.slice(0, 5).map(note => 
        `ID: ${note.id}, Title: ${note.title}, Content: ${note.content.substring(0, 200)}`
      ).join('\n')

      const prompt = `You are an AI assistant that can help manage notes. 
      Analyze this command and determine what action to take.
      
      Available actions: CREATE_NOTE, UPDATE_NOTE, DELETE_NOTE, SEARCH_NOTES, SUMMARIZE, NONE
      
      Current notes (showing first 5):
      ${notesContext}
      
      User command: "${command}"
      
      Respond with JSON in this format:
      {
        "action": "ACTION_TYPE",
        "parameters": {
          "title": "note title",
          "content": "note content", 
          "noteId": "id if updating/deleting",
          "query": "search query if searching"
        },
        "response": "Natural language response to user"
      }`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      try {
        return JSON.parse(text)
      } catch {
        // Fallback if JSON parsing fails
        return {
          action: 'NONE',
          parameters: {},
          response: text
        }
      }
    } catch (error) {
      console.error('Note command processing error:', error)
      throw new Error('Failed to process command')
    }
  },
}

export default aiService