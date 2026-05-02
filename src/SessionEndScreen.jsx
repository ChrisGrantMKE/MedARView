import { useEffect, useMemo, useRef, useState } from 'react'
import { generateAbstract } from './summarize'
import { saveVisit } from './visitExport'

const CLOSING_DOT_INTERVAL_MS = 900

function SessionEndScreen({ conversation, vitals, sessionStartTime, onReturnHome }) {
  const [screenPhase, setScreenPhase] = useState('closing')
  const [closingDotsShown, setClosingDotsShown] = useState(0)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null)

  const visitIdRef = useRef(`visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const endedAtRef = useRef(Date.now())

  useEffect(() => {
    const t = setTimeout(() => setScreenPhase('review'), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const timers = []
    for (let i = 1; i <= 5; i++) {
      timers.push(
        window.setTimeout(() => setClosingDotsShown(i), (i - 1) * CLOSING_DOT_INTERVAL_MS),
      )
    }
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  const abstract = useMemo(
    () => generateAbstract(conversation, vitals, sessionStartTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  async function handleSave() {
    if (saveState === 'saving' || saveState === 'saved') return
    setSaveState('saving')
    setSaveError(null)
    try {
      await saveVisit({
        visitId: visitIdRef.current,
        conversation,
        soapText: abstract,
        vitals,
        startedAt: sessionStartTime,
        endedAt: endedAtRef.current,
      })
      setSaveState('saved')
    } catch (err) {
      setSaveError(err.message)
      setSaveState('error')
    }
  }

  if (screenPhase === 'closing') {
    return (
      <div className="session-end closing">
        <div className="closing-message">
          <p>Glasses being taken off.</p>
          <p>Notes being exported for the Doctor.</p>
          <div className="closing-dots" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`closing-dot${closingDotsShown >= n ? ' closing-dot--on' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="session-end review">
      <div className="session-end-review-main">
      {/* ── Left: Full Transcript ── */}
      <div className="review-panel transcript-panel">
        <h2 className="panel-heading">Full Transcript</h2>
        <div className="transcript-entries">
          {conversation.length === 0 ? (
            <p className="empty-note">No conversation was recorded during this session.</p>
          ) : (
            conversation.map(entry => (
              <div
                key={entry.id}
                className={`transcript-entry ${entry.speaker === 'Doctor' ? 'doctor' : 'patient'}`}
              >
                <span className="speaker-label">{entry.speaker}</span>
                <span className="entry-text">{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Visit Abstract ── */}
      <div className="review-panel abstract-panel">
        <h2 className="panel-heading">Visit Abstract</h2>
        <pre className="abstract-content">{abstract}</pre>
        <div className="save-visit-row">
          <button
            className={`save-visit-btn save-visit-btn--${saveState}`}
            onClick={handleSave}
            disabled={saveState === 'saving' || saveState === 'saved'}
          >
            {saveState === 'idle' && 'Save Visit Records'}
            {saveState === 'saving' && 'Saving\u2026'}
            {saveState === 'saved' && 'Saved \u2713'}
            {saveState === 'error' && 'Retry Save'}
          </button>
          {saveState === 'saved' && (
            <span className="save-visit-note">
              transcript.json &middot; meta.json &middot; soap-note.md &middot; transcript.md
            </span>
          )}
          {saveState === 'error' && (
            <span className="save-visit-error">{saveError}</span>
          )}
        </div>
        <p className="summarization-note">
          Summary generated client-side using extractive keyword scoring.
          No transcript data is sent to any external service for summarization.
          {' '}
          Upgrade options: in-browser LLM via{' '}
          <a
            href="https://github.com/xenova/transformers.js"
            target="_blank"
            rel="noreferrer"
          >
            Transformers.js
          </a>
          {' '}(fully private, no API), or a server-side GPT-4o endpoint for
          production-quality SOAP notes.
        </p>
      </div>
      </div>

      <footer className="session-end-footer">
        <button type="button" className="session-end-footer__btn" onClick={onReturnHome}>
          Return to home page
        </button>
      </footer>
    </div>
  )
}

export default SessionEndScreen
