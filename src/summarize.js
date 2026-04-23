/**
 * MedARView – Visit Summarization
 *
 * CURRENT APPROACH: Hybrid extractive-to-SOAP formatter.
 * Every spoken turn is broken into sentences and scored against seven clinical
 * keyword categories. Speaker role (Doctor vs Patient) is already attached by
 * the attribution pipeline. Sentences are routed into SOAP sections by
 * combining category hits with speaker role, then formatted as a structured
 * draft note. Works entirely client-side with no external dependencies, no
 * model download, and no network calls.
 *
 * SOAP routing logic:
 *   S — Patient-speaker sentences matching Pain, Symptoms, or History.
 *       First patient turn is always used as chief complaint.
 *   O — Captured vitals plus full clinical topic list detected in conversation.
 *   A — Doctor-speaker sentences matching Cardiovascular, Respiratory,
 *       Pain, Symptoms, or History.
 *   P — Doctor-speaker sentences matching Medications, or any sentence
 *       containing plan-signal keywords (follow-up, refer, prescribe,
 *       schedule, monitor, recommend, start, continue, stop, taper, etc.).
 *
 * ─── UPGRADE PATHS ───────────────────────────────────────────────────────
 *
 *  Option A — In-browser LLM (no server, fully private):
 *    npm install @xenova/transformers
 *    Use Xenova/distilbart-cnn-6-6 in a Web Worker:
 *
 *      import { pipeline } from '@xenova/transformers'
 *      const summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6')
 *      const [result] = await summarizer(fullText, { max_new_tokens: 150 })
 *      // result.summary_text replaces the formatter below
 *
 *    Tradeoffs: ~250 MB one-time download, 10–30s inference, Quest WASM uncertain.
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
      categories: CLINICAL_PATTERNS.filter(({ re }) => re.test(s)).map(({ label }) => label),
    }))
  )

  const trunc = (s, len = 120) => s.length > len ? s.slice(0, len) + '\u2026' : s

  // S — Subjective: patient-reported symptoms, history, pain
  const SUBJECTIVE_CATS = new Set(['Pain', 'Symptoms', 'History'])
  const chiefComplaint = patientEntries[0]?.text ?? null
  const subjectiveSentences = allSentences
    .filter(s => s.speaker === 'Patient' && s.categories.some(c => SUBJECTIVE_CATS.has(c)))
    .slice(0, 3)

  // O — Objective: vitals + detected topic list
  const detectedTopics = CLINICAL_PATTERNS
    .filter(({ re }) => conversation.some(e => re.test(e.text)))
    .map(({ label }) => label)

  // A — Assessment: doctor statements on clinical categories
  const ASSESSMENT_CATS = new Set(['Cardiovascular', 'Respiratory', 'Pain', 'Symptoms', 'History'])
  const assessmentSentences = allSentences
    .filter(s => s.speaker === 'Doctor' && s.categories.some(c => ASSESSMENT_CATS.has(c)))
    .slice(0, 3)

  // P — Plan: doctor medication statements + plan-signal keywords
  const PLAN_RE = /follow.?up|return|refer|prescri|schedule|monitor|recommend|start|continue|increase|decrease|stop|hold|taper/i
  const planSentences = allSentences
    .filter(s =>
      s.speaker === 'Doctor' &&
      (s.categories.includes('Medications') || PLAN_RE.test(s.text))
    )
    .slice(0, 3)

  // Build SOAP output
  const lines = [
    `\u2500\u2500 VISIT NOTE (DRAFT) \u2500\u2500`,
    `Duration: ${duration}  |  Doctor turns: ${doctorEntries.length}  |  Patient turns: ${patientEntries.length}`,
    '',
    `S \u2014 SUBJECTIVE`,
  ]

  if (chiefComplaint) lines.push(`  Chief complaint: ${trunc(chiefComplaint)}`)
  subjectiveSentences.forEach(s => {
    if (s.text !== chiefComplaint) lines.push(`  ${trunc(s.text)}`)
  })
  if (!chiefComplaint && subjectiveSentences.length === 0) {
    lines.push('  No patient-reported symptoms captured.')
  }

  lines.push('', `O \u2014 OBJECTIVE`)
  lines.push(`  BP: ${vitals.systolic}/${vitals.diastolic} mmHg  |  SpO\u2082: ${vitals.spo2}%`)
  lines.push(
    detectedTopics.length > 0
      ? `  Topics discussed: ${detectedTopics.join(', ')}`
      : '  No clinical topics detected.'
  )

  lines.push('', `A \u2014 ASSESSMENT`)
  if (assessmentSentences.length > 0) {
    assessmentSentences.forEach(s => lines.push(`  ${trunc(s.text)}`))
  } else {
    lines.push('  No physician assessment statements captured.')
  }

  lines.push('', `P \u2014 PLAN`)
  if (planSentences.length > 0) {
    planSentences.forEach(s => lines.push(`  ${trunc(s.text)}`))
  } else {
    lines.push('  No plan or medication statements captured.')
  }

  lines.push(
    '',
    `\u26A0  AI-assisted draft \u2014 requires physician review before use in medical records.`
  )

  return lines.join('\n')
}
