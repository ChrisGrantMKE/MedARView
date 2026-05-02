/**
 * MedARView – Visit Export
 *
 * Sends completed visit data to the local speech gateway for persistence.
 * The gateway writes four files per visit under server/.data/visits/<folder>/:
 *
 *   transcript.json  — raw conversation array, vitals, and timestamps
 *   meta.json        — duration, turn counts, vitals summary
 *   soap-note.md     — SOAP draft wrapped in a dated markdown document
 *   transcript.md    — full Doctor/Patient conversation in chat markdown format
 *
 * Folder name format: DD-MM-YYYY_HHMMSS (derived from session startedAt)
 *
 * The gateway base URL defaults to http://localhost:8787 and can be overridden
 * via the VITE_GATEWAY_URL environment variable.
 */

/**
 * In dev, default to same-origin `/api/gateway` (Vite proxies to the speech gateway on the dev PC).
 * On Quest/LAN, never use `localhost` — it refers to the headset, not your machine.
 * Override with `VITE_GATEWAY_URL` (e.g. `http://192.168.1.10:8787`) when not using the proxy.
 */
function getGatewayBase() {
  const fromEnv = import.meta.env.VITE_GATEWAY_URL
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return '/api/gateway'
  }
  return ''
}

/**
 * @param {object} params
 * @param {string} params.visitId        - Unique visit identifier
 * @param {Array}  params.conversation   - Array of { id, speaker, text, timestamp } entries
 * @param {string} params.soapText       - Formatted SOAP draft string from generateAbstract()
 * @param {object} params.vitals         - { systolic, diastolic, spo2 }
 * @param {number} params.startedAt      - Session start timestamp (ms)
 * @param {number} params.endedAt        - Session end timestamp (ms)
 * @returns {Promise<{ ok: boolean, visitId: string, folder: string, files: string[] }>}
 */
export async function saveVisit({ visitId, conversation, soapText, vitals, startedAt, endedAt }) {
  const base = getGatewayBase()
  if (!base) {
    throw new Error(
      'Visit save URL not configured. Set VITE_GATEWAY_URL at build time to your speech gateway (e.g. https://your-host:8787).',
    )
  }

  let res
  try {
    res = await fetch(`${base}/visits/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, conversation, soapText, vitals, startedAt, endedAt }),
    })
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        'Could not reach the speech gateway for saving. Run `npm run full` (starts gateway + Vite proxy), or set VITE_GATEWAY_URL to http://<your-PC-LAN-IP>:8787 and rebuild — never use localhost from Quest/phone.',
        { cause: err },
      )
    }
    throw err
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gateway returned ${res.status}`)
  }

  return res.json()
}
