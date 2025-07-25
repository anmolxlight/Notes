import { createClient } from '@deepgram/sdk'
import config from '../config'

// Initialize Deepgram client
let deepgram = null
if (config.ai.deepgram.apiKey) {
  deepgram = createClient(config.ai.deepgram.apiKey)
}

export const transcriptionService = {
  // Check if Deepgram is available
  isAvailable() {
    return !!deepgram
  },

  // Transcribe audio file
  async transcribeFile(audioFile) {
    if (!deepgram) {
      throw new Error('Deepgram not configured')
    }

    try {
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioFile,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
          multichannel: false,
          alternatives: 1,
          profanity_filter: false,
          redact: false,
          utterances: true,
          paragraphs: true,
        }
      )

      if (error) {
        throw new Error(`Transcription error: ${error.message}`)
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript
      const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence
      const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || []

      return {
        transcript: transcript || '',
        confidence: confidence || 0,
        words,
        metadata: {
          duration: result.metadata?.duration || 0,
          model: 'nova-2',
          language: result.results?.channels?.[0]?.detected_language || 'en',
        },
      }
    } catch (error) {
      console.error('Transcription error:', error)
      throw new Error('Failed to transcribe audio')
    }
  },

  // Transcribe audio from URL
  async transcribeUrl(audioUrl) {
    if (!deepgram) {
      throw new Error('Deepgram not configured')
    }

    try {
      const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
          diarize: false,
          multichannel: false,
          alternatives: 1,
          profanity_filter: false,
          redact: false,
          utterances: true,
          paragraphs: true,
        }
      )

      if (error) {
        throw new Error(`Transcription error: ${error.message}`)
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript
      const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence
      const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || []

      return {
        transcript: transcript || '',
        confidence: confidence || 0,
        words,
        metadata: {
          duration: result.metadata?.duration || 0,
          model: 'nova-2',
          language: result.results?.channels?.[0]?.detected_language || 'en',
        },
      }
    } catch (error) {
      console.error('Transcription error:', error)
      throw new Error('Failed to transcribe audio from URL')
    }
  },

  // Real-time transcription setup (for live audio)
  async startLiveTranscription(onTranscript, onError) {
    if (!deepgram) {
      throw new Error('Deepgram not configured')
    }

    try {
      const connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
      })

      connection.on('open', () => {
        console.log('Live transcription connection opened')
      })

      connection.on('Results', (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript
        const isFinal = data.is_final
        const confidence = data.channel?.alternatives?.[0]?.confidence

        if (transcript && onTranscript) {
          onTranscript({
            transcript,
            isFinal,
            confidence,
            timestamp: new Date().toISOString(),
          })
        }
      })

      connection.on('error', (error) => {
        console.error('Live transcription error:', error)
        if (onError) onError(error)
      })

      connection.on('close', () => {
        console.log('Live transcription connection closed')
      })

      return connection
    } catch (error) {
      console.error('Failed to start live transcription:', error)
      throw new Error('Failed to start live transcription')
    }
  },

  // Get supported languages
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'nl', name: 'Dutch' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
    ]
  },

  // Validate audio file
  validateAudioFile(file) {
    const maxSize = 25 * 1024 * 1024 // 25MB limit for Deepgram
    const supportedTypes = [
      'audio/mp3',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
      'audio/m4a',
    ]

    if (file.size > maxSize) {
      throw new Error('Audio file too large. Maximum size is 25MB.')
    }

    if (!supportedTypes.includes(file.type)) {
      throw new Error(`Unsupported audio format: ${file.type}`)
    }

    return true
  },

  // Format transcription for display
  formatTranscription(transcriptionResult) {
    const { transcript, confidence, words, metadata } = transcriptionResult

    return {
      text: transcript,
      confidence: Math.round(confidence * 100),
      wordCount: words.length,
      duration: Math.round(metadata.duration),
      language: metadata.language,
      timestamps: words.map(word => ({
        word: word.word,
        start: word.start,
        end: word.end,
        confidence: Math.round(word.confidence * 100),
      })),
    }
  },
}

export default transcriptionService