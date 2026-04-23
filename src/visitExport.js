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

const GATEWAY_BASE = (import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8787').replace(/\/$/, '')

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
  const res = await fetch(`${GATEWAY_BASE}/visits/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, conversation, soapText, vitals, startedAt, endedAt }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gateway returned ${res.status}`)
  }

  return res.json()
}
