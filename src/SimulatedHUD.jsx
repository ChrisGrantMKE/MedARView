import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, useVideoTexture } from '@react-three/drei'
import { Color, Vector3 } from 'three'

import HudMenuPanel from './hud/HudMenuPanel'
import RoundedRect from './hud/RoundedRect'
import patientVideoUrl from './assets/patient.mp4'

const PATIENT_BG_FALLBACK = '#1e3248'

const hudOffset = new Vector3(0, 0.05, -0.72)

const panelColor = new Color('#091522')

/** Plane behind HUD video: 10% wider than 1.4, height unchanged; centered for natural perspective. */
const PATIENT_BG_WIDTH = 1.4 * 1.1
const PATIENT_BG_HEIGHT = 1.2

/** Patient live chip: top-right; 50% of prior 0.72 width */
const PATIENT_LIVE_W = 0.72 * 0.5
const PATIENT_LIVE_H = 0.1
const PATIENT_LIVE_INSET_X = 0.02
const PATIENT_LIVE_INSET_Y = 0.02

const CONV_W = 0.56
const CONV_H = 0.26
const END_SIM_W = 0.42 * 0.5
const END_SIM_H = 0.068 * 0.5
const END_SIM_FONT = 0.023 * 0.5
const LOWER_RIGHT_INSET_X = 0.02
/** Half prior inset — sit closer to bottom edge */
const LOWER_EDGE_INSET_Y = 0.04 * 0.5
const PANEL_STACK_GAP = 0.02

/** Corner radius tuned for ~8px visual at typical simulated-HUD scale (world units). */
function panelRadiusForSize(width, height, cap = 0.018) {
  const half = Math.min(width, height) / 2
  return Math.min(cap, Math.max(0.006, half * 0.22))
}

function SimulatedHUD({
  conversation,
  activeSpeaker,
  onEndSimulation,
  patientLiveCaption,
  speakerAttributionStatus,
  speechProviderLabel,
  budgetStatus,
}) {
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [overlayEnabled, setOverlayEnabled] = useState(true)
  const [videoFailed, setVideoFailed] = useState(false)
  const groupRef = useRef(null)
  const { camera, gl, scene } = useThree()

  useLayoutEffect(() => {
    const prevBg = scene.background
    const prevClear = new Color()
    gl.getClearColor(prevClear)
    const prevAlpha = gl.getClearAlpha()
    scene.background = new Color('#ffffff')
    gl.setClearColor('#ffffff', 1)
    return () => {
      scene.background = prevBg
      gl.setClearColor(prevClear, prevAlpha)
    }
  }, [gl, scene])

  const videoTexture = useVideoTexture(patientVideoUrl, {
    loop: true,
    muted: true,
    start: true,
    crossOrigin: 'anonymous',
    playsInline: true,
    onError: () => setVideoFailed(true),
  })

  const menuLayout = useMemo(() => {
    const depth = Math.abs(hudOffset.z)
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
    /* Taller left stack: rows + detail card + hint */
    const panelTopToOrigin = 0.34 * scale

    return {
      scale,
      position: [xLeft + panelHalfWidth, yTop - panelTopToOrigin, 0],
    }
  }, [camera.aspect, camera.fov])

  const viewBounds = useMemo(() => {
    const depth = Math.abs(hudOffset.z)
    const fovRad = (camera.fov * Math.PI) / 180
    const visibleHeight = 2 * Math.tan(fovRad / 2) * depth
    const visibleWidth = visibleHeight * camera.aspect
    return { visibleHeight, visibleWidth }
  }, [camera.aspect, camera.fov])

  const patientLivePosition = useMemo(() => {
    const { visibleHeight, visibleWidth } = viewBounds
    const x = visibleWidth / 2 - PATIENT_LIVE_W / 2 - PATIENT_LIVE_INSET_X
    const y = visibleHeight / 2 - PATIENT_LIVE_H / 2 - PATIENT_LIVE_INSET_Y
    return [x, y, 0]
  }, [viewBounds])

  /** Conversation above end bar; right inset matches top-right live chip. */
  const lowerRightLayout = useMemo(() => {
    const { visibleHeight, visibleWidth } = viewBounds
    const xRight = visibleWidth / 2 - CONV_W / 2 - LOWER_RIGHT_INSET_X
    const yEnd = -visibleHeight / 2 + LOWER_EDGE_INSET_Y + END_SIM_H / 2
    const yConv = yEnd + END_SIM_H / 2 + PANEL_STACK_GAP + CONV_H / 2
    return {
      conversation: [xRight, yConv, 0],
      endSimulation: [0, yEnd, 0],
    }
  }, [viewBounds])

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = hudOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const recentConvo = conversation.slice(-3)

  const patientLiveR = panelRadiusForSize(PATIENT_LIVE_W, PATIENT_LIVE_H)
  const convR = panelRadiusForSize(CONV_W, CONV_H)
  const endSimR = panelRadiusForSize(END_SIM_W, END_SIM_H, 0.014)

  return (
    <group ref={groupRef}>
      {/* Fullscreen patient background: video; solid color if load fails */}
      <mesh position={[0, 0, -0.028]}>
        <planeGeometry args={[PATIENT_BG_WIDTH, PATIENT_BG_HEIGHT]} />
        <meshBasicMaterial
          map={videoFailed ? null : videoTexture}
          color={videoFailed ? PATIENT_BG_FALLBACK : '#ffffff'}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

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

      <>
        {/* On top of video area: caption + simulated mic note in one panel */}
        <group position={patientLivePosition}>
            <RoundedRect
              width={PATIENT_LIVE_W}
              height={PATIENT_LIVE_H}
              radius={patientLiveR}
              color={panelColor}
              opacity={0.72}
              borderColor="#5a7a9a"
              borderOpacity={0.35}
              borderWidth={1}
              z={-0.002}
            />
            <Text position={[-PATIENT_LIVE_W / 2 + 0.01, 0.028, 0]} anchorX="left" anchorY="middle" fontSize={0.013} color="#f3c96b">
              PATIENT LIVE
            </Text>
            <Text position={[-PATIENT_LIVE_W / 2 + 0.01, 0.004, 0]} anchorX="left" anchorY="middle" fontSize={0.01} color="#9dbfe8">
              Mic: disabled (simulated mode)
            </Text>
            <Text
              position={[-PATIENT_LIVE_W / 2 + 0.01, -0.024, 0]}
              anchorX="left"
              anchorY="top"
              fontSize={0.014}
              color="#fff6de"
              maxWidth={0.32}
              textAlign="left"
              lineHeight={1.25}
            >
              {patientLiveCaption || 'Awaiting patient speech...'}
            </Text>
        </group>

        <group position={lowerRightLayout.conversation}>
            <RoundedRect
              width={CONV_W}
              height={CONV_H}
              radius={convR}
              color={panelColor}
              opacity={0.58}
              borderColor="#5a7a9a"
              borderOpacity={0.3}
              borderWidth={1}
              z={-0.002}
            />
            <Text position={[-CONV_W / 2 + 0.01, 0.096, 0]} anchorX="left" anchorY="middle" fontSize={0.022} color="#cfe8ff">
              CONVERSATION
            </Text>
            <Text position={[CONV_W / 2 - 0.01, 0.096, 0]} anchorX="right" anchorY="middle" fontSize={0.015} color="#8af3d1">
              {`Active: ${activeSpeaker}`}
            </Text>
            <Text position={[CONV_W / 2 - 0.01, 0.066, 0]} anchorX="right" anchorY="middle" fontSize={0.012} color="#4f7a9a" maxWidth={0.21} textAlign="right">
              {speakerAttributionStatus ? `Attribution: ${speakerAttributionStatus}` : 'Attribution: --'}
            </Text>
            <Text position={[CONV_W / 2 - 0.01, 0.04, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
            </Text>
            <Text position={[CONV_W / 2 - 0.01, 0.014, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
            </Text>
            {recentConvo.length === 0 ? (
              <Text position={[-CONV_W / 2 + 0.01, 0.006, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color="#3a5a70">
                Conversation will appear here...
              </Text>
            ) : (
              recentConvo.map((entry, i) => {
                const yPos = 0.03 - i * 0.052
                const label = entry.speaker === 'Doctor' ? 'Dr' : 'Pt'
                const labelColor = entry.speaker === 'Doctor' ? '#8af3d1' : '#f3c96b'
                const truncated = entry.text.length > 46 ? entry.text.slice(0, 46) + '\u2026' : entry.text
                return (
                  <group key={entry.id}>
                    <Text position={[-CONV_W / 2 + 0.01, yPos, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color={labelColor}>
                      {`${label}:`}
                    </Text>
                    <Text position={[-CONV_W / 2 + 0.053, yPos, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color="#e8f4ff">
                      {truncated}
                    </Text>
                  </group>
                )
              })
            )}
        </group>

        <group position={lowerRightLayout.endSimulation}>
            <RoundedRect
              width={END_SIM_W}
              height={END_SIM_H}
              radius={endSimR}
              color="#5c0f1a"
              opacity={0.9}
              borderColor="#ff8a95"
              borderOpacity={0.45}
              borderWidth={1}
              z={-0.002}
              onClick={(e) => {
                e.stopPropagation()
                onEndSimulation()
              }}
            />
            <Text position={[0, 0, 0.003]} anchorX="center" anchorY="middle" fontSize={END_SIM_FONT} color="#ffcdd3">
              END SIMULATION
            </Text>
        </group>
      </>
    </group>
  )
}

export default SimulatedHUD