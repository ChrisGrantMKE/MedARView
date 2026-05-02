import { speechConfig } from './speechConfig'

const doctorKeywords = [
  'assessment',
  'plan',
  'recommend',
  'monitor',
  'prescribe',
  'diagnosis',
  'exam',
  'blood pressure',
  'spo2',
  'follow up',
  'medication',
  'dose',
]

const patientKeywords = [
  'i feel',
  'i have',
  'my pain',
  'it hurts',
  'i am dizzy',
  'i am tired',
  'short of breath',
  'nausea',
  'fever',
  'swelling',
  'my chest',
]

function scoreKeywords(text, keywords) {
  const normalized = text.toLowerCase()
  return keywords.reduce((score, phrase) => score + (normalized.includes(phrase) ? 1 : 0), 0)
}

function heuristicAttribution({ utterance, previousSpeaker }) {
  const doctorScore = scoreKeywords(utterance, doctorKeywords)
  const patientScore = scoreKeywords(utterance, patientKeywords)

  if (doctorScore > patientScore) {
    return { speaker: 'Doctor', confidence: 0.68, source: 'heuristic-keyword' }
  }

  if (patientScore > doctorScore) {
    return { speaker: 'Patient', confidence: 0.68, source: 'heuristic-keyword' }
  }

  const fallback = previousSpeaker === 'Doctor' ? 'Patient' : 'Doctor'
  return { speaker: fallback, confidence: 0.55, source: 'heuristic-turn-taking' }
}

async function callApiAttribution({ utterance, conversationTail, previousSpeaker }) {
  if (!speechConfig.externalDictationEnabled) {
    return null
  }

  if (!speechConfig.speakerApiUrl) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)

  try {
    const response = await fetch(speechConfig.speakerApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance,
        conversationTail,
        previousSpeaker,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data?.speaker !== 'Doctor' && data?.speaker !== 'Patient') {
      return null
    }

    return {
      speaker: data.speaker,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.75,
      source: 'api-diarization',
    }
  } catch (_) {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function inferSpeaker({ utterance, conversation, previousSpeaker }) {
  const conversationTail = conversation.slice(-8).map((entry) => ({
    speaker: entry.speaker,
    text: entry.text,
    timestamp: entry.timestamp,
  }))

  const apiResult = await callApiAttribution({
    utterance,
    conversationTail,
    previousSpeaker,
  })

  if (apiResult) {
    return apiResult
  }

  return heuristicAttribution({
    utterance,
    previousSpeaker,
  })
}
