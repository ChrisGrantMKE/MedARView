import { useState } from 'react'
import newHeroURL from './assets/NewHERO.png'

const OLD_TEXT = [
  {
    heading: 'Welcome to MedARView',
    body: 'Please press Continue to begin.',
  },
  {
    heading: null,
    body: 'Physicians are losing the ability to be fully present with their patients. Screen-based documentation pulls their attention away during every consultation, reducing eye contact, eroding trust and driving burnout.',
  },
  {
    heading: null,
    body: "MedARView restores presence by moving clinical intelligence into the doctor's field of vision, enabling eye-contact-first care while eliminating the documentation burden that follows every patient encounter.",
  },
  {
    heading: 'Recording & Data Notice',
    body: 'This app uses your microphone to capture and transcribe conversation audio during a visit session.\n\nAudio is streamed to a third-party speech recognition service for transcription and speaker identification. Transcripts are stored temporarily for this session only and are not transmitted to any additional parties.\n\nThis is a test environment using mock data only. Do not conduct real patient visits using this prototype.\n\nBy pressing Accept & Continue you consent to microphone capture and transcription for the duration of this demo session.',
  },
]

function LandingPage({ onEnterExperience }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#060d14',
      color: '#f3f7fc',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      padding: '40px 20px',
    }}>
      {/* Hero Image */}
      <img
        src={newHeroURL}
        alt="MedARView Hero"
        style={{
          maxWidth: '100%',
          height: 'auto',
          marginBottom: '40px',
        }}
      />

      {/* Container for text and video */}
      <div style={{
        maxWidth: '900px',
        width: '100%',
      }}>
        {/* Vimeo Video - full width of text container */}
        <div style={{
          marginBottom: '40px',
          paddingBottom: '56.25%',
          position: 'relative',
          height: 0,
          overflow: 'hidden',
        }}>
          <iframe
            title="vimeo-player"
            src="https://player.vimeo.com/video/1187559582?h=0f2bfb43f0"
            frameBorder="0"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          ></iframe>
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: '#cfe8ff',
          margin: '30px 0 15px 0',
          lineHeight: '1.2',
        }}>
          Welcome to MedARView
        </h1>

        {/* First body copy */}
        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '30px',
          whiteSpace: 'pre-wrap',
        }}>
          Physicians are losing the ability to be fully present with their patients. Screen-based documentation pulls their attention away during every consultation, reducing eye contact, eroding trust and driving burnout.
        </p>

        
        {/* First body copy */}
        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '30px',
          whiteSpace: 'pre-wrap',
        }}>
          MedARView restores presence by moving clinical intelligence into the doctor's field of vision, enabling eye-contact-first care while eliminating the documentation burden that follows every patient encounter.
        </p>

        {/* H2 */}
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: 600,
          color: '#cfe8ff',
          margin: '30px 0 15px 0',
          lineHeight: '1.2',
        }}>
          Recording & Data Notice
        </h2>

        {/* Second body copy */}
        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '40px',
          whiteSpace: 'pre-wrap',
        }}>
          This app uses your microphone to capture and transcribe conversation audio during a visit session. Audio is streamed to a third-party speech recognition service for transcription and speaker identification. Transcripts are stored temporarily for this session only and are not transmitted to any additional parties.
        </p>
    

              {/* Second body copy */}
        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '40px',
          whiteSpace: 'pre-wrap',
        }}>
          This is a test environment using mock data only. Do not conduct real patient visits using this prototype. By pressing Accept & Continue you consent to microphone capture and transcription for the duration of this demo session.
        </p>
      </div>

      {/* Enter Experience Button - full width of text container */}
      <div style={{
        maxWidth: '900px',
        width: '100%',
        marginTop: '20px',
      }}>
        <button
          onClick={onEnterExperience}
          style={{
            width: '100%',
            background: '#ffffff',
            color: '#060d14',
            border: 'none',
            padding: '15px 30px',
            fontSize: '1.1rem',
            fontWeight: 600,
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseOver={(e) => e.target.style.background = '#e8f4ff'}
          onMouseOut={(e) => e.target.style.background = '#ffffff'}
        >
          Enter Experience
        </button>
      </div>
    </div>
  )
}


export default LandingPage