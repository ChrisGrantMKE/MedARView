import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, XRDomOverlay, createXRStore, useXR } from '@react-three/xr'
import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import OnboardingHUD from './OnboardingHUD'
import SessionEndScreen from './SessionEndScreen'
import LandingPage from './LandingPage'
import SimulatedHUD from './SimulatedHUD'
import UnsupportedMobilePage from './UnsupportedMobilePage'
import RoundedRect from './hud/RoundedRect'
import HudMenuPanel from './hud/HudMenuPanel'
import { xrUiPointerEventsType } from './hud/hudTheme'
import { inferSpeaker } from './speakerAttribution'
import { startGatewayDictation, mapGatewaySpeakerLabel } from './gatewayStreamingDictation'
import {
  speechConfig,
  getSpeechProviderLabel,
  shouldUseExternalDictation,
  browserSpeechRecognitionAvailable,
  getGatewaySttWebSocketUrl,
} from './speechConfig'
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
  /**
   * Default XR ray pointers use `minDistance: 0.2` (m). Hits closer than that are dropped — common with
   * head-locked panels when aiming from the waist/chest. Allow near-field UI for minimal AR + HUD.
   * See https://docs.pmnd.rs/xr/tutorials/interactions — use `pointerEventsType` on UI meshes so grab vs ray is predictable.
   */
  controller: {
    rayPointer: { minDistance: 0 },
  },
  hand: {
    rayPointer: {
      minDistance: 0,
      rayModel: { maxLength: 3 },
    },
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

function panelRadiusForSize(width, height, cap = 0.018) {
  const half = Math.min(width, height) / 2
  return Math.min(cap, Math.max(0.006, half * 0.22))
}

/**
 * Keeps `gl.xr.getSession()` in sync for exit; also reports native session presence so UI can use the
 * immersive WebXR tree as soon as the GL session exists (store session often lags one+ frames after `enterAR()`).
 */
function XrActiveSessionProbe({ sessionRef, onHasNativeSession }) {
  const gl = useThree((s) => s.gl)
  const prevHas = useRef(null)
  useFrame(() => {
    const s = gl.xr.getSession() ?? null
    sessionRef.current = s
    const has = s != null
    if (prevHas.current !== has) {
      prevHas.current = has
      onHasNativeSession?.(has)
    }
  })
  return null
}

/**
 * Quest / passthrough: opaque scene background or alpha-1 clear hides the real-world underlay
 * (see Meta WebXR passthrough + webxr.md). While an immersive session is active, clear to alpha 0
 * and keep `scene.background` null so R3F UI + passthrough composite correctly and ray hits stay consistent.
 */
function ImmersivePassthroughSync() {
  const session = useXR((s) => s.session)
  const { gl, scene } = useThree()
  useEffect(() => {
    if (session == null) return
    const prevBg = scene.background
    const prevColor = new Color()
    gl.getClearColor(prevColor)
    const prevAlpha = gl.getClearAlpha()
    scene.background = null
    gl.setClearColor(0x000000, 0)
    return () => {
      scene.background = prevBg
      gl.setClearColor(prevColor, prevAlpha)
    }
  }, [session, gl, scene])
  return null
}

/** World-anchored exit for minimal AR landing flow — reliable XR pointers vs DOM overlay. */
const AR_MINIMAL_EXIT_W = 0.52
const AR_MINIMAL_EXIT_H = 0.11
function ArMinimalExitButton3D({ onExit }) {
  const groupRef = useRef(null)
  const offset = useMemo(() => new Vector3(0, -0.06, -0.68), [])
  const { camera } = useThree()
  const fillR = useMemo(() => panelRadiusForSize(AR_MINIMAL_EXIT_W, AR_MINIMAL_EXIT_H, 0.018), [])

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = offset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const pick = (e) => {
    e.stopPropagation()
    onExit()
  }

  return (
    <group ref={groupRef} renderOrder={1000}>
      <RoundedRect
        width={AR_MINIMAL_EXIT_W}
        height={AR_MINIMAL_EXIT_H}
        radius={fillR}
        color="#132a45"
        opacity={0.96}
        borderColor="#7eb8ff"
        borderOpacity={0.55}
        borderWidth={2}
        z={-0.002}
        depthTest={false}
        pointerEventsOrder={1000}
        pointerEventsType={xrUiPointerEventsType}
        onClick={pick}
        onPointerDown={pick}
      />
      <Text
        position={[0, 0, 0.004]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.03}
        color="#f3f7fc"
        pointerEventsOrder={1000}
        pointerEventsType={xrUiPointerEventsType}
        onClick={pick}
        onPointerDown={pick}
      >
        Exit AR mode
      </Text>
    </group>
  )
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

/** Match `SimulatedHUD` end control — compact bar (restored AR visit layout). */
const WEBXR_END_W = 0.42 * 0.5
const WEBXR_END_H = 0.068 * 0.5
const WEBXR_END_FONT = 0.023 * 0.5

/** Same vertical tweak as onboarding demo setup — AR visit HUD must stay camera-locked, no full-scene fill. */
const DEMO_PANEL_H = 0.812
const activeOffset = new Vector3(0, 0.05 - DEMO_PANEL_H * 0.2, -0.72)

/**
 * XR swaps camera / projection each frame — using live `camera.fov` / `aspect` recomputes menu layout and makes the
 * left HUD jump. Freeze layout with the same nominal values as `<Canvas camera={{ fov: 60 }}>` and 16∶9.
 */
const XR_HUD_LAYOUT_FOV = (60 * Math.PI) / 180
const XR_HUD_LAYOUT_ASPECT = 16 / 9
/** Extra scale on `HudMenuPanel` in immersive AR (1 = base layout scale only). */
const XR_MENU_VISUAL_SCALE = 0.8
/**
 * Menu backdrop width in local units — must match `HudMenuPanel`: `overlayBarW` + 2×`MENU_BACKDROP_PAD`.
 * Used to align menu right edge with the End Simulation pill’s left edge.
 */
const HUD_MENU_BACKDROP_W = 0.3 + 2 * 0.024
const GATEWAY_MIC_BTN_W = 0.22
const GATEWAY_MIC_BTN_H = 0.036

/**
 * Immersive AR visit HUD only: floating panels over passthrough (no SimulatedHUD video plane / scene fill).
 * Uses depthTest={false} so Meta passthrough depth does not hide controls.
 */
function XRActiveFallback({
  onEndSimulation,
  micStatus,
  speechSupported,
  browserSrAvailable,
  headsetGatewayStreaming,
  dictationEnabled,
  patientLiveCaption,
  speechProviderLabel,
  speakerAttributionStatus,
  budgetStatus,
  lastHeardCommand,
  showGatewayMicHud,
  gatewayMicActive,
  onGatewayMicToggle,
}) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [overlayEnabled, setOverlayEnabled] = useState(true)

  const endSimR = useMemo(() => panelRadiusForSize(WEBXR_END_W, WEBXR_END_H, 0.014), [])
  const gatewayMicFillR = useMemo(
    () => panelRadiusForSize(GATEWAY_MIC_BTN_W, GATEWAY_MIC_BTN_H, 0.012),
    [],
  )
  const dictW = 0.34
  const dictH = 0.26
  const dictR = useMemo(() => panelRadiusForSize(0.34, 0.26), [])
  const panelColor = '#091522'

  const menuLayout = useMemo(() => {
    const depth = Math.abs(activeOffset.z)
    const visibleHeight = 2 * Math.tan(XR_HUD_LAYOUT_FOV / 2) * depth
    const visibleWidth = visibleHeight * XR_HUD_LAYOUT_ASPECT

    const baseWidth = 0.3
    const minWidth = 0.15
    const quarterViewport = visibleWidth * 0.25
    const easedWidth =
      quarterViewport >= baseWidth
        ? baseWidth
        : Math.max(minWidth, baseWidth - (baseWidth - quarterViewport) * 0.5)
    const scale = easedWidth / baseWidth

    const topPadding = 0.06
    const yTop = visibleHeight / 2 - topPadding
    const panelTopToOrigin = 0.34 * scale

    const menuScaleApplied = scale * XR_MENU_VISUAL_SCALE
    const menuHalfWorldX = (HUD_MENU_BACKDROP_W / 2) * menuScaleApplied
    /** End Simulation group is at x=0; pill is centered — left edge at -WEBXR_END_W/2. */
    const endSimLeftEdgeX = -WEBXR_END_W / 2
    const menuCenterX = endSimLeftEdgeX - menuHalfWorldX

    return {
      scale: menuScaleApplied,
      position: [menuCenterX, yTop - panelTopToOrigin, 0],
    }
  }, [])

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = activeOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  /** Defer out of XR select handler (same pattern as Begin visit on Quest). */
  const endVisit = (e) => {
    e.stopPropagation()
    queueMicrotask(() => {
      startTransition(() => {
        onEndSimulation()
      })
    })
  }

  const dictPos = [0.31, -0.165, 0]
  const endPos = [0, -0.288, 0]
  /** Top-centered above End simulation — horizontal center (x=0), gap below mic = gap above End pill top. */
  const GATEWAY_MIC_GAP_ABOVE_END = 0.03
  const endPillTopY = endPos[1] + WEBXR_END_H / 2
  const gatewayMicCenterY = endPillTopY + GATEWAY_MIC_GAP_ABOVE_END + GATEWAY_MIC_BTN_H / 2
  const gatewayMicPos = [0, gatewayMicCenterY, 0.018]

  const pickGatewayMic = (e) => {
    e.stopPropagation()
    queueMicrotask(() => onGatewayMicToggle?.())
  }

  const lx = -dictW / 2 + 0.02
  const ty = dictH / 2 - 0.02

  return (
    <group ref={groupRef} renderOrder={1000}>
      <Suspense fallback={null}>
        <group position={menuLayout.position} scale={menuLayout.scale}>
          <HudMenuPanel
            position={[0, 0, 0]}
            scale={1}
            overlayEnabled={overlayEnabled}
            onSetOverlay={setOverlayEnabled}
            selectedMenuId={selectedMenuId}
            onToggleItem={(id) => setSelectedMenuId((prev) => (prev === id ? null : id))}
            depthTest={false}
            interactionOrder={800}
          />
        </group>
      </Suspense>

      {showGatewayMicHud ? (
        <group position={gatewayMicPos}>
          <RoundedRect
            width={GATEWAY_MIC_BTN_W}
            height={GATEWAY_MIC_BTN_H}
            radius={gatewayMicFillR}
            color="#0b5c3a"
            opacity={0.94}
            borderColor="#5ecf8f"
            borderOpacity={0.45}
            borderWidth={1}
            z={0}
            depthTest={false}
            raycastDisabled
          />
          <Text position={[0, 0, 0.003]} anchorX="center" anchorY="middle" fontSize={0.019} color="#a8f5d0" depthTest={false}>
            {gatewayMicActive ? 'Stop mic' : 'Enable mic'}
          </Text>
          {/* Single hit target — avoid onClick + onPointerDown (double toggle) and Text stealing rays */}
          <mesh
            position={[0, 0, 0.006]}
            pointerEventsOrder={850}
            pointerEventsType={xrUiPointerEventsType}
            onPointerDown={pickGatewayMic}
          >
            <planeGeometry args={[GATEWAY_MIC_BTN_W * 1.08, GATEWAY_MIC_BTN_H * 1.15]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
          </mesh>
        </group>
      ) : null}

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
          depthTest={false}
        />
        <Text position={[lx, ty, 0.002]} anchorX="left" anchorY="top" fontSize={0.017} color="#cfe8ff" depthTest={false}>
          DICTATION
        </Text>
        <Text position={[lx, ty - 0.03, 0.002]} anchorX="left" anchorY="top" fontSize={0.011} color="#9dbfe8" maxWidth={dictW - 0.04} depthTest={false}>
          {browserSrAvailable
            ? `Web Speech: ${speechSupported ? micStatus : 'starting…'}`
            : headsetGatewayStreaming
              ? `Gateway STT: ${micStatus}`
              : dictationEnabled
                ? 'No browser SR — tap Enable mic (top center)'
                : 'Dictation off (UI-only)'}
        </Text>
        <Text position={[lx, ty - 0.05, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#8af3d1" maxWidth={dictW - 0.04} depthTest={false}>
          {speakerAttributionStatus || 'Attribution: --'}
        </Text>
        <Text position={[lx, ty - 0.072, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#6bb5ff" maxWidth={dictW - 0.04} depthTest={false}>
          {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
        </Text>
        <Text position={[lx, ty - 0.09, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#6bb5ff" maxWidth={dictW - 0.04} depthTest={false}>
          {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
        </Text>
        <Text position={[lx, ty - 0.108, 0.002]} anchorX="left" anchorY="top" fontSize={0.01} color="#9dbfe8" maxWidth={dictW - 0.04} depthTest={false}>
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
          depthTest={false}
        >
          {patientLiveCaption || 'Awaiting patient speech...'}
        </Text>
      </group>

      <group position={endPos}>
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
          depthTest={false}
          pointerEventsOrder={1000}
          pointerEventsType={xrUiPointerEventsType}
          onClick={endVisit}
          onPointerDown={endVisit}
        />
        <Text
          position={[0, 0, 0.003]}
          anchorX="center"
          anchorY="middle"
          fontSize={WEBXR_END_FONT}
          color="#ffcdd3"
          depthTest={false}
          pointerEventsOrder={1000}
          pointerEventsType={xrUiPointerEventsType}
          onClick={endVisit}
          onPointerDown={endVisit}
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
  /** Quest / no Web Speech API: user taps to stream mic to speech gateway WebSocket STT */
  const [headsetDictationActive, setHeadsetDictationActive] = useState(false)
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
  /** Set with `setXrExitReturnsToLanding` before `xr-exiting` so overlays know landing vs visit summary. */
  const [xrExitReturnsToLanding, setXrExitReturnsToLanding] = useState(false)
  /** True when `gl.xr.getSession()` exists — avoids rendering simulated HUD branch while immersive session is active but store lags. */
  const [hasNativeXrSession, setHasNativeXrSession] = useState(false)
  const phaseRef = useRef(phase)
  /** Align with initial `onboardingStep` (demo setup) until sync effect runs. */
  const stepRef = useRef(3)
  const speakerRef = useRef('Doctor')
  const conversationRef = useRef([])
  const recognitionRef = useRef(null)

  useEffect(() => { phaseRef.current = phase }, [phase])

  const onNativeXrSessionChanged = useCallback((has) => {
    setHasNativeXrSession(has)
  }, [])
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
  /**
   * `xrStore.session` can lag native session after `enterAR()` / immersive start.
   * Include `hasNativeXrSession` for active visit so we mount XR HUD + pointers immediately after entering AR
   * from simulated mode (otherwise SimulatedHUD stays up briefly or sticks if store lags).
   */
  const webxrImmersiveUi =
    webxrImmersive ||
    phase === 'ar-minimal' ||
    phase === 'xr-exiting' ||
    (phase === 'active' && hasNativeXrSession) ||
    /** Store session can lag native `gl.xr` — keep immersive HUD + ray pointers during AR onboarding. */
    (phase === 'onboarding' && hasNativeXrSession)

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
    if (phase === 'xr-exiting' || phase === 'ended' || phase === 'ar-minimal') {
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
      setSpeechSupported(headsetDictationActive)
      if (headsetDictationActive) {
        // Lift stale “disabled” from simulated / dictation-off sessions — gateway HUD would show “Gateway STT: disabled”.
        setMicStatus((m) => (m === 'disabled' ? 'starting' : m))
      } else {
        setMicStatus('idle')
        setLastHeardCommand(
          'No Web Speech API — tap “Enable mic” (below Enter AR when flat, or top center when in AR) to stream audio to the speech gateway.',
        )
      }
      return
    }

    const checkMicPermission = async () => {
      if (!navigator.permissions?.query) return
      try {
        const status = await navigator.permissions.query({ name: 'microphone' })
        setMicPermission(status.state)
        status.onchange = () => setMicPermission(status.state)
      } catch {
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

      /** Demo setup is step 3 (not 4); voice “begin visit” must match the visible onboarding step. */
      if (currentPhase === 'onboarding' && currentStep === 3) {
        if (normalized.includes('begin visit') || normalized.includes('med view') || normalized.includes('medical view')) {
          if (budgetSnapshot.exhausted) {
            setLastHeardCommand('Speech budget exhausted for the current 30-day window.')
            return
          }

          queueMicrotask(() => {
            startTransition(() => {
              sessionStartRef.current = Date.now()
              sessionBudgetStartRef.current = Date.now()
              setPhase('active')
            })
          })
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              rec.start()
            } catch {
              setMicStatus('error')
            }
          })
        })
      }
    }

    recognitionRef.current = rec
    let kickStartRaf2 = null
    const kickStartRaf1 = requestAnimationFrame(() => {
      kickStartRaf2 = requestAnimationFrame(() => {
        try {
          rec.start()
        } catch {
          setMicStatus('error')
        }
      })
    })

    return () => {
      cancelAnimationFrame(kickStartRaf1)
      if (kickStartRaf2 != null) cancelAnimationFrame(kickStartRaf2)
      try {
        rec.stop()
      } catch {
        // ignore
      }
    }
  }, [
    dictationEnabled,
    budgetSnapshot.exhausted,
    arSupport.supported,
    arSupport.checked,
    phase,
    headsetDictationActive,
  ])

  useEffect(() => {
    if (phase === 'ended' || phase === 'xr-exiting') {
      setHeadsetDictationActive(false)
    }
  }, [phase])

  useEffect(() => {
    if (!headsetDictationActive) return
    if (!dictationEnabled) return
    if (browserSpeechRecognitionAvailable()) {
      setHeadsetDictationActive(false)
      return
    }
    if (arSupport.checked && !arSupport.supported && phase === 'active') {
      setHeadsetDictationActive(false)
      return
    }
    if (phase !== 'active') return

    let cancelled = false
    let stopSession = () => {}

    void (async () => {
      const url = getGatewaySttWebSocketUrl()
      if (!url) {
        setLastHeardCommand(
          'Gateway STT WebSocket URL missing. For dev use `npm run full`; for production set VITE_GATEWAY_WS_URL before build.',
        )
        setHeadsetDictationActive(false)
        return
      }
      setMicStatus((m) => (m === 'disabled' ? 'starting' : m))
      try {
        const { stop } = await startGatewayDictation({
          wsUrl: url,
          onMessage: (msg) => {
            if (cancelled) return
            if (msg.type === 'error') {
              setLastHeardCommand(msg.message || 'Gateway STT error')
              setMicStatus('error')
              return
            }
            if (msg.type === 'ready') {
              setMicStatus('listening')
              setSpeechSupported(true)
              setMicPermission('granted')
              setLastHeardCommand('Headset mic streaming to gateway…')
              return
            }
            if (msg.type !== 'transcript' || !msg.text) return
            const text = String(msg.text).trim()
            if (!text) return
            setLastHeardCommand(text)
            if (!msg.isFinal) return

            const speaker = mapGatewaySpeakerLabel(msg.speaker, speakerRef.current)
            const conf =
              typeof msg.confidence === 'number' ? Math.round(msg.confidence * 100) : null
            setActiveSpeaker(speaker)
            setSpeakerAttributionStatus(
              conf != null ? `google-stt | ${speaker} (${conf}%)` : `google-stt | ${speaker}`,
            )
            setConversation((prev) => [
              ...prev,
              { id: Date.now(), speaker, text, timestamp: Date.now() },
            ])
            if (speaker === 'Patient') {
              setPatientLiveCaption(text)
            }
          },
          onError: (err) => {
            if (!cancelled) {
              setLastHeardCommand(err?.message || 'Headset stream failed')
              setMicStatus('error')
              setHeadsetDictationActive(false)
            }
          },
        })
        stopSession = stop
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setLastHeardCommand(msg)
          setMicStatus('error')
          setHeadsetDictationActive(false)
        }
      }
    })()

    return () => {
      cancelled = true
      stopSession()
    }
  }, [headsetDictationActive, dictationEnabled, arSupport.checked, arSupport.supported, phase])

  const handleAdvanceOnboarding = () => setOnboardingStep(prev => prev + 1)

  /** Demo setup: 3D “Enter / Exit AR mode” toggles immersive session (DOM AR button hidden on this step). */
  const handleDemoSetupToggleAr = useCallback(() => {
    const session = xrStore.getState().session
    if (session != null) {
      try {
        session.end()
      } catch {
        /* ignore */
      }
      return
    }
    void xrStore.enterAR().catch((err) => {
      console.error(err)
    })
  }, [])

  /**
   * Shared path for leaving immersive AR without unmounting `<Canvas>` until `session` has ended
   * (avoids Quest black compositor void). Used by minimal AR exit and “End simulation”.
   */
  const beginGracefulImmersiveExit = (targetPhase) => {
    let settled = false
    const goToTarget = () => {
      if (settled) return
      settled = true
      xrImmersiveExitBusyRef.current = false
      setPhase(targetPhase)
    }

    const storeSession = xrStore.getState().session
    const glSession = xrNativeSessionRef.current
    const session = storeSession ?? glSession

    if (session == null) {
      goToTarget()
      return
    }

    if (!arSupport.checked || !arSupport.supported) {
      goToTarget()
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
            setPhase(targetPhase)
          }, 320)
        })
      })
    }

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

    setXrExitReturnsToLanding(targetPhase === 'landing')
    setPhase('xr-exiting')

    try {
      void nativeSession.end()
    } catch {
      /* ignore */
    }
  }

  /** Defer state updates out of the XR pointer/select handler — avoids Quest crashes when combining with SR/DOM overlay. */
  const handleBeginVisit = () => {
    queueMicrotask(() => {
      startTransition(() => {
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
      })
    })
  }

  const handleEndSimulation = () => {
    if (phaseRef.current === 'xr-exiting' || phaseRef.current === 'ended') {
      return
    }
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

    const storeSession = xrStore.getState().session
    const glSession = xrNativeSessionRef.current
    const session = storeSession ?? glSession

    /** Non-immersive: normal SPA transition to end screen. */
    if (session == null) {
      xrImmersiveExitBusyRef.current = false
      setPhase('ended')
      return
    }

    /**
     * Immersive WebXR: same graceful teardown as minimal AR (`beginGracefulImmersiveExit`) —
     * hold `xr-exiting`, wait for native `end`, then defer `ended` so the compositor can recover.
     */
    if (!arSupport.checked || !arSupport.supported) {
      xrImmersiveExitBusyRef.current = false
      setPhase('ended')
      return
    }

    beginGracefulImmersiveExit('ended')
  }

  const handleExitMinimalAr = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    beginGracefulImmersiveExit('landing')
  }

  const simulatedActiveUi = arSupport.checked && !arSupport.supported && phase === 'active'
  /** Keep visit HUD + controllers mounted during immersive teardown so passthrough doesn’t drop to an empty scene. */
  const showActiveImmersiveHud =
    phase === 'active' || (phase === 'xr-exiting' && !xrExitReturnsToLanding)
  const isWebXrDemoSetup = phase === 'onboarding' && onboardingStep === 3 && arSupport.checked && arSupport.supported
  /** `xr-exiting` keeps `<Canvas>` mounted (not `ended`) until the XR session has fully ended. */
  const showCanvas =
    phase !== 'unsupported-mobile' &&
    phase !== 'ended' &&
    (phase !== 'landing' || (arSupport.checked && arSupport.supported))

  const browserSrAvailable = browserSpeechRecognitionAvailable()
  /** True during active visit while WebXR session is up — mic control moves to top-centered dom-overlay. */
  const inActiveXrSession = phase === 'active' && (xrSession != null || hasNativeXrSession)
  const showEnableMic2d = dictationEnabled && phase === 'active' && !browserSrAvailable && !inActiveXrSession
  const showGatewayMicHud = dictationEnabled && phase === 'active' && !browserSrAvailable && inActiveXrSession

  const handleToggleHeadsetMic = useCallback(() => {
    if (headsetDictationActive) {
      setHeadsetDictationActive(false)
      setMicStatus((m) => (m === 'listening' || m === 'starting' ? 'idle' : m))
      return
    }
    if (!getGatewaySttWebSocketUrl()) {
      setLastHeardCommand(
        'No STT WebSocket URL. Use https://<your-PC-LAN>:5173 with npm run full, or set VITE_GATEWAY_WS_URL before build.',
      )
      return
    }
    setMicStatus('starting')
    setLastHeardCommand('Requesting microphone and connecting to gateway…')
    setPatientLiveCaption((c) => (String(c).includes('Dictation disabled') ? 'Awaiting patient speech...' : c))
    setSpeakerAttributionStatus((s) =>
      String(s).includes('Dictation disabled') ? 'Awaiting speech...' : s,
    )
    setHeadsetDictationActive(true)
  }, [headsetDictationActive])

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
        phase !== 'ar-minimal' &&
        phase !== 'unsupported-mobile' &&
        arSupport.checked &&
        arSupport.supported && (
        <>
          {!isWebXrDemoSetup && (
          <div className="ar-controls ar-controls__primary">
            <ARButton className="ar-toggle" store={xrStore}>
              {(status) => {
                if (status === 'unsupported') return 'AR Unsupported'
                if (status === 'entered') return 'Exit AR'
                return 'Enter Medical AR HUD'
              }}
            </ARButton>
            {showEnableMic2d && (
              <button type="button" className="mic-enable-btn mic-enable-btn--under-ar" onClick={handleToggleHeadsetMic}>
                {headsetDictationActive ? 'Stop mic' : 'Enable mic'}
              </button>
            )}
          </div>
          )}
          <div className="ar-controls ar-controls__diagnostics runtime-diagnostics" role="status" aria-live="polite">
            <div>{`AR: ${arSupport.reason}`}</div>
            <div>
              {browserSrAvailable
                ? `Browser speech (Web Speech API): ${micStatus} · mic permission: ${micPermission}`
                : dictationEnabled
                  ? `Browser speech: n/a (Quest) — gateway STT: ${headsetDictationActive ? micStatus : 'off'} · tap Enable mic`
                  : 'Browser speech: n/a (Quest) — dictation off (UI-only); mic buttons hidden'}
            </div>
            <div>{`Dictation flags: enabled=${dictationEnabled ? 'yes' : 'no'} · external attribution=${externalDictationActive ? 'yes' : 'no'}`}</div>
            <div>{`Provider label (intent): ${speechProviderLabel}`}</div>
            <div>{`Speaker POST API: ${speechConfig.speakerApiUrl || 'not set — using keyword/heuristic attribution'}`}</div>
            <div>{`Speech budget: ${budgetStatus}`}</div>
            <div>{`Streaming dictation URL (optional / future): ${speechConfig.dictationApiUrl || 'not set — OK; live SR does not use this env var yet'}`}</div>
            <div>{`Headset STT WebSocket: ${getGatewaySttWebSocketUrl() || '(not built — set VITE_GATEWAY_WS_URL for prod)'}`}</div>
          </div>
        </>
      )}

      {phase === 'xr-exiting' && (
        <div className="xr-exit-overlay" role="status" aria-live="polite">
          <p className="xr-exit-overlay__title">Exiting AR…</p>
          <p className="xr-exit-overlay__hint">
            {xrExitReturnsToLanding
              ? 'Returning to the landing page.'
              : 'Returning to the visit summary.'}
          </p>
        </div>
      )}

      {showCanvas && (
        <div
          className={
            phase === 'landing' && arSupport.checked && arSupport.supported ? 'landing-xr-bootstrap' : undefined
          }
        >
          <Canvas
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 1.6, 0], fov: 60 }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0)
            }}
          >
          {arSupport.checked && arSupport.supported ? (
            <XR store={xrStore}>
              <ImmersivePassthroughSync />
              <XrActiveSessionProbe sessionRef={xrNativeSessionRef} onHasNativeSession={onNativeXrSessionChanged} />
              {webxrImmersiveUi ? (
                <>
                  {phase === 'xr-exiting' && (
                    <XRDomOverlay className="xr-exit-overlay xr-exit-overlay--dom">
                      <p className="xr-exit-overlay__title">Exiting AR…</p>
                      <p className="xr-exit-overlay__hint">
                        {xrExitReturnsToLanding
                          ? 'Returning to the landing page.'
                          : 'Returning to the visit summary.'}
                      </p>
                    </XRDomOverlay>
                  )}
                  {phase === 'ar-minimal' && (
                    <Suspense fallback={null}>
                      <ArMinimalExitButton3D onExit={handleExitMinimalAr} />
                    </Suspense>
                  )}
                  {phase === 'onboarding' && (
                    <OnboardingHUD
                      step={onboardingStep}
                      onContinue={handleAdvanceOnboarding}
                      onBeginVisit={handleBeginVisit}
                      demoSetupArSupported
                      inArMode={xrSession != null}
                      onToggleDemoArMode={handleDemoSetupToggleAr}
                    />
                  )}
                  {showActiveImmersiveHud && (
                    <>
                      <WebXrSessionEndBar onEndSimulation={handleEndSimulation} />
                      <XRActiveFallback
                        onEndSimulation={handleEndSimulation}
                        micStatus={micStatus}
                        speechSupported={speechSupported}
                        browserSrAvailable={browserSrAvailable}
                        headsetGatewayStreaming={headsetDictationActive}
                        dictationEnabled={dictationEnabled}
                        patientLiveCaption={patientLiveCaption}
                        speechProviderLabel={speechProviderLabel}
                        speakerAttributionStatus={speakerAttributionStatus}
                        budgetStatus={budgetStatus}
                        lastHeardCommand={lastHeardCommand}
                        showGatewayMicHud={showGatewayMicHud}
                        gatewayMicActive={headsetDictationActive}
                        onGatewayMicToggle={handleToggleHeadsetMic}
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
                          demoSetupArSupported
                          inArMode={xrSession != null}
                          onToggleDemoArMode={handleDemoSetupToggleAr}
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
                  demoSetupArSupported={false}
                  inArMode={false}
                  onToggleDemoArMode={undefined}
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
        </div>
      )}

      {phase === 'ended' && (
        <SessionEndScreen
          key={sessionStartRef.current}
          conversation={conversation}
          vitals={vitals}
          sessionStartTime={sessionStartRef.current}
          onReturnHome={() => setPhase('landing')}
        />
      )}
    </main>
  )
}

export default App
