import heroImage from './assets/NewHero.png'

function LandingPage({ onEnterExperience }) {
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      boxSizing: 'border-box',
      background: '#060d14',
      color: '#f3f7fc',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      overflowY: 'auto',
      padding: '40px 20px 0',
      position: 'relative',
      zIndex: 1,
    }}>
      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto 40px',
          flexShrink: 0,
        }}
      >
        <header
          style={{
            width: '100%',
            borderRadius: '12px',
            border: '1px solid rgba(172, 203, 255, 0.25)',
            overflow: 'hidden',
            position: 'relative',
            background: '#0a0c10',
          }}
        >
          <img
            src={heroImage}
            alt="MedARView — See Patients. Not Just Symptoms."
            width={1200}
            height={400}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: 'min(420px, 42vw)',
              minHeight: '140px',
              objectFit: 'contain',
              objectPosition: 'center center',
              display: 'block',
            }}
          />
        </header>
      </div>

      <div style={{
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto',
        flexShrink: 0,
      }}>
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
          />
        </div>

        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: '#cfe8ff',
          margin: '30px 0 15px 0',
          lineHeight: '1.2',
        }}>
          Welcome to MedARView
        </h1>

        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '30px',
          whiteSpace: 'pre-wrap',
        }}>
          Physicians are losing the ability to be fully present with their patients. Screen-based documentation pulls their attention away during every consultation, reducing eye contact, eroding trust and driving burnout.
        </p>

        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '30px',
          whiteSpace: 'pre-wrap',
        }}>
          MedARView restores presence by moving clinical intelligence into the doctor's field of vision, enabling eye-contact-first care while eliminating the documentation burden that follows every patient encounter.
        </p>

        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: 600,
          color: '#cfe8ff',
          margin: '30px 0 15px 0',
          lineHeight: '1.2',
        }}>
          Recording & Data Notice
        </h2>

        <p style={{
          fontSize: '1rem',
          color: '#f3f8ff',
          lineHeight: '1.6',
          marginBottom: '40px',
          whiteSpace: 'pre-wrap',
        }}>
          This app uses your microphone to capture and transcribe conversation audio during a visit session. Audio is streamed to a third-party speech recognition service for transcription and speaker identification. Transcripts are stored temporarily for this session only and are not transmitted to any additional parties.
        </p>

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

      <div style={{
        maxWidth: '900px',
        width: '100%',
        margin: '20px auto 0',
        flexShrink: 0,
      }}>
        <button
          type="button"
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
          onMouseOver={(e) => { e.target.style.background = '#e8f4ff' }}
          onMouseOut={(e) => { e.target.style.background = '#ffffff' }}
        >
          Enter Experience
        </button>
      </div>
      <footer
        style={{
          marginTop: 'auto',
          width: '100%',
          minHeight: '200px',
          borderTop: '1px solid rgba(186, 216, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9dbfe8',
          fontSize: '0.9rem',
        }}
      >
        MedARView
      </footer>
    </div>
  )
}

export default LandingPage
