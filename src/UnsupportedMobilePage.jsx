import cellBackground from './assets/mobile-unsupported-bg.png'

/**
 * Small-viewport screen from Figma (node 7:451): white shell, CELL background art,
 * headline + subcopy + primary pill button. Rutledge → system UI stack (no webfont in repo).
 */
export default function UnsupportedMobilePage({ onGoBack }) {
  return (
    <div
      data-node-id="7:451"
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* CELL_BACKGROUND — full-bleed under copy (Figma 8:463) */}
      <div
        data-node-id="8:463"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          minHeight: '100%',
          pointerEvents: 'none',
        }}
      >
        <img
          alt=""
          src={cellBackground}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center bottom',
            maxWidth: 'none',
          }}
        />
      </div>

      {/* TEXT BODY — Figma 7:459 */}
      <div
        data-node-id="7:459"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          minHeight: '224px',
          padding: '10px 24px 0',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-node-id="7:458"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            maxWidth: '560px',
          }}
        >
          <p
            data-node-id="7:454"
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 'clamp(32px, 9vw, 48px)',
              lineHeight: 1.25,
              letterSpacing: '-1px',
              color: '#000000',
              textAlign: 'center',
            }}
          >
            We&apos;re Sorry
          </p>
          <p
            data-node-id="7:456"
            style={{
              margin: 0,
              fontWeight: 400,
              fontSize: 'clamp(17px, 4.5vw, 20px)',
              lineHeight: '26px',
              color: '#000000',
              textAlign: 'center',
            }}
          >
            Cell phones not supported
          </p>

          <div
            data-node-id="9:470"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '24px',
              width: '100%',
            }}
          >
            <button
              type="button"
              data-node-id="9:469"
              onClick={() => onGoBack?.()}
              style={{
                width: '100%',
                maxWidth: '245px',
                minHeight: '44px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '26px',
                backgroundColor: '#269dff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                data-node-id="9:466"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(17px, 4.5vw, 20px)',
                  lineHeight: '26px',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                }}
              >
                Go Back
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
