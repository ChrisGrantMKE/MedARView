import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, createXRStore } from '@react-three/xr'
import HUD from './HUD'
import OnboardingHUD from './OnboardingHUD'
import SessionEndScreen from './SessionEndScreen'
import './App.css'

const xrStore = createXRStore({
  customSessionInit: {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking', 'layers', 'dom-overlay'],
  },
})

const patientRecord = {
  id: 'PT-44812',
  name: 'R. Hernandez',
  age: 63,
  history: 'Type II diabetes, HTN, prior NSTEMI (2021), admitted for dyspnea and edema.',
  aiAbstract:
    'Likely acute decompensated heart failure with elevated cardiopulmonary stress. Continue diuresis protocol, monitor oxygen trend, and reassess BNP/troponin in 6 hours.',
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function App() {
  const [phase, setPhase] = useState('onboarding')
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [vitals, setVitals] = useState({ systolic: 120, diastolic: 80, spo2: 98 })
  const [conversation, setConversation] = useState([])
  const [activeSpeaker, setActiveSpeaker] = useState('Doctor')
  const sessionStartRef = useRef(Date.now())
  const phaseRef = useRef('onboarding')
  const stepRef = useRef(0)
  const speakerRef = useRef('Doctor')
  const recognitionRef = useRef(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { stepRef.current = onboardingStep }, [onboardingStep])
  useEffect(() => { speakerRef.current = activeSpeaker }, [activeSpeaker])

  useEffect(() => {
    const id = setInterval(() => {
      setVitals(prev => ({
        systolic: clamp(prev.systolic + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3)), 108, 132),
        diastolic: clamp(prev.diastolic + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2)), 70, 90),
        spo2: clamp(prev.spo2 + (Math.random() > 0.6 ? 1 : -1), 94, 100),
      }))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event) => {
      let text = ''
      let hasFinal = false
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript
        if (event.results[i].isFinal) hasFinal = true
      }
      const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '')
      const currentPhase = phaseRef.current
      const currentStep = stepRef.current

      if (currentPhase === 'onboarding' && currentStep === 3) {
        if (normalized.includes('begin visit') || normalized.includes('med view') || normalized.includes('medical view')) {
          sessionStartRef.current = Date.now()
          setPhase('active')
        }
        return
      }

      if (currentPhase === 'active' && hasFinal && text.trim()) {
        setConversation(prev => [...prev, {
          id: Date.now(),
          speaker: speakerRef.current,
          text: text.trim(),
          timestamp: Date.now(),
        }])
      }
    }

    rec.onerror = (e) => { if (e.error !== 'no-speech') console.warn('SR error:', e.error) }

    rec.onend = () => {
      if (phaseRef.current !== 'ended') { try { rec.start() } catch (_) {} }
    }

    recognitionRef.current = rec
    try { rec.start() } catch (_) {}
    return () => { try { rec.stop() } catch (_) {} }
  }, [])

  const handleAdvanceOnboarding = () => setOnboardingStep(prev => prev + 1)

  const handleBeginVisit = () => {
    sessionStartRef.current = Date.now()
    setPhase('active')
  }

  const handleEndSimulation = () => {
    try { recognitionRef.current?.stop() } catch (_) {}
    setPhase('ended')
  }

  const handleToggleSpeaker = () => setActiveSpeaker(s => s === 'Doctor' ? 'Patient' : 'Doctor')

  return (
    <main className="app-shell">
      {phase !== 'ended' && (
        <div className="ar-controls">
          <ARButton className="ar-toggle" store={xrStore}>
            {(status) => {
              if (status === 'unsupported') return 'AR Unsupported'
              if (status === 'entered') return 'Exit AR'
              return 'Enter Medical AR HUD'
            }}
          </ARButton>
        </div>
      )}

      {phase !== 'ended' && (
        <Canvas camera={{ position: [0, 1.6, 0], fov: 60 }}>
          <XR store={xrStore}>
            {phase === 'onboarding' && (
              <OnboardingHUD
                step={onboardingStep}
                onContinue={handleAdvanceOnboarding}
                onBeginVisit={handleBeginVisit}
              />
            )}
            {phase === 'active' && (
              <HUD
                vitals={vitals}
                conversation={conversation}
                activeSpeaker={activeSpeaker}
                onToggleSpeaker={handleToggleSpeaker}
                onEndSimulation={handleEndSimulation}
                patient={patientRecord}
              />
            )}
          </XR>
        </Canvas>
      )}

      {phase === 'ended' && (
        <SessionEndScreen
          conversation={conversation}
          vitals={vitals}
          sessionStartTime={sessionStartRef.current}
        />
      )}
    </main>
  )
}

export default App
