import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '.data')
const usageFile = path.join(dataDir, 'speech-budget.json')
const visitsDir = path.join(dataDir, 'visits')

const port = Number(process.env.MEDARVIEW_SPEECH_GATEWAY_PORT || 8787)
const budgetMinutes = Number(process.env.MEDARVIEW_SPEECH_BUDGET_MINUTES || 60)
const budgetWindowDays = Number(process.env.MEDARVIEW_SPEECH_BUDGET_WINDOW_DAYS || 30)
const provider = process.env.MEDARVIEW_DICTATION_PROVIDER || 'google-medical-proxy'

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload, null, 2))
}

// ── Visit folder helpers ─────────────────────────────────────────────────

function formatFolderName(ts) {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy}_${hh}${min}${ss}`
}

function formatDurationMs(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function buildSoapMd(visitId, soapText, startedAt, endedAt) {
  return [
    '# Visit SOAP Note',
    '',
    `**Visit ID:** \`${visitId}\`  `,
    `**Date:** ${formatDateTime(startedAt)}  `,
    `**Duration:** ${formatDurationMs(endedAt - startedAt)}`,
    '',
    '---',
    '',
    '```',
    soapText ?? '(no summary generated)',
    '```',
    '',
    '---',
    '',
    '_AI-assisted draft — requires physician review before use in medical records._',
  ].join('\n')
}

function buildTranscriptMd(visitId, conversation, startedAt, endedAt) {
  const lines = [
    '# Visit Transcript',
    '',
    `**Visit ID:** \`${visitId}\`  `,
    `**Date:** ${formatDateTime(startedAt)}  `,
    `**Duration:** ${formatDurationMs(endedAt - startedAt)}  `,
    `**Turns:** ${conversation.length}`,
    '',
    '---',
    '',
  ]

  if (conversation.length === 0) {
    lines.push('_No conversation was recorded during this session._')
  } else {
    for (const entry of conversation) {
      lines.push(`**${entry.speaker}**`)
      lines.push(`> ${entry.text}`)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('_Speaker attribution is AI-assisted and may contain errors. Not for use in medical records without physician review._')
  return lines.join('\n')
}

// ── Budget helpers ────────────────────────────────────────────────────────

function getCutoff() {
  return Date.now() - budgetWindowDays * 24 * 60 * 60 * 1000
}

function normalizeSessions(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((session) => Number.isFinite(session?.startedAt) && Number.isFinite(session?.elapsedMs) && session.elapsedMs > 0)
}

async function readUsage() {
  await mkdir(dataDir, { recursive: true })

  try {
    const raw = await readFile(usageFile, 'utf8')
    const parsed = JSON.parse(raw)
    return normalizeSessions(parsed.sessions)
  } catch (_) {
    return []
  }
}

async function writeUsage(sessions) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(usageFile, JSON.stringify({ sessions }, null, 2), 'utf8')
}

async function getSnapshot() {
  const sessions = (await readUsage()).filter((session) => session.startedAt >= getCutoff())
  const usedMs = sessions.reduce((total, session) => total + session.elapsedMs, 0)
  const remainingMs = Math.max(0, budgetMinutes * 60 * 1000 - usedMs)

  return {
    provider,
    budgetMinutes,
    budgetWindowDays,
    usedMs,
    usedMinutes: usedMs / 60000,
    remainingMs,
    remainingMinutes: remainingMs / 60000,
    exhausted: remainingMs <= 0,
    sessions,
  }
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, {
      ok: true,
      provider,
      googleCredentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      note: 'Budget-aware local speech gateway scaffold for MedARView test environments.',
    })
    return
  }

  if (req.method === 'GET' && req.url === '/usage') {
    json(res, 200, await getSnapshot())
    return
  }

  if (req.method === 'POST' && req.url === '/usage/record') {
    try {
      const body = await readBody(req)
      const startedAt = Number(body.startedAt)
      const elapsedMs = Number(body.elapsedMs)

      if (!Number.isFinite(startedAt) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        json(res, 400, { error: 'startedAt and elapsedMs must be positive numbers.' })
        return
      }

      const sessions = (await readUsage()).filter((session) => session.startedAt >= getCutoff())
      sessions.push({ startedAt, elapsedMs })
      await writeUsage(sessions)

      json(res, 200, await getSnapshot())
    } catch (error) {
      json(res, 400, { error: error?.message || 'Invalid JSON body.' })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/visits/save') {
    try {
      const body = await readBody(req)
      const { visitId, conversation, soapText, vitals, startedAt, endedAt } = body

      if (!Array.isArray(conversation)) {
        json(res, 400, { error: 'conversation must be an array.' })
        return
      }
      if (!Number.isFinite(Number(startedAt)) || !Number.isFinite(Number(endedAt))) {
        json(res, 400, { error: 'startedAt and endedAt must be finite numbers.' })
        return
      }

      const folderName = formatFolderName(Number(startedAt))
      const visitDir = path.join(visitsDir, folderName)
      await mkdir(visitDir, { recursive: true })

      const durationMs = Number(endedAt) - Number(startedAt)

      await writeFile(
        path.join(visitDir, 'transcript.json'),
        JSON.stringify({ visitId, startedAt, endedAt, vitals, conversation }, null, 2),
        'utf8'
      )

      await writeFile(
        path.join(visitDir, 'meta.json'),
        JSON.stringify({
          visitId,
          startedAt,
          endedAt,
          durationMs,
          durationFormatted: formatDurationMs(durationMs),
          doctorTurns: conversation.filter(e => e.speaker === 'Doctor').length,
          patientTurns: conversation.filter(e => e.speaker === 'Patient').length,
          vitals,
        }, null, 2),
        'utf8'
      )

      await writeFile(
        path.join(visitDir, 'soap-note.md'),
        buildSoapMd(visitId, soapText, Number(startedAt), Number(endedAt)),
        'utf8'
      )

      await writeFile(
        path.join(visitDir, 'transcript.md'),
        buildTranscriptMd(visitId, conversation, Number(startedAt), Number(endedAt)),
        'utf8'
      )

      json(res, 200, {
        ok: true,
        visitId,
        folder: folderName,
        files: ['transcript.json', 'meta.json', 'soap-note.md', 'transcript.md'],
      })
    } catch (error) {
      json(res, 500, { error: error?.message || 'Failed to save visit.' })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/diarize') {
    json(res, 501, {
      error: 'Streaming transcription proxy not implemented yet.',
      nextStep: 'Wire this gateway to Google Cloud Speech-to-Text medical_conversation streaming and return speaker-labeled transcript segments.',
    })
    return
  }

  json(res, 404, { error: 'Not found.' })
})

server.listen(port, () => {
  console.log(`MedARView speech gateway listening on http://localhost:${port}`)
})