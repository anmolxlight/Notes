import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import CryptoJS from 'crypto-js'
import config from '../config'

// Tailwind CSS class merging utility
export const cn = (...inputs) => {
  return twMerge(clsx(inputs))
}

// Date formatting utilities
export const formatDate = (dateString, formatStr = 'MMM d, yyyy') => {
  if (!dateString) return ''
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
    return format(date, formatStr)
  } catch (error) {
    console.error('Invalid date:', dateString)
    return ''
  }
}

export const formatRelativeTime = (dateString) => {
  if (!dateString) return ''
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
    
    if (isToday(date)) {
      return format(date, 'h:mm a')
    } else if (isYesterday(date)) {
      return 'Yesterday'
    } else {
      return formatDistanceToNow(date, { addSuffix: true })
    }
  } catch (error) {
    console.error('Invalid date:', dateString)
    return ''
  }
}

// Text processing utilities
export const truncateText = (text, maxLength = 100, ellipsis = '...') => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + ellipsis
}

export const stripHtml = (html) => {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

export const highlightText = (text, query) => {
  if (!query || !text) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

export const extractKeywords = (text, maxKeywords = 5) => {
  if (!text) return []
  
  // Simple keyword extraction - in production you'd want a more sophisticated approach
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
  
  const frequency = {}
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

// Validation utilities
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateUrl = (url) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const validateNoteTitle = (title) => {
  return title && title.trim().length > 0 && title.length <= 100
}

export const validateNoteContent = (content) => {
  return content && content.length <= config.app.maxNoteLength
}

// File utilities
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

export const isImageFile = (file) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  return imageTypes.includes(file.type)
}

export const isAudioFile = (file) => {
  const audioTypes = [
    'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 
    'audio/ogg', 'audio/webm', 'audio/m4a'
  ]
  return audioTypes.includes(file.type)
}

// Encryption utilities (if enabled)
export const encryptText = (text, key = config.encryption.key) => {
  if (!config.encryption.enabled || !key) return text
  
  try {
    return CryptoJS.AES.encrypt(text, key).toString()
  } catch (error) {
    console.error('Encryption failed:', error)
    return text
  }
}

export const decryptText = (encryptedText, key = config.encryption.key) => {
  if (!config.encryption.enabled || !key) return encryptedText
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, key)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Decryption failed:', error)
    return encryptedText
  }
}

// Color utilities
export const getContrastColor = (hexColor) => {
  // Remove # if present
  const color = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16)
  const g = parseInt(color.substr(2, 2), 16)
  const b = parseInt(color.substr(4, 2), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export const hexToRgba = (hex, alpha = 1) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result 
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
    : hex
}

// Search utilities
export const createSearchRegex = (query, flags = 'gi') => {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escapedQuery, flags)
}

export const scoreSearchMatch = (text, query) => {
  if (!text || !query) return 0
  
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100
  
  // Starts with gets high score
  if (lowerText.startsWith(lowerQuery)) return 90
  
  // Contains gets medium score
  if (lowerText.includes(lowerQuery)) return 70
  
  // Word boundary match gets good score
  const wordBoundaryRegex = new RegExp(`\\b${lowerQuery}`, 'i')
  if (wordBoundaryRegex.test(text)) return 80
  
  return 0
}

// URL utilities
export const createShareableUrl = (noteId) => {
  const baseUrl = window.location.origin
  return `${baseUrl}/notes/${noteId}`
}

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (err) {
      document.body.removeChild(textArea)
      return false
    }
  }
}

// Array utilities
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key]
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {})
}

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1
    if (aVal > bVal) return direction === 'asc' ? 1 : -1
    return 0
  })
}

// Debounce utility
export const debounce = (func, wait, immediate = false) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func(...args)
  }
}

// Throttle utility
export const throttle = (func, limit) => {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Local storage utilities
export const safeLocalStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return defaultValue
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error('Error writing to localStorage:', error)
      return false
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('Error removing from localStorage:', error)
      return false
    }
  }
}

// Generate unique IDs
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Hash utilities
export const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

export default {
  cn,
  formatDate,
  formatRelativeTime,
  truncateText,
  stripHtml,
  highlightText,
  extractKeywords,
  validateEmail,
  validateUrl,
  validateNoteTitle,
  validateNoteContent,
  formatFileSize,
  getFileExtension,
  isImageFile,
  isAudioFile,
  encryptText,
  decryptText,
  getContrastColor,
  hexToRgba,
  createSearchRegex,
  scoreSearchMatch,
  createShareableUrl,
  copyToClipboard,
  groupBy,
  sortBy,
  debounce,
  throttle,
  safeLocalStorage,
  generateId,
  hashString,
}