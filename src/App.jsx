import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, XRDomOverlay, createXRStore } from '@react-three/xr'
import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import OnboardingHUD from './OnboardingHUD'
import SessionEndScreen from './SessionEndScreen'
import LandingPage from './LandingPage'
import SimulatedHUD from './SimulatedHUD'
import UnsupportedMobilePage from './UnsupportedMobilePage'
import RoundedRect from './hud/RoundedRect'
import HudMenuPanel from './hud/HudMenuPanel'
import { inferSpeaker } from './speakerAttribution'
import { speechConfig, getSpeechProviderLabel, shouldUseExternalDictation } from './speechConfig'
import { formatBudgetSummary, getSpeechBudgetSnapshot, recordSpeechSession } from './speechBudget'
import './App.css'

/**
 * Do not pass `customSessionInit` here: @pmndrs/xr's `buildXRSessionInit` returns it verbatim and skips merging
 * `domOverlay: { root }`, which breaks dom-overlay (and the in-session End bar) on several browsers.
 * Use top-level flags (e.g. `layers`, `handTracking`) to tune optional features instead.
 */
const xrStore = createXRStore({
  offerSession: false,
  handTracking: true,
  /** `layers` off avoids projection-layer teardown bugs on some Meta builds that block `session.end` / reload. */
  layers: false,
  domOverlay: true,
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

/** Same vertical tweak as `OnboardingHUD` step 3 (`DEMO_PANEL_H * 0.2`). */
const DEMO_PANEL_H = 0.812
/** Active visit HUD anchor matches demo-setup “ideal” frame in onboarding. */
const activeOffset = new Vector3(0, 0.05 - DEMO_PANEL_H * 0.2, -0.72)

function panelRadiusForSize(width, height, cap = 0.018) {
  const half = Math.min(width, height) / 2
  return Math.min(cap, Math.max(0.006, half * 0.22))
}

/** Match `SimulatedHUD` end control proportions for WebXR. */
const WEBXR_END_W = 0.42 * 0.5
const WEBXR_END_H = 0.068 * 0.5
const WEBXR_END_FONT = 0.023 * 0.5

/** Keeps `gl.xr.getSession()` in sync for exit — store session can lag vs Three's WebXRManager on some paths. */
function XrActiveSessionProbe({ sessionRef }) {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    sessionRef.current = gl.xr.getSession() ?? null
  })
  return null
}

/** Dom-overlay control so `session.end()` runs from a real DOM tap where the browser requires it. */
function WebXrSessionEndBar({ onEndSimulation }) {
  return (
    <XRDomOverlay className="xr-session-end-bar">
      <button type="button" className="xr-session-end-bar__btn" onClick={onEndSimulation}>
        End simulation
      </button>
    </XRDomOverlay>
  )
}

function XRActiveFallback({
  onEndSimulation,
  micStatus,
  speechSupported,
  patientLiveCaption,
  speechProviderLabel,
  speakerAttributionStatus,
  budgetStatus,
  lastHeardCommand,
}) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [overlayEnabled, setOverlayEnabled] = useState(true)

  const endSimR = useMemo(() => panelRadiusForSize(WEBXR_END_W, WEBXR_END_H, 0.014), [])
  const dictW = 0.34
  const dictH = 0.26
  const dictR = useMemo(() => panelRadiusForSize(0.34, 0.26), [])
  const panelColor = '#091522'

  /** Same left placement math as `SimulatedHUD` (viewport quarter), using this HUD’s Z depth. */
  const menuLayout = useMemo(() => {
    const depth = Math.abs(activeOffset.z)
    const fovRad = (camera.fov * Math.PI) / 180
    const visibleHeight = 2 * Math.tan(fovRad / 2) * depth
    const visibleWidth = visibleHeight * camera.aspect

    const baseWidth = 0.3
    const minWidth = 0.15
    const quarterViewport = visibleWidth * 0.25
    const easedWidth =
      quarterViewport >= baseWidth
        ? baseWidth
        : Math.max(minWidth, baseWidth - (baseWidth - quarterViewport) * 0.5)
    const scale = easedWidth / baseWidth

    const leftPadding = 0.02
    const topPadding = 0.06
    const xLeft = -visibleWidth / 2 + leftPadding
    const yTop = visibleHeight / 2 - topPadding
    const panelHalfWidth = (baseWidth * scale) / 2
    const panelTopToOrigin = 0.34 * scale

    return {
      scale,
      position: [xLeft + panelHalfWidth, yTop - panelTopToOrigin, 0],
    }
  }, [camera.aspect, camera.fov])

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = activeOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const endVisit = (e) => {
    e.stopPropagation()
    onEndSimulation()
  }

  /** Lower-right dictation stack. */
  const dictPos = [0.31, -0.165, 0]
  /** Center bottom of the same ideal frame as simulated HUD end bar. */
  const endPos = [0, -0.288, 0]

  const lx = -dictW / 2 + 0.02
  const ty = dictH / 2 - 0.02

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <HudMenuPanel
          position={menuLayout.position}
          scale={menuLayout.scale}
          overlayEnabled={overlayEnabled}
          onSetOverlay={setOverlayEnabled}
          selectedMenuId={selectedMenuId}
          onToggleItem={(id) => setSelectedMenuId((prev) => (prev === id ? null : id))}
        />
      </Suspense>

      {/* Lower-right: dictation-only panel */}
      <group position={dictPos}>
        <RoundedRect
          width={dictW}
          height={dictH}
          radius={dictR}
          color={panelColor}
          opacity={0.72}
          borderColor="#5a7a9a"
          borderOpacity={0.35}
          borderWidth={1}
          z={-0.002}
        />
        <Text position={[lx, ty, 0.002]} anchorX="left" anchorY="top" fontSize={0.017} color="#cfe8ff">
          DICTATION
        </Text>
        <Text position={[lx, ty - 0.03, 0.002]} anchorX="left" anchorY="top" fontSize={0.011} color="#9dbfe8">
          {`Mic: ${speechSupported ? micStatus : 'unsupported'}`}
        </Text>
        <Text position={[lx, ty - 0.05, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#8af3d1" maxWidth={dictW - 0.04}>
          {speakerAttributionStatus || 'Attribution: --'}
        </Text>
        <Text position={[lx, ty - 0.072, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#6bb5ff" maxWidth={dictW - 0.04}>
          {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
        </Text>
        <Text position={[lx, ty - 0.09, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#6bb5ff" maxWidth={dictW - 0.04}>
          {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
        </Text>
        <Text position={[lx, ty - 0.108, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#9dbfe8" maxWidth={dictW - 0.04}>
          {lastHeardCommand ? `Heard: ${lastHeardCommand}` : 'Heard: --'}
        </Text>
        <Text
          position={[lx, ty - 0.132, 0.002]}
          anchorX="left"
          anchorY="top"
          fontSize={0.012}
          color="#fff6de"
          maxWidth={dictW - 0.04}
          textAlign="left"
          lineHeight={1.25}
        >
          {patientLiveCaption || 'Awaiting patient speech...'}
        </Text>
      </group>

      {/* Center bottom: compact rounded end control (matches simulated HUD) */}
      <group position={endPos} onClick={endVisit}>
        <RoundedRect
          width={WEBXR_END_W}
          height={WEBXR_END_H}
          radius={endSimR}
          color="#5c0f1a"
          opacity={0.9}
          borderColor="#ff8a95"
          borderOpacity={0.45}
          borderWidth={1}
          z={-0.002}
        />
        <Text
          position={[0, 0, 0.003]}
          anchorX="center"
          anchorY="middle"
          fontSize={WEBXR_END_FONT}
          color="#ffcdd3"
          onClick={endVisit}
        >
          END SIMULATION
        </Text>
      </group>
    </group>
  )
}

function App() {
  const [phase, setPhase] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 690 ? 'unsupported-mobile' : 'landing'
  )
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
  /** Mirrors `gl.xr.getSession()` from inside `<XR>`; used when ending immersive AR. */
  const xrNativeSessionRef = useRef(null)
  /** Prevents double immersive-exit wiring (two subscribers / timers). */
  const xrImmersiveExitBusyRef = useRef(false)
  const phaseRef = useRef(phase)
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

  const xrSession = useSyncExternalStore(
    (cb) => xrStore.subscribe(cb),
    () => xrStore.getState().session ?? null,
    () => null,
  )
  /**
   * True only while an immersive WebXR session exists. `<XR>` must stay mounted whenever WebXR is supported
   * so `xrStore` stays wired to `gl.xr` (otherwise Enter AR fails). When there is no session, we render
   * flat `SimulatedHUD` inside `<XR>` instead of the passthrough HUD.
   */
  const webxrImmersive = arSupport.checked && arSupport.supported && xrSession != null

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

  const handleUnsupportedMobileGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    setPhase('landing')
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
    if (phase === 'xr-exiting' || phase === 'ended') {
      return
    }

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
      const p = phaseRef.current
      if (p !== 'ended' && p !== 'xr-exiting') {
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
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    let budgetForStorage = budgetSnapshot
    if (dictationEnabled && sessionBudgetStartRef.current) {
      budgetForStorage = recordSpeechSession(sessionBudgetStartRef.current, Date.now())
      setBudgetSnapshot(budgetForStorage)
      sessionBudgetStartRef.current = null
    }
    setMicStatus('idle')

    let finished = false
    const goToEnded = () => {
      if (finished) return
      finished = true
      xrImmersiveExitBusyRef.current = false
      setPhase('ended')
    }

    const storeSession = xrStore.getState().session
    const glSession = xrNativeSessionRef.current
    const session = storeSession ?? glSession

    /** Non-immersive: normal SPA transition to end screen. */
    if (session == null) {
      goToEnded()
      return
    }

    /**
     * Immersive WebXR: **do not jump straight to `ended` and unmount `<Canvas>`** while the browser is still
     * tearing down XR — on Quest that often leaves a black compositor “void”. We hold an `xr-exiting` phase (GL
     * stays alive), wait for the native session `end` event, then defer `ended` slightly so presentation can reset.
     */
    if (!arSupport.checked || !arSupport.supported) {
      goToEnded()
      return
    }

    if (xrImmersiveExitBusyRef.current) return
    xrImmersiveExitBusyRef.current = true

    let failTimer = null
    let domExitScheduled = false

    const scheduleDomExit = () => {
      if (domExitScheduled) return
      domExitScheduled = true
      if (failTimer != null) {
        window.clearTimeout(failTimer)
        failTimer = null
      }
      xrImmersiveExitBusyRef.current = false
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            setPhase('ended')
          }, 320)
        })
      })
    }

    /** Prefer `gl.xr`’s session so `end()` matches Three’s WebXRManager. */
    const nativeSession = glSession ?? storeSession

    try {
      nativeSession.addEventListener(
        'end',
        () => {
          scheduleDomExit()
        },
        { once: true },
      )
    } catch {
      /* ignore */
    }

    failTimer = window.setTimeout(() => {
      scheduleDomExit()
    }, 8000)

    setPhase('xr-exiting')

    try {
      void nativeSession.end()
    } catch {
      /* ignore */
    }
  }

  const simulatedActiveUi = arSupport.checked && !arSupport.supported && phase === 'active'
  const isWebXrDemoSetup = phase === 'onboarding' && onboardingStep === 3 && arSupport.checked && arSupport.supported
  /** `xr-exiting` keeps `<Canvas>` mounted (not `ended`) until the XR session has fully ended. */
  const showCanvas =
    phase !== 'landing' && phase !== 'unsupported-mobile' && phase !== 'ended'

  return (
    <main
      className={`app-shell${simulatedActiveUi ? ' app-shell--simulated' : ''}${
        phase === 'landing' || phase === 'unsupported-mobile' || phase === 'ended'
          ? ' app-shell--landing'
          : ''
      }`}
    >
      {phase === 'landing' && (
        <LandingPage onEnterExperience={handleEnterExperience} />
      )}
      {phase === 'unsupported-mobile' && (
        <UnsupportedMobilePage onGoBack={handleUnsupportedMobileGoBack} />
      )}

      {phase !== 'ended' &&
        phase !== 'xr-exiting' &&
        phase !== 'landing' &&
        phase !== 'unsupported-mobile' &&
        arSupport.checked &&
        arSupport.supported && (
        <>
          <div className={`ar-controls ar-controls__primary${isWebXrDemoSetup ? ' ar-controls__primary--demo-setup' : ''}`}>
            <ARButton className="ar-toggle" store={xrStore}>
              {(status) => {
                if (status === 'unsupported') return 'AR Unsupported'
                if (status === 'entered') return 'Exit AR'
                return 'Enter Medical AR HUD'
              }}
            </ARButton>
          </div>
          <div className="ar-controls ar-controls__diagnostics runtime-diagnostics" role="status" aria-live="polite">
            <div>{`AR: ${arSupport.reason}`}</div>
            <div>{`Mic: ${speechSupported ? `${micStatus} | permission: ${micPermission}` : 'unsupported'}`}</div>
            <div>{`Dictation enabled: ${dictationEnabled ? 'yes' : 'no (UI-only mode)'}`}</div>
            <div>{`External dictation: ${externalDictationActive ? 'enabled' : 'disabled'}`}</div>
            <div>{`Dictation provider: ${speechProviderLabel}`}</div>
            <div>{`Speech budget: ${budgetStatus}`}</div>
            <div>{`Dictation API: ${speechConfig.dictationApiUrl || 'not configured'}`}</div>
          </div>
        </>
      )}

      {phase === 'xr-exiting' && (
        <div className="xr-exit-overlay" role="status" aria-live="polite">
          <p className="xr-exit-overlay__title">Exiting AR…</p>
          <p className="xr-exit-overlay__hint">Returning to the visit summary.</p>
        </div>
      )}

      {showCanvas && (
        <Canvas camera={{ position: [0, 1.6, 0], fov: 60 }}>
          {arSupport.checked && arSupport.supported ? (
            <XR store={xrStore}>
              <XrActiveSessionProbe sessionRef={xrNativeSessionRef} />
              {webxrImmersive ? (
                <>
                  {phase === 'xr-exiting' && (
                    <XRDomOverlay className="xr-exit-overlay xr-exit-overlay--dom">
                      <p className="xr-exit-overlay__title">Exiting AR…</p>
                      <p className="xr-exit-overlay__hint">Returning to the visit summary.</p>
                    </XRDomOverlay>
                  )}
                  {phase === 'onboarding' && (
                    <OnboardingHUD
                      step={onboardingStep}
                      onContinue={handleAdvanceOnboarding}
                      onBeginVisit={handleBeginVisit}
                    />
                  )}
                  {phase === 'active' && (
                    <>
                      <WebXrSessionEndBar onEndSimulation={handleEndSimulation} />
                      <XRActiveFallback
                        onEndSimulation={handleEndSimulation}
                        micStatus={micStatus}
                        speechSupported={speechSupported}
                        patientLiveCaption={patientLiveCaption}
                        speechProviderLabel={speechProviderLabel}
                        speakerAttributionStatus={speakerAttributionStatus}
                        budgetStatus={budgetStatus}
                        lastHeardCommand={lastHeardCommand}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  {phase === 'xr-exiting' ? null : (
                    <>
                      {phase === 'onboarding' && (
                        <OnboardingHUD
                          step={onboardingStep}
                          onContinue={handleAdvanceOnboarding}
                          onBeginVisit={handleBeginVisit}
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
                </>
              )}
            </XR>
          ) : (
            <>
              {phase === 'onboarding' && (
                <OnboardingHUD
                  step={onboardingStep}
                  onContinue={handleAdvanceOnboarding}
                  onBeginVisit={handleBeginVisit}
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
          key={sessionStartRef.current}
          conversation={conversation}
          vitals={vitals}
          sessionStartTime={sessionStartRef.current}
        />
      )}
    </main>
  )
}

export default App
