import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, createXRStore } from '@react-three/xr'
import HUD from './HUD'
import OnboardingHUD from './OnboardingHUD'
import SessionEndScreen from './SessionEndScreen'
import { inferSpeaker } from './speakerAttribution'
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
  const [speechSupported, setSpeechSupported] = useState(true)
  const [micPermission, setMicPermission] = useState('unknown')
  const [micStatus, setMicStatus] = useState('idle')
  const [lastHeardCommand, setLastHeardCommand] = useState('')
  const [speakerAttributionStatus, setSpeakerAttributionStatus] = useState('Awaiting speech...')
  const [arSupport, setArSupport] = useState({
    checked: false,
    supported: false,
    reason: 'Checking immersive-ar support...',
  })
  const sessionStartRef = useRef(Date.now())
  const phaseRef = useRef('onboarding')
  const stepRef = useRef(0)
  const speakerRef = useRef('Doctor')
  const conversationRef = useRef([])
  const recognitionRef = useRef(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { stepRef.current = onboardingStep }, [onboardingStep])
  useEffect(() => { speakerRef.current = activeSpeaker }, [activeSpeaker])
  useEffect(() => { conversationRef.current = conversation }, [conversation])

  useEffect(() => {
    const checkAr = async () => {
      if (!window.isSecureContext) {
        setArSupport({
          checked: true,
          supported: false,
          reason: 'WebXR AR requires HTTPS (or localhost). Current page is not secure.',
        })
        return
      }

      if (!navigator.xr || !navigator.xr.isSessionSupported) {
        setArSupport({
          checked: true,
          supported: false,
          reason: 'navigator.xr is unavailable in this browser/runtime.',
        })
        return
      }

      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar')
        setArSupport({
          checked: true,
          supported,
          reason: supported
            ? 'immersive-ar supported. Use Enter Medical AR HUD.'
            : 'immersive-ar not reported by browser. Check Quest Browser flags and HTTPS.',
        })
      } catch (err) {
        setArSupport({
          checked: true,
          supported: false,
          reason: `AR capability check error: ${err?.message ?? 'unknown error'}`,
        })
      }
    }

    checkAr()
  }, [])

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
    if (!SR) {
      setSpeechSupported(false)
      setMicStatus('error')
      setLastHeardCommand('SpeechRecognition API unavailable in this browser.')
      return
    }

    const checkMicPermission = async () => {
      if (!navigator.permissions?.query) return
      try {
        const status = await navigator.permissions.query({ name: 'microphone' })
        setMicPermission(status.state)
        status.onchange = () => setMicPermission(status.state)
      } catch (_) {
        // Permissions API is not always available for microphone.
      }
    }

    checkMicPermission()

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    setMicStatus('starting')

    rec.onresult = (event) => {
      let text = ''
      let hasFinal = false
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript
        if (event.results[i].isFinal) hasFinal = true
      }

      if (text.trim()) {
        setLastHeardCommand(text.trim())
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
        const utterance = text.trim()
        setSpeakerAttributionStatus('Analyzing speaker...')

        void (async () => {
          const attribution = await inferSpeaker({
            utterance,
            conversation: conversationRef.current,
            previousSpeaker: speakerRef.current,
          })

          setActiveSpeaker(attribution.speaker)
          setSpeakerAttributionStatus(
            `${attribution.source} | ${attribution.speaker} (${Math.round(attribution.confidence * 100)}%)`
          )

          setConversation(prev => [
            ...prev,
            {
              id: Date.now(),
              speaker: attribution.speaker,
              text: utterance,
              timestamp: Date.now(),
            },
          ])
        })()
      }
    }

    rec.onerror = (e) => {
      setMicStatus('error')
      setLastHeardCommand(`Mic error: ${e.error}`)
      if (e.error !== 'no-speech') console.warn('SR error:', e.error)
    }

    rec.onstart = () => {
      setMicStatus('listening')
    }

    rec.onend = () => {
      if (phaseRef.current !== 'ended') {
        setMicStatus('starting')
        try {
          rec.start()
        } catch (_) {
          setMicStatus('error')
        }
      }
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch (_) {
      setMicStatus('error')
    }

    return () => {
      try {
        rec.stop()
      } catch (_) {
        // ignore
      }
    }
  }, [])

  const handleAdvanceOnboarding = () => setOnboardingStep(prev => prev + 1)

  const handleBeginVisit = () => {
    sessionStartRef.current = Date.now()
    setPhase('active')
  }

  const handleEndSimulation = () => {
    try { recognitionRef.current?.stop() } catch (_) {}
    setMicStatus('idle')
    setPhase('ended')
  }

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
          <div className="runtime-diagnostics" role="status" aria-live="polite">
            <div>{`AR: ${arSupport.reason}`}</div>
            <div>{`Mic: ${speechSupported ? `${micStatus} | permission: ${micPermission}` : 'unsupported'}`}</div>
          </div>
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
                speechSupported={speechSupported}
                micStatus={micStatus}
                lastHeardCommand={lastHeardCommand}
              />
            )}
            {phase === 'active' && (
              <HUD
                vitals={vitals}
                conversation={conversation}
                activeSpeaker={activeSpeaker}
                onEndSimulation={handleEndSimulation}
                patient={patientRecord}
                micStatus={micStatus}
                speechSupported={speechSupported}
                lastHeardCommand={lastHeardCommand}
                speakerAttributionStatus={speakerAttributionStatus}
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
