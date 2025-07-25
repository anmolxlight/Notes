# Architecture Documentation

This document outlines the technical architecture, design patterns, and decisions made in the AI-powered Google Keep clone.

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [State Management](#state-management)
4. [Data Flow](#data-flow)
5. [Service Layer](#service-layer)
6. [Offline Architecture](#offline-architecture)
7. [AI Integration](#ai-integration)
8. [Security Architecture](#security-architecture)
9. [Performance Considerations](#performance-considerations)

## System Overview

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Services      │    │   Storage       │
│   (React SPA)   │    │   (APIs)        │    │   (Cloud)       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • React 18      │────│ • Clerk         │────│ • Supabase DB   │
│ • Vite          │    │ • Supabase      │    │ • File Storage  │
│ • Tailwind CSS  │    │ • Gemini AI     │    │ • IndexedDB     │
│ • Context API   │    │ • Pinecone      │    │ • Pinecone      │
│ • IndexedDB     │    │ • Deepgram      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + Vite | Modern React with fast development |
| Styling | Tailwind CSS | Utility-first CSS framework |
| State | Context API + Hooks | Global state management |
| Database | Supabase | PostgreSQL with real-time features |
| Auth | Clerk | Authentication and user management |
| AI | Google Gemini | Language model for chat and commands |
| Vector DB | Pinecone | Semantic search capabilities |
| Speech | Deepgram | Speech-to-text transcription |
| Offline | IndexedDB + Dexie | Local storage and sync |
| Deployment | Netlify | Static site hosting with CDN |

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/                 # Basic UI components
│   │   ├── Button.jsx
│   │   ├── Modal.jsx
│   │   └── Input.jsx
│   ├── notes/              # Note-specific components
│   │   ├── NoteCard.jsx
│   │   ├── NoteEditor.jsx
│   │   ├── NotesList.jsx
│   │   └── CreateNoteModal.jsx
│   ├── ai/                 # AI-related components
│   │   ├── AIChat.jsx
│   │   ├── VoiceRecorder.jsx
│   │   └── SmartSuggestions.jsx
│   ├── Layout.jsx          # Main application layout
│   ├── Sidebar.jsx         # Navigation sidebar
│   └── Header.jsx          # Top header with search
├── pages/                  # Route components
│   ├── Notes.jsx
│   ├── Archive.jsx
│   ├── Trash.jsx
│   └── Settings.jsx
├── contexts/               # React contexts
│   ├── AuthContext.jsx
│   ├── NotesContext.jsx
│   ├── AIContext.jsx
│   └── OfflineContext.jsx
├── services/               # External API services
│   ├── supabase.js
│   ├── ai.js
│   ├── deepgram.js
│   └── offline.js
├── utils/                  # Utility functions
│   └── index.js
└── hooks/                  # Custom React hooks
    ├── useKeyboard.js
    ├── useDebounce.js
    └── useLocalStorage.js
```

### Design Patterns

#### 1. Context + Provider Pattern

Each major feature area has its own context for state management:

```javascript
// NotesContext.jsx
export const NotesProvider = ({ children }) => {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  
  const createNote = useCallback(async (noteData) => {
    // Implementation
  }, [])
  
  const value = {
    notes,
    loading,
    createNote,
    // ... other operations
  }
  
  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  )
}
```

#### 2. Service Layer Pattern

All external API calls are abstracted into service modules:

```javascript
// services/supabase.js
export const notesService = {
  async createNote(userId, noteData) {
    // Supabase implementation
  },
  
  async updateNote(noteId, updates) {
    // Supabase implementation
  }
}
```

#### 3. Hook Composition Pattern

Complex logic is encapsulated in custom hooks:

```javascript
// hooks/useNotes.js
export const useNotes = () => {
  const context = useContext(NotesContext)
  if (!context) {
    throw new Error('useNotes must be used within NotesProvider')
  }
  return context
}
```

#### 4. Compound Component Pattern

Related components are grouped together:

```javascript
// NoteEditor compound component
<NoteEditor>
  <NoteEditor.Header />
  <NoteEditor.Content />
  <NoteEditor.Toolbar />
  <NoteEditor.Footer />
</NoteEditor>
```

## State Management

### Context Architecture

```
App
├── AuthProvider          # User authentication state
│   ├── OfflineProvider   # Network and sync state
│   │   ├── NotesProvider # Notes and labels state
│   │   │   └── AIProvider # AI chat and features
│   │   │       └── App Components
```

### State Flow

1. **Authentication State** (AuthContext)
   - User login/logout
   - User profile information
   - Authentication status

2. **Offline State** (OfflineContext)
   - Network connectivity
   - Sync queue management
   - Offline storage operations

3. **Notes State** (NotesContext)
   - Notes CRUD operations
   - Labels management
   - Search and filtering
   - View mode preferences

4. **AI State** (AIContext)
   - Chat messages
   - AI processing status
   - Voice transcription
   - Smart suggestions

### Data Normalization

Notes are stored with normalized references to labels:

```javascript
// Normalized state structure
const state = {
  notes: {
    'note-1': { id: 'note-1', title: 'Note 1', labelIds: ['label-1'] },
    'note-2': { id: 'note-2', title: 'Note 2', labelIds: ['label-1', 'label-2'] }
  },
  labels: {
    'label-1': { id: 'label-1', name: 'Work' },
    'label-2': { id: 'label-2', name: 'Personal' }
  }
}
```

## Data Flow

### 1. Create Note Flow

```
User Input → NotesContext → Service Layer → Database
     ↓              ↓              ↓           ↓
UI Update ← State Update ← Response ← Storage
```

### 2. Offline-First Flow

```
User Action → Check Network → Online? → Supabase
                   ↓              ↓
              IndexedDB ← No      Yes
                   ↓              ↓
            Sync Queue ← ─ ─ ─ ─ Success
                   ↓
            Auto Sync (when online)
```

### 3. AI Chat Flow

```
User Message → AIContext → Retrieve Context → Gemini API
      ↓             ↓            ↓               ↓
UI Update ← Add Message ← Search Notes ← AI Response
```

## Service Layer

### Service Architecture

Each external service has its own module with consistent interfaces:

```javascript
// Common service interface
export const serviceTemplate = {
  // Check availability
  isAvailable() { return boolean },
  
  // Initialize service
  async initialize() { return boolean },
  
  // Core operations
  async operation(params) { return result },
  
  // Error handling
  handleError(error) { return formattedError }
}
```

### Service Implementations

#### 1. Supabase Service

- Database operations (CRUD)
- Real-time subscriptions
- File storage
- Row-level security

#### 2. AI Service

- Chat completion with Gemini
- Semantic search with Pinecone
- Note command processing
- Content suggestions

#### 3. Transcription Service

- Audio file validation
- Speech-to-text with Deepgram
- Real-time transcription
- Multiple language support

#### 4. Offline Service

- IndexedDB operations
- Sync queue management
- Data export/import
- Storage quota monitoring

## Offline Architecture

### Offline-First Design

The application is designed to work offline by default:

1. **Local Storage**: IndexedDB for persistent storage
2. **Sync Queue**: Track changes for later synchronization
3. **Conflict Resolution**: Last-write-wins with timestamps
4. **Background Sync**: Automatic sync when online

### IndexedDB Schema

```javascript
// Database schema using Dexie
const schema = {
  notes: '++id, user_id, title, content, type, color, pinned, archived, deleted, created_at, updated_at, sync_status',
  labels: '++id, user_id, name, created_at, sync_status',
  note_labels: '++id, note_id, label_id, sync_status',
  sync_queue: '++id, table_name, record_id, operation, data, created_at, retries',
  user_preferences: '++id, user_id, key, value',
  cached_ai_responses: '++id, query_hash, response, created_at, expires_at'
}
```

### Sync Strategy

1. **Immediate Sync**: Try to sync changes immediately
2. **Queue Failed Operations**: Store failed operations for retry
3. **Batch Sync**: Process multiple operations together
4. **Exponential Backoff**: Retry with increasing delays
5. **Conflict Resolution**: Handle simultaneous edits

## AI Integration

### AI Service Architecture

```
AI Context
├── Chat Interface       # User interaction
├── Command Processor    # Natural language commands
├── Content Suggestions  # Smart autocomplete
└── Semantic Search      # Vector-based search
```

### Vector Search Implementation

1. **Embedding Generation**: Convert text to vectors
2. **Storage**: Store vectors in Pinecone with metadata
3. **Similarity Search**: Find related notes by vector similarity
4. **Hybrid Search**: Combine vector and text search

### Chat Context Management

```javascript
// Context building for AI responses
const buildContext = async (userMessage, notes) => {
  // 1. Search for relevant notes
  const relevantNotes = await semanticSearch(userMessage, notes)
  
  // 2. Limit context size
  const context = relevantNotes.slice(0, 5)
  
  // 3. Format for AI
  return context.map(note => ({
    title: note.title,
    content: note.content.slice(0, 500)
  }))
}
```

## Security Architecture

### Authentication Flow

```
User → Clerk → JWT Token → Supabase → Row Level Security
```

### Data Protection

1. **Authentication**: Clerk handles OAuth and user management
2. **Authorization**: Supabase RLS ensures data isolation
3. **Encryption**: Optional end-to-end encryption with CryptoJS
4. **API Security**: Public keys only, no sensitive data in frontend

### Security Layers

| Layer | Protection | Implementation |
|-------|------------|----------------|
| Transport | HTTPS | Enforced in production |
| Authentication | OAuth 2.0 | Clerk integration |
| Authorization | RLS | Supabase policies |
| Data | Encryption | Optional CryptoJS |
| Storage | Isolation | User-specific keys |

## Performance Considerations

### Frontend Optimization

1. **Code Splitting**: Vite automatic chunking
2. **Lazy Loading**: Route-based code splitting
3. **Memoization**: React.memo and useMemo
4. **Virtual Scrolling**: For large note lists
5. **Image Optimization**: WebP format and compression

### Data Optimization

1. **Pagination**: Load notes in batches
2. **Caching**: AI responses and search results
3. **Debouncing**: Search and auto-save operations
4. **Compression**: Gzip/Brotli for transfers
5. **CDN**: Static asset delivery

### Database Optimization

1. **Indexes**: Optimized for common queries
2. **Connection Pooling**: Supabase managed
3. **Query Optimization**: Efficient joins and filters
4. **Real-time Subscriptions**: Selective updates only

### Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --analyze

# Key metrics to monitor:
# - Initial bundle size < 500KB
# - Largest chunk < 200KB
# - Total assets < 2MB
```

### Performance Monitoring

1. **Core Web Vitals**: Built-in measurement
2. **Error Tracking**: ErrorBoundary component
3. **Performance API**: Navigation and resource timing
4. **User Analytics**: Optional integration

## Scalability Considerations

### Horizontal Scaling

1. **Stateless Frontend**: Can be deployed anywhere
2. **CDN Distribution**: Global content delivery
3. **API Rate Limiting**: Built into service tiers
4. **Database Scaling**: Supabase auto-scaling

### Vertical Scaling

1. **Code Splitting**: Reduce initial load
2. **Lazy Loading**: Load features on demand
3. **Service Workers**: Background processing
4. **Web Workers**: CPU-intensive tasks

### Future Enhancements

1. **Progressive Web App**: Service worker implementation
2. **WebRTC**: Real-time collaboration
3. **WebAssembly**: High-performance features
4. **Edge Computing**: Geo-distributed AI processing

This architecture supports the current feature set while providing a foundation for future enhancements and scale.