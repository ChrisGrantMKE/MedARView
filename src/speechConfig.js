const DEFAULT_PROVIDER = 'google-medical-proxy'
const DEFAULT_BUDGET_MINUTES = 60
const DEFAULT_WINDOW_DAYS = 30

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const speechConfig = {
  commandProvider: 'browser-web-speech',
  dictationProvider: import.meta.env.VITE_DICTATION_PROVIDER || DEFAULT_PROVIDER,
  dictationApiUrl: import.meta.env.VITE_DICTATION_API_URL || '',
  budgetMinutes: parsePositiveNumber(import.meta.env.VITE_SPEECH_BUDGET_MINUTES, DEFAULT_BUDGET_MINUTES),
  budgetWindowDays: parsePositiveNumber(import.meta.env.VITE_SPEECH_BUDGET_WINDOW_DAYS, DEFAULT_WINDOW_DAYS),
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