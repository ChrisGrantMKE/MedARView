/**
 * MedARView – Visit Summarization
 *
 * CURRENT APPROACH: Lightweight extractive summarization.
 * Sentences are scored by clinical-keyword density; the highest-scoring
 * sentences are used to build the visit abstract. Works entirely client-side
 * with no external dependencies.
 *
 * ─── RECOMMENDED UPGRADE PATH ────────────────────────────────────────────
 *
 *  Option A — In-browser LLM (no server, fully private):
 *    npm install @xenova/transformers
 *    Use Xenova/distilbart-cnn-6-6 in a Web Worker:
 *
 *      import { pipeline } from '@xenova/transformers'
 *      const summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6')
 *      const [result] = await summarizer(fullText, { max_new_tokens: 150 })
 *      // result.summary_text replaces the extractive block below
 *
 *  Option B — Server API (highest clinical quality):
 *    Add a Node/Express endpoint POST /api/summarize that calls GPT-4o:
 *
 *      const res = await fetch('/api/summarize', {
 *        method: 'POST',
 *        headers: { 'Content-Type': 'application/json' },
 *        body: JSON.stringify({ transcript, vitals }),
 *      })
 *      return (await res.json()).abstract
 *
 *    Suggested system prompt:
 *      "You are a certified medical scribe. Given the doctor–patient
 *       transcript below, produce a structured SOAP note with:
 *       Chief Complaint, History of Present Illness, Assessment, Plan."
 *
 *  Both options keep the generateAbstract() signature identical — only
 *  the implementation body changes.
 * ─────────────────────────────────────────────────────────────────────────
 */

const CLINICAL_PATTERNS = [
  { label: 'Cardiovascular', re: /heart|cardiac|chest|palpitat|arrhythmia|blood pressure|\bbp\b|hypertens/i },
  { label: 'Respiratory',    re: /breath|dyspnea|oxygen|\bspo2\b|saturation|cough|wheez|\blung/i },
  { label: 'Pain',           re: /\bpain\b|ache|hurt|discomfort|tender|sore/i },
  { label: 'Medications',    re: /medication|medicine|\bdrug\b|dosage|prescri|\bmg\b|pill|tablet/i },
  { label: 'Symptoms',       re: /symptom|complain|nausea|fever|fatigue|dizzy|swelling|edema/i },
  { label: 'History',        re: /history|diagnosis|condition|diabetes|cancer|surgery|allerg/i },
  { label: 'Vitals',         re: /temperature|pulse|\brate\b|weight|\bheight\b|\bbmi\b/i },
]

function scoreText(text) {
  return CLINICAL_PATTERNS.reduce((n, { re }) => n + (re.test(text) ? 1 : 0), 0)
}

function extractSentences(text) {
  return (text.match(/[^.!?\n]+[.!?\n]+/g) || [text])
    .map(s => s.trim())
    .filter(s => s.length > 8)
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`
}

export function generateAbstract(conversation, vitals, startTime) {
  if (!conversation || conversation.length === 0) {
    return [
      'No conversation was recorded.',
      '',
      'VITALS AT CLOSE',
      `  BP:    ${vitals.systolic}/${vitals.diastolic} mmHg`,
      `  SpO\u2082:  ${vitals.spo2}%`,
    ].join('\n')
  }

  const duration = formatDuration(Date.now() - startTime)
  const doctorEntries = conversation.filter(e => e.speaker === 'Doctor')
  const patientEntries = conversation.filter(e => e.speaker === 'Patient')

  const allSentences = conversation.flatMap(e =>
    extractSentences(e.text).map(s => ({
      text: s,
      speaker: e.speaker,
      score: scoreText(s),
    }))
  )

  const topStatements = [...allSentences]
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => `  \u2022 [${s.speaker}] ${s.text.length > 110 ? s.text.slice(0, 110) + '\u2026' : s.text}`)

  const chiefComplaint = patientEntries[0]?.text ?? 'Not verbally documented'
  const truncatedCC =
    chiefComplaint.length > 140 ? chiefComplaint.slice(0, 140) + '\u2026' : chiefComplaint

  const detectedTopics = CLINICAL_PATTERNS
    .filter(({ re }) => conversation.some(e => re.test(e.text)))
    .map(({ label }) => label)

  return [
    `\u2500\u2500 VISIT SUMMARY \u2500\u2500`,
    `Duration:       ${duration}`,
    `Doctor turns:   ${doctorEntries.length}`,
    `Patient turns:  ${patientEntries.length}`,
    '',
    `CHIEF COMPLAINT`,
    truncatedCC,
    '',
    `CLINICAL TOPICS DETECTED`,
    detectedTopics.length > 0 ? detectedTopics.join(', ') : 'None identified',
    '',
    `KEY STATEMENTS`,
    topStatements.length > 0
      ? topStatements.join('\n')
      : '  \u2022 No high-relevance statements detected',
    '',
    `VITALS AT CLOSE`,
    `  BP:    ${vitals.systolic}/${vitals.diastolic} mmHg`,
    `  SpO\u2082:  ${vitals.spo2}%`,
    '',
    `\u26A0  AI-assisted draft \u2014 requires physician review before use in medical records.`,
  ].join('\n')
}
