import heroImage from './assets/NewHero.png'

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
      padding: '40px 20px 0',
    }}>
      <header
        style={{
          maxWidth: '900px',
          width: '100%',
          marginBottom: '40px',
          borderRadius: '12px',
          border: '1px solid rgba(172, 203, 255, 0.25)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img
          src={heroImage}
          alt=""
          style={{
            width: '100%',
            height: 'clamp(180px, 32vw, 340px)',
            objectFit: 'cover',
            objectPosition: 'center 35%',
            display: 'block',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(180deg, transparent 0%, transparent 35%, rgba(6, 13, 20, 0.55) 78%, rgba(6, 13, 20, 0.92) 100%)',
          }}
        />
        <p
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '28px',
            margin: 0,
            padding: '0 24px',
            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            fontWeight: 700,
            color: '#cfe8ff',
            letterSpacing: '0.04em',
            textAlign: 'center',
            textShadow: '0 2px 16px rgba(0, 0, 0, 0.65)',
          }}
        >
          MedARView
        </p>
      </header>

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
        marginTop: '20px'
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