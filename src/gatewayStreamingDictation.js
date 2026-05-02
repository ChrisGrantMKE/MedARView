/**
 * Streams microphone audio (WebM/Opus chunks) to `speechGateway.mjs` WebSocket STT.
 * Meta Quest Browser has no Web Speech API — this path uses getUserMedia + gateway instead.
 */

/** Map Google diarization labels / tags to Doctor | Patient */
export function mapGatewaySpeakerLabel(raw, previousSpeaker) {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s.includes('patient') || s === '2' || s === 'speaker 2' || s === 'speaker_2') return 'Patient'
  if (s.includes('doctor') || s.includes('physician') || s.includes('clinician')) return 'Doctor'
  if (s === '1' || s === 'speaker 1' || s === 'speaker_1') return 'Doctor'
  if (s === 'unknown' || s === '' || s === 'unknown speaker') {
    return previousSpeaker === 'Doctor' ? 'Patient' : 'Doctor'
  }
  return previousSpeaker === 'Doctor' ? 'Patient' : 'Doctor'
}

/**
 * @param {object} opts
 * @param {string} opts.wsUrl - e.g. wss://host/api/gateway-ws/ws/stt
 * @param {(msg: object) => void} opts.onMessage - parsed JSON from gateway (ready | transcript | error)
 * @param {(err: Error) => void} [opts.onError]
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startGatewayDictation({ wsUrl, onMessage, onError }) {
  if (!wsUrl) {
    const err = new Error('WebSocket URL is empty.')
    onError?.(err)
    throw err
  }

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    onError?.(err)
    throw err
  }

  const ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  await new Promise((resolve, reject) => {
    const to = window.setTimeout(() => reject(new Error('WebSocket open timeout')), 20000)
    ws.onopen = () => {
      window.clearTimeout(to)
      resolve()
    }
    ws.onerror = () => {
      window.clearTimeout(to)
      reject(new Error('WebSocket connection failed'))
    }
  })

  const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm']
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

  recorder.ondataavailable = async (ev) => {
    if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) {
      const buf = await ev.data.arrayBuffer()
      ws.send(buf)
    }
  }

  recorder.start(250)

  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return
    try {
      const msg = JSON.parse(ev.data)
      onMessage(msg)
    } catch {
      /* ignore */
    }
  }

  ws.onclose = () => {
    try {
      recorder.stop()
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop())
  }

  const stop = () => {
    try {
      recorder.stop()
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop())
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }

  return { stop }
}
