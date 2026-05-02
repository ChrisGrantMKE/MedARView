const DEFAULT_PROVIDER = 'google-medical-proxy'
const DEFAULT_BUDGET_MINUTES = 60
const DEFAULT_WINDOW_DAYS = 30

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const speechConfig = {
  dictationEnabled: parseBoolean(import.meta.env.VITE_ENABLE_DICTATION, true),
  externalDictationEnabled: parseBoolean(import.meta.env.VITE_ENABLE_EXTERNAL_DICTATION, true),
  commandProvider: 'browser-web-speech',
  dictationProvider: import.meta.env.VITE_DICTATION_PROVIDER || DEFAULT_PROVIDER,
  /** Reserved for future streamed dictation proxy — browser SR path does not call this URL today. */
  dictationApiUrl: import.meta.env.VITE_DICTATION_API_URL || '',
  /** Speaker attribution POST endpoint (`inferSpeaker`). Empty → heuristic fallback only. */
  speakerApiUrl: import.meta.env.VITE_SPEAKER_API_URL || '',
  budgetMinutes: parsePositiveNumber(import.meta.env.VITE_SPEECH_BUDGET_MINUTES, DEFAULT_BUDGET_MINUTES),
  budgetWindowDays: parsePositiveNumber(import.meta.env.VITE_SPEECH_BUDGET_WINDOW_DAYS, DEFAULT_WINDOW_DAYS),
  /** WebSocket STT path on the speech gateway (must match MEDARVIEW_SPEECH_WS_PATH). */
  speechWsPath: import.meta.env.VITE_SPEECH_WS_PATH || '/ws/stt',
  /**
   * Optional full base for WS (e.g. `wss://your.host` with path added).
   * If unset in dev, use same host as the page + Vite `/api/gateway-ws` proxy.
   */
  gatewayWsBase: import.meta.env.VITE_GATEWAY_WS_URL || '',
}

/** True when browser exposes Web Speech API (often false on Meta Quest Browser). */
export function browserSpeechRecognitionAvailable() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * WebSocket URL for gateway streaming STT. Quest/LAN: must be reachable from the headset (never localhost unless on PC).
 */
export function getGatewaySttWebSocketUrl() {
  const path = speechConfig.speechWsPath.startsWith('/') ? speechConfig.speechWsPath : `/${speechConfig.speechWsPath}`
  const base = speechConfig.gatewayWsBase.replace(/\/$/, '')
  if (base) {
    return `${base}${path}`
  }
  /** Same-origin proxy (`vite.config` / reverse proxy) — works for dev, preview, and LAN without `VITE_GATEWAY_WS_URL`. */
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/api/gateway-ws${path}`
  }
  return ''
}

export function getSpeechProviderLabel() {
  switch (speechConfig.dictationProvider) {
    case 'google-medical-proxy':
      return 'Google Medical Proxy'
    case 'browser-mock':
      return 'Browser Mock Dictation'
    case 'deepgram-proxy':
      return 'Deepgram Proxy'
    default:
      return speechConfig.dictationProvider
  }
}

export function isExternalDictationProvider() {
  return speechConfig.dictationProvider !== 'browser-mock'
}

export function shouldUseExternalDictation() {
  return speechConfig.dictationEnabled && speechConfig.externalDictationEnabled && isExternalDictationProvider()
}