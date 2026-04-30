import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, createXRStore } from '@react-three/xr'
import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import OnboardingHUD from './OnboardingHUD'
import SessionEndScreen from './SessionEndScreen'
import LandingPage from './LandingPage'
import SimulatedHUD from './SimulatedHUD'
import UnsupportedMobilePage from './UnsupportedMobilePage'
import { inferSpeaker } from './speakerAttribution'
import { speechConfig, getSpeechProviderLabel, shouldUseExternalDictation } from './speechConfig'
import { formatBudgetSummary, getSpeechBudgetSnapshot, recordSpeechSession } from './speechBudget'
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
const probeOffset = new Vector3(0, 0.2, -0.7)
const activeOffset = new Vector3(0, 0.05, -0.72)

function XRPhaseProbe({ phase }) {
  const groupRef = useRef(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = probeOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const color = phase === 'active' ? '#ff2f7a' : '#0a6bc2'
  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[0.34, 0.08]} />
        <meshBasicMaterial color={color} transparent opacity={0.94} depthWrite={false} />
      </mesh>
      <Text position={[0, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.03} color="#ffffff">
        {`PHASE: ${phase.toUpperCase()}`}
      </Text>
    </group>
  )
}

function XRActiveFallback({
  onEndSimulation,
  patient,
  activeSpeaker,
  micStatus,
  speechSupported,
  patientLiveCaption,
  speechProviderLabel,
  budgetStatus,
  lastHeardCommand,
  conversation,
}) {
  const groupRef = useRef(null)
  const menuRef = useRef(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = activeOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)

    if (!menuRef.current) return
    const menuOffset = new Vector3(-0.46, 0.05, -0.7).applyQuaternion(camera.quaternion)
    menuRef.current.position.copy(camera.position).add(menuOffset)
    menuRef.current.quaternion.copy(camera.quaternion)
  })

  const recentConvo = conversation.slice(-2)

  return (
    <>
      {/* Left standalone menu panel */}
      <group ref={menuRef}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial color="#091522" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        {[
          ['Patient Data', true, 0.09],
          ['Test Results', false, 0.045],
          ['Allergies', false, 0.0],
          ['Heart Rate', false, -0.045],
          ['Blood Pressure', false, -0.09],
        ].map(([label, selected, y]) => (
          <group key={label} position={[0, y, 0]}>
            <mesh>
              <planeGeometry args={[0.24, 0.036]} />
              <meshBasicMaterial color={selected ? '#accbff' : '#0f2134'} transparent opacity={0.95} depthWrite={false} />
            </mesh>
            <Text position={[0, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.015} color={selected ? '#0b1624' : '#ffffff'}>
              {label}
            </Text>
          </group>
        ))}
      </group>

      {/* Center-right info panel */}
      <group ref={groupRef}>
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.68, 0.36]} />
        <meshBasicMaterial color="#091522" transparent opacity={0.86} depthWrite={false} />
      </mesh>
      <Text position={[0, 0.145, 0.002]} anchorX="center" anchorY="middle" fontSize={0.029} color="#cfe8ff">
        MEDARVIEW HUD
      </Text>
      {recentConvo.length === 0 ? (
        <Text position={[0, -0.078, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#3a7aaa">
          Waiting for conversation...
        </Text>
      ) : (
        recentConvo.map((entry, index) => (
          <Text
            key={entry.id}
            position={[0, -0.072 - index * 0.02, 0.002]}
            anchorX="center"
            anchorY="middle"
            fontSize={0.012}
            color="#e8f4ff"
            maxWidth={0.68}
            textAlign="center"
          >
            {`${entry.speaker}: ${entry.text.slice(0, 80)}`}
          </Text>
        ))
      )}

      {/* Right: Patient detail card */}
      <mesh position={[0.06, -0.006, -0.001]}>
        <planeGeometry args={[0.30, 0.22]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Text position={[0.06, 0.085, 0.002]} anchorX="center" anchorY="middle" fontSize={0.017} color="#ffffff">
        {`${patient.name} (${patient.age})`}
      </Text>
      <Text position={[0.06, 0.058, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#ffffff">
        {`Active: ${activeSpeaker}`}
      </Text>
      <Text position={[0.06, 0.033, 0.002]} anchorX="center" anchorY="middle" fontSize={0.012} color="#9dbfe8">
        {`Mic: ${speechSupported ? micStatus : 'unsupported'}`}
      </Text>
      <Text position={[0.06, 0.01, 0.002]} anchorX="center" anchorY="middle" fontSize={0.0115} color="#6bb5ff" maxWidth={0.27} textAlign="center">
        {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
      </Text>
      <Text position={[0.06, -0.012, 0.002]} anchorX="center" anchorY="middle" fontSize={0.0115} color="#6bb5ff" maxWidth={0.27} textAlign="center">
        {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
      </Text>
      <Text position={[0.06, -0.034, 0.002]} anchorX="center" anchorY="middle" fontSize={0.0115} color="#9dbfe8" maxWidth={0.27} textAlign="center">
        {lastHeardCommand ? `Heard: ${lastHeardCommand}` : 'Heard: --'}
      </Text>
      <Text position={[0.06, -0.062, 0.002]} anchorX="center" anchorY="middle" fontSize={0.0125} color="#fff6de" maxWidth={0.27} textAlign="center">
        {patientLiveCaption || 'Awaiting patient speech...'}
      </Text>

      <mesh position={[0, -0.146, 0]} onClick={onEndSimulation}>
        <planeGeometry args={[0.28, 0.052]} />
        <meshBasicMaterial color="#5c0f1a" transparent opacity={0.9} />
      </mesh>
      <Text position={[0, -0.146, 0.002]} anchorX="center" anchorY="middle" fontSize={0.02} color="#ffcdd3">
        END SIMULATION
      </Text>
      </group>
    </>
  )
}

function App() {
  const [phase, setPhase] = useState('landing')
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [onboardingStep, setOnboardingStep] = useState(3)
  const [vitals, setVitals] = useState({ systolic: 120, diastolic: 80, spo2: 98 })
  const [conversation, setConversation] = useState([])
  const [activeSpeaker, setActiveSpeaker] = useState('Doctor')
  const [speechSupported, setSpeechSupported] = useState(true)
  const [micPermission, setMicPermission] = useState('unknown')
  const [micStatus, setMicStatus] = useState('idle')
  const [lastHeardCommand, setLastHeardCommand] = useState('')
  const [patientLiveCaption, setPatientLiveCaption] = useState('Awaiting patient speech...')
  const [speakerAttributionStatus, setSpeakerAttributionStatus] = useState('Awaiting speech...')
  const [budgetSnapshot, setBudgetSnapshot] = useState(() => getSpeechBudgetSnapshot())
  const [arSupport, setArSupport] = useState({
    checked: false,
    supported: false,
    reason: 'Checking immersive-ar support...',
  })
  const sessionStartRef = useRef(Date.now())
  const sessionBudgetStartRef = useRef(null)
  const phaseRef = useRef('landing')
  const stepRef = useRef(2)
  const speakerRef = useRef('Doctor')
  const conversationRef = useRef([])
  const recognitionRef = useRef(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { stepRef.current = onboardingStep }, [onboardingStep])
  useEffect(() => { speakerRef.current = activeSpeaker }, [activeSpeaker])
  useEffect(() => { conversationRef.current = conversation }, [conversation])

  const speechProviderLabel = getSpeechProviderLabel()
  const budgetStatus = formatBudgetSummary(budgetSnapshot)
  const dictationEnabled = speechConfig.dictationEnabled
  const externalDictationActive = shouldUseExternalDictation()

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const handleEnterExperience = () => {
    if (viewportWidth < 690) {
      setPhase('unsupported-mobile')
      return
    }
    setPhase('onboarding')
  }

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
    // Disable speech for simulated (non-WebXR) experience
    if (arSupport.checked && !arSupport.supported && phase === 'active') {
      setSpeechSupported(true)
      setMicPermission('n/a')
      setMicStatus('disabled')
      setLastHeardCommand('Dictation disabled in simulated mode.')
      setPatientLiveCaption('Dictation disabled.')
      setSpeakerAttributionStatus('Dictation disabled.')
      return
    }

    if (!dictationEnabled) {
      setSpeechSupported(true)
      setMicPermission('n/a')
      setMicStatus('disabled')
      setLastHeardCommand('Dictation disabled by config.')
      setPatientLiveCaption('Dictation disabled.')
      setSpeakerAttributionStatus('Dictation disabled by config.')
      return
    }

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

      if (currentPhase === 'onboarding' && currentStep === 4) {
        if (normalized.includes('begin visit') || normalized.includes('med view') || normalized.includes('medical view')) {
          if (budgetSnapshot.exhausted) {
            setLastHeardCommand('Speech budget exhausted for the current 30-day window.')
            return
          }

          sessionStartRef.current = Date.now()
          sessionBudgetStartRef.current = Date.now()
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

          if (attribution.speaker === 'Patient') {
            setPatientLiveCaption(utterance)
          }
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
  }, [dictationEnabled, budgetSnapshot.exhausted, arSupport.supported, arSupport.checked, phase])

  const handleAdvanceOnboarding = () => setOnboardingStep(prev => prev + 1)

  const handleBeginVisit = () => {
    if (!dictationEnabled) {
      sessionStartRef.current = Date.now()
      sessionBudgetStartRef.current = null
      setPatientLiveCaption('Awaiting patient speech...')
      setPhase('active')
      return
    }

    if (budgetSnapshot.exhausted) {
      setLastHeardCommand('Speech budget exhausted for the current 30-day window.')
      return
    }

    sessionStartRef.current = Date.now()
    sessionBudgetStartRef.current = Date.now()
    setPatientLiveCaption('Awaiting patient speech...')
    setPhase('active')
  }

  const handleEndSimulation = () => {
    try { recognitionRef.current?.stop() } catch (_) {}
    if (dictationEnabled && sessionBudgetStartRef.current) {
      setBudgetSnapshot(recordSpeechSession(sessionBudgetStartRef.current, Date.now()))
      sessionBudgetStartRef.current = null
    }
    setMicStatus('idle')
    setPhase('ended')
  }

  const simulatedActiveUi = arSupport.checked && !arSupport.supported && phase === 'active'

  return (
    <main className={`app-shell${simulatedActiveUi ? ' app-shell--simulated' : ''}`}>
      {phase === 'landing' && (
        <LandingPage onEnterExperience={handleEnterExperience} />
      )}
      {phase === 'unsupported-mobile' && <UnsupportedMobilePage />}

      {phase !== 'ended' && phase !== 'landing' && phase !== 'unsupported-mobile' && arSupport.checked && arSupport.supported && (
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
            <div>{`Dictation enabled: ${dictationEnabled ? 'yes' : 'no (UI-only mode)'}`}</div>
            <div>{`External dictation: ${externalDictationActive ? 'enabled' : 'disabled'}`}</div>
            <div>{`Dictation provider: ${speechProviderLabel}`}</div>
            <div>{`Speech budget: ${budgetStatus}`}</div>
            <div>{`Dictation API: ${speechConfig.dictationApiUrl || 'not configured'}`}</div>
          </div>
        </div>
      )}

      {phase !== 'ended' && phase !== 'landing' && phase !== 'unsupported-mobile' && (
        <Canvas camera={{ position: [0, 1.6, 0], fov: 60 }}>
          {arSupport.checked && arSupport.supported ? (
            <XR store={xrStore}>
              {(phase === 'onboarding' || phase === 'active') && <XRPhaseProbe phase={phase} />}
              {phase === 'onboarding' && (
                <OnboardingHUD
                  step={onboardingStep}
                  onContinue={handleAdvanceOnboarding}
                  onBeginVisit={handleBeginVisit}
                  speechSupported={speechSupported}
                  micStatus={micStatus}
                  lastHeardCommand={lastHeardCommand}
                  speechProviderLabel={speechProviderLabel}
                  budgetStatus={budgetStatus}
                />
              )}
              {phase === 'active' && (
                <XRActiveFallback
                  onEndSimulation={handleEndSimulation}
                  patient={patientRecord}
                  activeSpeaker={activeSpeaker}
                  micStatus={micStatus}
                  speechSupported={speechSupported}
                  patientLiveCaption={patientLiveCaption}
                  speechProviderLabel={speechProviderLabel}
                  budgetStatus={budgetStatus}
                  lastHeardCommand={lastHeardCommand}
                  conversation={conversation}
                />
              )}
            </XR>
          ) : (
            <>
              {phase === 'onboarding' && (
                <OnboardingHUD
                  step={onboardingStep}
                  onContinue={handleAdvanceOnboarding}
                  onBeginVisit={handleBeginVisit}
                  speechSupported={speechSupported}
                  micStatus={micStatus}
                  lastHeardCommand={lastHeardCommand}
                  speechProviderLabel={speechProviderLabel}
                  budgetStatus={budgetStatus}
                />
              )}
              {phase === 'active' && (
                <SimulatedHUD
                  conversation={conversation}
                  activeSpeaker={activeSpeaker}
                  onEndSimulation={handleEndSimulation}
                  patientLiveCaption={patientLiveCaption}
                  speakerAttributionStatus={speakerAttributionStatus}
                  speechProviderLabel={speechProviderLabel}
                  budgetStatus={budgetStatus}
                />
              )}
            </>
          )}
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
