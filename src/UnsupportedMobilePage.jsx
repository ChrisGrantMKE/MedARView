export default function UnsupportedMobilePage() {
  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#03080f',
        backgroundImage: `
          radial-gradient(ellipse 120% 80% at 50% 20%, rgba(30, 60, 100, 0.45), transparent 55%),
          radial-gradient(ellipse 90% 60% at 80% 90%, rgba(20, 45, 75, 0.5), transparent 50%),
          linear-gradient(165deg, #050a12 0%, #0a1522 45%, #060d14 100%)
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        color: '#f3f8ff',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(520px, 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(172, 203, 255, 0.45)',
          background: 'rgba(7, 17, 29, 0.88)',
          backdropFilter: 'blur(6px)',
          padding: '24px 20px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#cfe8ff' }}>Unsupported Mobile View</h1>
        <p style={{ margin: '14px 0 0', lineHeight: 1.5 }}>
          MedARView does not currently support screens under 690px wide.
        </p>
        <p style={{ margin: '10px 0 0', lineHeight: 1.5, color: '#9dbfe8' }}>
          Please open this experience on a tablet, laptop, desktop, or AR-capable headset browser.
        </p>
      </section>
    </main>
  )
}
