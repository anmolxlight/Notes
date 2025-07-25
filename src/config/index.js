// Application configuration
export const config = {
  // Authentication
  clerk: {
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  },

  // Database
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },

  // AI Services
  ai: {
    pinecone: {
      apiKey: import.meta.env.VITE_PINECONE_API_KEY,
      environment: import.meta.env.VITE_PINECONE_ENVIRONMENT,
      indexName: import.meta.env.VITE_PINECONE_INDEX_NAME || 'ai-keep-notes',
    },
    gemini: {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
    },
    deepgram: {
      apiKey: import.meta.env.VITE_DEEPGRAM_API_KEY,
    },
  },

  // Security
  encryption: {
    enabled: import.meta.env.VITE_ENABLE_ENCRYPTION === 'true',
    key: import.meta.env.VITE_ENCRYPTION_KEY,
  },

  // Application settings
  app: {
    name: 'AI Keep',
    version: '1.0.0',
    maxNoteLength: 19999,
    maxImageSize: 10 * 1024 * 1024, // 10MB
    trashRetentionDays: 7,
    offlineStorageQuota: 50 * 1024 * 1024, // 50MB
  },

  // Note colors (Google Keep compatible)
  noteColors: {
    default: '#ffffff',
    red: '#f28b82',
    orange: '#fbbc04',
    yellow: '#fff475',
    green: '#ccff90',
    teal: '#a7ffeb',
    blue: '#cbf0f8',
    darkblue: '#aecbfa',
    purple: '#d7aefb',
    pink: '#fdcfe8',
    brown: '#e6c9a8',
    gray: '#e8eaed',
  },

  // Keyboard shortcuts
  shortcuts: {
    newNote: 'c',
    search: '/',
    editNote: 'e',
    toggleView: 'v',
    openAI: 'a',
  },

  // API endpoints and limits
  api: {
    endpoints: {
      notes: '/api/notes',
      labels: '/api/labels',
      search: '/api/search',
      ai: '/api/ai',
      transcribe: '/api/transcribe',
    },
    limits: {
      requestsPerMinute: 60,
      batchSize: 50,
    },
  },
}

// Validation
export const validateConfig = () => {
  const required = [
    'VITE_CLERK_PUBLISHABLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]

  const missing = required.filter(key => !import.meta.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return true
}

export default config