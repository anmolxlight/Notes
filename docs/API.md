# API Reference

This document describes the various APIs and services integrated into the AI-powered Google Keep clone.

## Table of Contents

1. [Authentication (Clerk)](#authentication-clerk)
2. [Database (Supabase)](#database-supabase)
3. [AI Services](#ai-services)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)

## Authentication (Clerk)

### Configuration

```javascript
import { ClerkProvider } from '@clerk/clerk-react'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
```

### User Management

```javascript
// Get current user
const { user, isLoaded, isSignedIn } = useUser()

// Sign out
const { signOut } = useAuth()
await signOut()

// User object structure
const user = {
  id: 'user_xxx',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  primaryEmailAddress: {
    emailAddress: 'john@example.com'
  },
  imageUrl: 'https://...',
  createdAt: Date,
  lastSignInAt: Date
}
```

## Database (Supabase)

### Configuration

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)
```

### Notes API

#### Get Notes

```javascript
// Get all notes for user
const { data, error } = await supabase
  .from('notes')
  .select(`
    *,
    note_labels!inner(
      labels(*)
    )
  `)
  .eq('user_id', userId)
  .eq('deleted', false)
  .order('updated_at', { ascending: false })
```

#### Create Note

```javascript
const note = {
  user_id: userId,
  title: 'My Note',
  content: 'Note content...',
  type: 'text', // 'text', 'list', 'image', 'voice'
  color: 'default',
  pinned: false,
  archived: false,
  deleted: false,
  metadata: {}
}

const { data, error } = await supabase
  .from('notes')
  .insert([note])
  .select()
  .single()
```

#### Update Note

```javascript
const { data, error } = await supabase
  .from('notes')
  .update({
    title: 'Updated Title',
    content: 'Updated content...',
    updated_at: new Date().toISOString()
  })
  .eq('id', noteId)
  .eq('user_id', userId)
  .select()
  .single()
```

#### Delete Note

```javascript
// Soft delete (move to trash)
const { data, error } = await supabase
  .from('notes')
  .update({
    deleted: true,
    deleted_at: new Date().toISOString()
  })
  .eq('id', noteId)
  .eq('user_id', userId)

// Permanent delete
const { error } = await supabase
  .from('notes')
  .delete()
  .eq('id', noteId)
  .eq('user_id', userId)
```

### Labels API

#### Get Labels

```javascript
const { data, error } = await supabase
  .from('labels')
  .select('*')
  .eq('user_id', userId)
  .order('name')
```

#### Create Label

```javascript
const { data, error } = await supabase
  .from('labels')
  .insert([{
    user_id: userId,
    name: 'Work'
  }])
  .select()
  .single()
```

#### Add Label to Note

```javascript
const { data, error } = await supabase
  .from('note_labels')
  .insert([{
    note_id: noteId,
    label_id: labelId
  }])
```

### File Storage

#### Upload Image

```javascript
const { data, error } = await supabase.storage
  .from('note-images')
  .upload(`${userId}/${filename}`, file, {
    cacheControl: '3600',
    upsert: false
  })

// Get public URL
const { data: urlData } = supabase.storage
  .from('note-images')
  .getPublicUrl(filename)
```

### Real-time Subscriptions

```javascript
// Subscribe to note changes
const subscription = supabase
  .channel('notes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'notes',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Note changed:', payload)
  })
  .subscribe()

// Cleanup
subscription.unsubscribe()
```

## AI Services

### Google Gemini

#### Configuration

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(
  process.env.VITE_GEMINI_API_KEY
)
```

#### Generate Response

```javascript
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

const prompt = "Summarize these notes: ..."
const result = await model.generateContent(prompt)
const response = await result.response
const text = response.text()
```

#### Process Commands

```javascript
const result = await aiService.processNoteCommand(
  "Create a note about my meeting",
  userNotes,
  userId
)

// Returns:
// {
//   action: 'CREATE_NOTE',
//   parameters: {
//     title: 'Meeting Note',
//     content: 'Meeting details...'
//   },
//   response: 'I created a note about your meeting'
// }
```

### Pinecone (Vector Search)

#### Configuration

```javascript
import { Pinecone } from '@pinecone-database/pinecone'

const pinecone = new Pinecone({
  apiKey: process.env.VITE_PINECONE_API_KEY,
  environment: process.env.VITE_PINECONE_ENVIRONMENT
})

const index = pinecone.Index('ai-keep-notes')
```

#### Store Embeddings

```javascript
await index.upsert([{
  id: noteId,
  values: embedding, // 1536-dimensional vector
  metadata: {
    userId,
    title: 'Note title',
    content: 'Note content...',
    type: 'text',
    createdAt: '2024-01-01T00:00:00Z'
  }
}])
```

#### Search

```javascript
const searchResults = await index.query({
  vector: queryEmbedding,
  topK: 10,
  filter: { userId },
  includeMetadata: true
})
```

### Deepgram (Speech-to-Text)

#### Configuration

```javascript
import { createClient } from '@deepgram/sdk'

const deepgram = createClient(
  process.env.VITE_DEEPGRAM_API_KEY
)
```

#### Transcribe Audio

```javascript
const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  audioFile,
  {
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    punctuate: true
  }
)

const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript
```

#### Live Transcription

```javascript
const connection = deepgram.listen.live({
  model: 'nova-2',
  language: 'en',
  smart_format: true,
  interim_results: true
})

connection.on('Results', (data) => {
  const transcript = data.channel?.alternatives?.[0]?.transcript
  // Handle real-time transcript
})
```

## Data Models

### Note

```typescript
interface Note {
  id: string
  user_id: string
  title: string
  content: string
  type: 'text' | 'list' | 'image' | 'voice'
  color: string
  pinned: boolean
  archived: boolean
  deleted: boolean
  created_at: string
  updated_at: string
  deleted_at?: string
  metadata: {
    checklist?: ChecklistItem[]
    images?: string[]
    voice?: VoiceMetadata
    drawing?: DrawingData
  }
  labels?: Label[]
}
```

### Label

```typescript
interface Label {
  id: string
  user_id: string
  name: string
  created_at: string
}
```

### Checklist Item

```typescript
interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
}
```

### Voice Metadata

```typescript
interface VoiceMetadata {
  transcription: {
    text: string
    confidence: number
    duration: number
    language: string
    service: 'deepgram'
  }
  audio: {
    url?: string
    filename?: string
    size: number
    duration: number
  }
}
```

### AI Chat Message

```typescript
interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  conversationId: string
  metadata?: {
    contextNotes?: number
    hasContext?: boolean
    action?: string
  }
}
```

## Error Handling

### API Errors

```javascript
try {
  const result = await apiCall()
} catch (error) {
  if (error.code === 'PGRST301') {
    // Row level security violation
    console.error('Access denied')
  } else if (error.code === '23505') {
    // Unique constraint violation
    console.error('Duplicate entry')
  } else {
    console.error('API error:', error.message)
  }
}
```

### Offline Handling

```javascript
// Check if operation should use offline storage
if (!navigator.onLine) {
  // Use IndexedDB
  const result = await offlineService.notes.create(userId, noteData)
} else {
  // Use Supabase
  const result = await notesService.createNote(userId, noteData)
}
```

### AI Service Errors

```javascript
try {
  const response = await aiService.generateResponse(prompt)
} catch (error) {
  if (error.message.includes('API key')) {
    // Invalid API key
    setAIAvailable(false)
  } else if (error.message.includes('quota')) {
    // Rate limit exceeded
    showRateLimitMessage()
  } else {
    // Generic AI error
    showFallbackResponse()
  }
}
```

### File Upload Errors

```javascript
try {
  const url = await storageService.uploadImage(file, userId)
} catch (error) {
  if (error.message.includes('File too large')) {
    showError('File must be under 10MB')
  } else if (error.message.includes('Invalid file type')) {
    showError('Only images are allowed')
  } else {
    showError('Upload failed, please try again')
  }
}
```

## Rate Limits and Quotas

### Service Limits

| Service | Free Tier Limit | Rate Limit |
|---------|----------------|------------|
| Supabase | 50,000 reads/month | 100 req/min |
| Clerk | 10,000 MAU | No rate limit |
| Gemini | 15 req/min | 1 req/sec |
| Deepgram | 45,000 min/month | Varies |
| Pinecone | 100,000 queries/month | 100 req/sec |

### Handling Rate Limits

```javascript
// Implement exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

## Security Considerations

### Row Level Security (RLS)

All Supabase tables implement RLS to ensure users can only access their own data:

```sql
-- Example policy
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);
```

### API Key Protection

- Frontend only uses public/anonymous keys
- Sensitive operations handled server-side
- Environment variables for all API keys

### Data Encryption

Optional end-to-end encryption using CryptoJS:

```javascript
// Encrypt before storing
const encrypted = CryptoJS.AES.encrypt(content, encryptionKey).toString()

// Decrypt after retrieving
const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey).toString(CryptoJS.enc.Utf8)
```

For more detailed implementation examples, see the source code in the `/src/services/` directory.