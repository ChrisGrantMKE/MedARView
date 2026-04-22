import { useEffect, useMemo, useState } from 'react'
import { generateAbstract } from './summarize'

function SessionEndScreen({ conversation, vitals, sessionStartTime }) {
  const [screenPhase, setScreenPhase] = useState('closing')

  useEffect(() => {
    const t = setTimeout(() => setScreenPhase('review'), 3200)
    return () => clearTimeout(t)
  }, [])

  const abstract = useMemo(
    () => generateAbstract(conversation, vitals, sessionStartTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (screenPhase === 'closing') {
    return (
      <div className="session-end closing">
        <div className="closing-message">
          <p>Glasses being taken off.</p>
          <p>Notes being exported for the Doctor.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="session-end review">
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
        <p className="summarization-note">
          Summary generated with extractive keyword scoring.{' '}
          Upgrade to{' '}
          <a
            href="https://github.com/xenova/transformers.js"
            target="_blank"
            rel="noreferrer"
          >
            Transformers.js
          </a>{' '}
          (in-browser LLM) or OpenAI GPT-4o for production-quality clinical notes.
        </p>
      </div>
    </div>
  )
}

export default SessionEndScreen
