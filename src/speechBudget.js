import { speechConfig } from './speechConfig'

const STORAGE_KEY = 'medarview-speech-budget-v1'

function now() {
  return Date.now()
}

function getWindowStart() {
  return now() - speechConfig.budgetWindowDays * 24 * 60 * 60 * 1000
}

function sanitizeSessions(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((session) => Number.isFinite(session?.startedAt) && Number.isFinite(session?.elapsedMs) && session.elapsedMs > 0)
    .map((session) => ({
      startedAt: session.startedAt,
      elapsedMs: session.elapsedMs,
    }))
}

function loadStore() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { sessions: [] }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { sessions: [] }
    }

    const parsed = JSON.parse(raw)
    return { sessions: sanitizeSessions(parsed.sessions) }
  } catch (_) {
    return { sessions: [] }
  }
}

function saveStore(store) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function pruneSessions(sessions) {
  const cutoff = getWindowStart()
  return sessions.filter((session) => session.startedAt >= cutoff)
}

export function getSpeechBudgetSnapshot() {
  const sessions = pruneSessions(loadStore().sessions)
  const usedMs = sessions.reduce((total, session) => total + session.elapsedMs, 0)
  const budgetMs = speechConfig.budgetMinutes * 60 * 1000
  const remainingMs = Math.max(0, budgetMs - usedMs)

  return {
    usedMs,
    usedMinutes: usedMs / 60000,
    remainingMs,
    remainingMinutes: remainingMs / 60000,
    budgetMinutes: speechConfig.budgetMinutes,
    budgetWindowDays: speechConfig.budgetWindowDays,
    sessions,
    exhausted: remainingMs <= 0,
  }
}

export function recordSpeechSession(startedAt, endedAt = now()) {
  if (!Number.isFinite(startedAt)) {
    return getSpeechBudgetSnapshot()
  }

  const elapsedMs = Math.max(0, endedAt - startedAt)
  if (elapsedMs <= 0) {
    return getSpeechBudgetSnapshot()
  }

  const store = loadStore()
  const sessions = pruneSessions(store.sessions)
  sessions.push({ startedAt, elapsedMs })
  saveStore({ sessions })

  return getSpeechBudgetSnapshot()
}

export function formatBudgetSummary(snapshot) {
  return `${snapshot.remainingMinutes.toFixed(1)}m left / ${snapshot.budgetMinutes}m in ${snapshot.budgetWindowDays}d`
}