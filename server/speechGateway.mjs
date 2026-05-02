import 'dotenv/config'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'fluent-ffmpeg'
import speech from '@google-cloud/speech'
import { WebSocketServer } from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '.data')
const usageFile = path.join(dataDir, 'speech-budget.json')
const visitsDir = path.join(dataDir, 'visits')

const port = Number(process.env.MEDARVIEW_SPEECH_GATEWAY_PORT || 8787)
const budgetMinutes = Number(process.env.MEDARVIEW_SPEECH_BUDGET_MINUTES || 60)
const budgetWindowDays = Number(process.env.MEDARVIEW_SPEECH_BUDGET_WINDOW_DAYS || 30)
const provider = process.env.MEDARVIEW_DICTATION_PROVIDER || 'google-medical-proxy'
const googleSpeechEnabled = String(process.env.MEDARVIEW_ENABLE_GOOGLE_SPEECH || 'false').toLowerCase() === 'true'
const googleRecognizerPath = process.env.MEDARVIEW_GOOGLE_RECOGNIZER || ''
const sttWsPath = process.env.MEDARVIEW_SPEECH_WS_PATH || '/ws/stt'
const sttLanguageCode = process.env.MEDARVIEW_SPEECH_LANGUAGE || 'en-US'
const sttModel = process.env.MEDARVIEW_GOOGLE_MODEL || 'latest_long'

const { SpeechClient: SpeechClientV2 } = speech.v2
const speechClient = googleSpeechEnabled ? new SpeechClientV2() : null

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

function sendWsJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function closeQuietly(stream) {
  if (!stream) return
  try {
    stream.end()
  } catch (_) {
    // Ignore cleanup errors on stream shutdown.
  }
}

function createGoogleStreamingSession(ws) {
  if (!speechClient) {
    return null
  }

  const stream = speechClient
    .streamingRecognize()
    .on('error', (error) => {
      sendWsJson(ws, {
        type: 'error',
        message: error?.message || 'Google streaming recognition error.',
      })
    })
    .on('data', (data) => {
      const result = data?.results?.[0]
      const alternative = result?.alternatives?.[0]

      if (!alternative?.transcript) {
        return
      }

      const words = Array.isArray(alternative.words) ? alternative.words : []
      const lastWord = words[words.length - 1]
      const speaker = lastWord?.speakerLabel || (Number.isFinite(lastWord?.speakerTag) ? String(lastWord.speakerTag) : 'Unknown')

      sendWsJson(ws, {
        type: 'transcript',
        text: alternative.transcript,
        isFinal: Boolean(result?.isFinal),
        speaker,
        confidence: typeof alternative.confidence === 'number' ? alternative.confidence : null,
      })
    })

  stream.write({
    recognizer: googleRecognizerPath,
    streamingConfig: {
      config: {
        explicitDecodingConfig: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          audioChannelCount: 1,
        },
        languageCodes: [sttLanguageCode],
        model: sttModel,
        features: {
          enableAutomaticPunctuation: true,
          diarizationConfig: {
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
          },
        },
      },
      streamingFeatures: {
        interimResults: true,
      },
    },
  })

  return stream
}

function bindRealtimeSttConnection(ws) {
  if (!googleSpeechEnabled) {
    sendWsJson(ws, {
      type: 'error',
      message: 'Google speech integration is disabled by server config.',
    })
    ws.close(1011, 'Google speech disabled')
    return
  }

  if (!googleRecognizerPath) {
    sendWsJson(ws, {
      type: 'error',
      message: 'MEDARVIEW_GOOGLE_RECOGNIZER is not configured.',
    })
    ws.close(1011, 'Recognizer not configured')
    return
  }

  const audioInputStream = new PassThrough()
  const audioOutputStream = new PassThrough()
  const recognizeStream = createGoogleStreamingSession(ws)

  ffmpeg(audioInputStream)
    .inputFormat('webm')
    .audioCodec('pcm_s16le')
    .audioFrequency(16000)
    .audioChannels(1)
    .format('s16le')
    .on('error', (err) => {
      if (String(err?.message || '').includes('Premature close')) {
        return
      }

      sendWsJson(ws, {
        type: 'error',
        message: `FFmpeg processing error: ${err?.message || 'unknown error'}`,
      })
    })
    .pipe(audioOutputStream)

  const onAudio = (chunk) => {
    if (recognizeStream && !recognizeStream.destroyed) {
      recognizeStream.write({ audio: chunk })
    }
  }

  audioOutputStream.on('data', onAudio)

  sendWsJson(ws, {
    type: 'ready',
    path: sttWsPath,
    recognizerConfigured: true,
    model: sttModel,
    languageCode: sttLanguageCode,
  })

  ws.on('message', (message, isBinary) => {
    if (!isBinary) {
      return
    }

    const chunk = Buffer.isBuffer(message) ? message : Buffer.from(message)
    audioInputStream.write(chunk)
  })

  ws.on('close', () => {
    audioOutputStream.off('data', onAudio)
    closeQuietly(audioInputStream)
    closeQuietly(audioOutputStream)
    closeQuietly(recognizeStream)
  })

  ws.on('error', () => {
    audioOutputStream.off('data', onAudio)
    closeQuietly(audioInputStream)
    closeQuietly(audioOutputStream)
    closeQuietly(recognizeStream)
  })
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
      googleSpeechEnabled,
      googleRecognizerConfigured: Boolean(googleRecognizerPath),
      googleCredentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      sttWebSocketPath: sttWsPath,
      note: 'Budget-aware local speech gateway with optional Google Speech v2 real-time WebSocket streaming.',
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
    if (!googleSpeechEnabled) {
      json(res, 503, {
        error: 'Google speech integration is disabled by server config.',
        nextStep: 'Set MEDARVIEW_ENABLE_GOOGLE_SPEECH=true when you want full dictation services enabled.',
      })
      return
    }

    json(res, 501, {
      error: 'HTTP diarize endpoint is not implemented for audio streams.',
      nextStep: `Use the WebSocket endpoint at ${sttWsPath} for real-time transcription streaming.`,
    })
    return
  }

  json(res, 404, { error: 'Not found.' })
})

const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws) => {
  bindRealtimeSttConnection(ws)
})

server.on('upgrade', (req, socket, head) => {
  const host = req.headers.host || `localhost:${port}`
  const url = new URL(req.url || '/', `http://${host}`)

  if (url.pathname !== sttWsPath) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  if (!googleSpeechEnabled) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n')
    socket.destroy()
    return
  }

  if (!googleRecognizerPath) {
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

server.listen(port, () => {
  console.log(`MedARView speech gateway listening on http://localhost:${port}`)
})