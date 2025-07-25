# AI-Powered Google Keep Clone

A comprehensive, AI-enhanced note-taking application built with React, featuring real-time sync, offline functionality, voice transcription, and intelligent search capabilities.

## 🚀 Features

### Core Note-Taking
- **Multiple Note Types**: Text, List, Image, Voice, and Drawing notes
- **Rich Content**: Support for up to 19,999 characters per note
- **File Attachments**: Image uploads up to 10MB with editing capabilities
- **Voice Notes**: Record and transcribe audio using Deepgram Nova 3
- **Drawing Support**: Integrated drawing tools using Konva

### Organization & Search
- **Color Coding**: 12 Google Keep-compatible colors
- **Custom Labels**: Create, edit, and organize notes with labels
- **Smart Search**: Full-text search with OCR support for images
- **Semantic Search**: AI-powered vector search using Pinecone
- **Filters**: Search by color, label, type, and date

### AI-Powered Features
- **Conversational AI**: Chat interface powered by Gemini 2.5 Flash
- **Smart Suggestions**: AI-generated content and organization suggestions
- **Note Commands**: Create, edit, and manage notes through natural language
- **Summarization**: Automatic note summarization and key information extraction
- **Voice Transcription**: High-accuracy speech-to-text with Deepgram Nova 3

### Sync & Offline
- **Real-time Sync**: Instant synchronization across devices
- **Offline Support**: Full functionality with IndexedDB storage
- **Conflict Resolution**: Automatic merge of offline changes
- **Export/Import**: Complete data portability

### User Experience
- **Responsive Design**: Optimized for desktop and mobile
- **Keyboard Shortcuts**: Quick actions for power users
- **Drag & Drop**: Reorder notes and checklist items
- **Dark/Light Mode**: Automatic theme switching
- **Accessibility**: Screen reader support and high contrast options

## 🛠 Tech Stack

### Frontend
- **React 18**: Modern React with hooks and context
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful, customizable icons

### Backend Services
- **Supabase**: Database, authentication, and real-time subscriptions
- **Clerk**: Advanced authentication and user management
- **Pinecone**: Vector database for semantic search
- **Deepgram**: Speech-to-text API
- **Google Gemini**: AI language model

### Development
- **TypeScript**: Type safety and better developer experience
- **ESLint**: Code linting and formatting
- **Vitest**: Fast unit testing framework
- **Netlify**: Deployment and hosting

## 📋 Prerequisites

Before getting started, ensure you have:

- Node.js 18+ and npm
- Accounts for the following services:
  - [Supabase](https://supabase.com) (Database & Auth)
  - [Clerk](https://clerk.dev) (Authentication)
  - [Pinecone](https://pinecone.io) (Vector Search) - Optional
  - [Google AI Studio](https://makersuite.google.com) (Gemini API) - Optional
  - [Deepgram](https://deepgram.com) (Speech-to-Text) - Optional

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-google-keep-clone
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your service credentials:

```bash
# Required - Core functionality
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional - AI features
VITE_PINECONE_API_KEY=your_pinecone_api_key_here
VITE_PINECONE_ENVIRONMENT=your_pinecone_environment_here
VITE_PINECONE_INDEX_NAME=ai-keep-notes
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Optional - Security
VITE_ENABLE_ENCRYPTION=false
VITE_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

### 3. Database Setup

#### Supabase Configuration

1. Create a new Supabase project
2. Run the following SQL in the Supabase SQL editor:

```sql
-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create notes table
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  type VARCHAR(20) DEFAULT 'text',
  color VARCHAR(20) DEFAULT 'default',
  pinned BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create labels table
CREATE TABLE labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create note_labels junction table
CREATE TABLE note_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  UNIQUE(note_id, label_id)
);

-- Row Level Security policies
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own labels" ON labels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own labels" ON labels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels" ON labels
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels" ON labels
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view note_labels for their notes" ON note_labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_labels.note_id 
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert note_labels for their notes" ON note_labels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_labels.note_id 
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete note_labels for their notes" ON note_labels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_labels.note_id 
      AND notes.user_id = auth.uid()
    )
  );

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_labels ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('note-images', 'note-images', true);

-- Storage policies
CREATE POLICY "Users can upload their own images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own images" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

#### Pinecone Setup (Optional)

1. Create a Pinecone account and project
2. Create an index with:
   - Dimensions: 1536
   - Metric: cosine
   - Name: ai-keep-notes

### 4. Development

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

### 5. Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 🚀 Deployment

### Netlify Deployment

1. Push your code to GitHub
2. Connect your GitHub repository to Netlify
3. Configure environment variables in Netlify dashboard
4. Deploy!

The `netlify.toml` file is already configured for optimal deployment.

### Manual Deployment

1. Build the project: `npm run build`
2. Upload the `dist` folder to your hosting provider
3. Configure environment variables
4. Ensure redirects are set up for SPA routing

## 🎮 Usage Guide

### Keyboard Shortcuts

- `C` - Create new note
- `/` - Open search
- `E` - Edit selected note
- `V` - Toggle view mode (grid/list)
- `A` - Open AI chat

### AI Commands

Try these natural language commands in the AI chat:

- "Create a note about my meeting tomorrow"
- "Show me my shopping lists"
- "Summarize my notes from this week"
- "What were my thoughts on the project?"
- "Add apples to my grocery list"

### Voice Notes

1. Click the microphone icon in the note editor
2. Record your audio (up to 25MB)
3. Wait for transcription
4. Edit the transcript if needed
5. Save the note

### Offline Usage

The app works fully offline with automatic sync when reconnected:

- All notes are cached locally
- Changes are queued for sync
- Conflict resolution happens automatically
- Export/import for data backup

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── notes/          # Note-specific components
│   ├── ui/             # Basic UI components
│   └── ...
├── contexts/           # React contexts for state management
├── services/           # API and service integrations
├── utils/              # Utility functions
├── pages/              # Page components
├── hooks/              # Custom React hooks
└── config/             # Configuration files
```

## 🔧 Configuration

### Environment Variables

All configuration is handled through environment variables. See `.env.example` for the complete list.

### Feature Flags

Control features through environment variables:

- `VITE_ENABLE_ENCRYPTION` - Enable/disable end-to-end encryption
- AI features are automatically disabled if API keys are not provided

## 🔒 Security

- **Authentication**: Managed by Clerk with OAuth 2.0
- **Authorization**: Row-level security in Supabase
- **Encryption**: Optional end-to-end encryption with CryptoJS
- **HTTPS**: Enforced in production
- **Data Privacy**: No data shared beyond configured services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Check the [Issues](https://github.com/your-repo/issues) page for known problems
- Create a new issue for bugs or feature requests
- Refer to service documentation for API-related issues

## 🚧 Roadmap

- [ ] Mobile app (React Native)
- [ ] Browser extension
- [ ] Collaboration features
- [ ] Advanced AI features
- [ ] More integration options

---

**Built with ❤️ using modern web technologies**
