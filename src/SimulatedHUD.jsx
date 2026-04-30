import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, useTexture, useVideoTexture } from '@react-three/drei'
import { Color, Vector3 } from 'three'

import HudMenuPanel from './hud/HudMenuPanel'
import patientVideoUrl from './assets/patient.mp4'
import patientFallbackUrl from './assets/patient.png'

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

function SimulatedHUD({ conversation, activeSpeaker, onEndSimulation, patient, patientLiveCaption, speakerAttributionStatus, speechProviderLabel, budgetStatus }) {
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
  const textures = useTexture([patientFallbackUrl])

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
    const panelTopToOrigin = 0.225 * scale

    return {
      scale,
      position: [xLeft + panelHalfWidth, yTop - panelTopToOrigin, 0],
    }
  }, [camera.aspect, camera.fov])

  const patientLivePosition = useMemo(() => {
    const depth = Math.abs(hudOffset.z)
    const fovRad = (camera.fov * Math.PI) / 180
    const visibleHeight = 2 * Math.tan(fovRad / 2) * depth
    const visibleWidth = visibleHeight * camera.aspect
    const x = visibleWidth / 2 - PATIENT_LIVE_W / 2 - PATIENT_LIVE_INSET_X
    const y = visibleHeight / 2 - PATIENT_LIVE_H / 2 - PATIENT_LIVE_INSET_Y
    return [x, y, 0]
  }, [camera.aspect, camera.fov])

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = hudOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const recentConvo = conversation.slice(-3)
  const summaryText = useMemo(
    () => [
      `Patient: ${patient.name} (${patient.age})`,
      `ID: ${patient.id}`,
      `History: ${patient.history}`,
      `AI Abstract: ${patient.aiAbstract}`,
    ].join('\n'),
    [patient]
  )

  return (
    <group ref={groupRef}>
      {/* Fullscreen patient background: mp4 primary, png fallback. */}
      <mesh position={[0, 0, -0.028]}>
        <planeGeometry args={[PATIENT_BG_WIDTH, PATIENT_BG_HEIGHT]} />
        <meshBasicMaterial
          map={videoFailed ? textures[0] : videoTexture}
          color="#ffffff"
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      <HudMenuPanel
        position={menuLayout.position}
        scale={menuLayout.scale}
        overlayEnabled={overlayEnabled}
        onToggleOverlay={() => setOverlayEnabled((prev) => !prev)}
        selectedMenuId={selectedMenuId}
        onToggleItem={(id) => setSelectedMenuId((prev) => (prev === id ? null : id))}
        detailHint="Tap the same row again to close detail"
      />

      {/* HUD Panels - right side (hidden when overlay is off) */}
      {overlayEnabled && (
        <>
          {/* On top of video area: caption + simulated mic note in one panel */}
          <group position={patientLivePosition}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[PATIENT_LIVE_W, PATIENT_LIVE_H]} />
              <meshBasicMaterial color={panelColor} transparent opacity={0.72} depthWrite={false} />
            </mesh>
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

          <group position={[0.50, -0.38, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.56, 0.26]} />
              <meshBasicMaterial color={panelColor} transparent opacity={0.58} />
            </mesh>
            <Text position={[-0.255, 0.096, 0]} anchorX="left" anchorY="middle" fontSize={0.022} color="#cfe8ff">
              CONVERSATION
            </Text>
            <Text position={[0.255, 0.096, 0]} anchorX="right" anchorY="middle" fontSize={0.015} color="#8af3d1">
              {`Active: ${activeSpeaker}`}
            </Text>
            <Text position={[0.255, 0.066, 0]} anchorX="right" anchorY="middle" fontSize={0.012} color="#4f7a9a" maxWidth={0.21} textAlign="right">
              {speakerAttributionStatus ? `Attribution: ${speakerAttributionStatus}` : 'Attribution: --'}
            </Text>
            <Text position={[0.255, 0.04, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
            </Text>
            <Text position={[0.255, 0.014, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
            </Text>
            {recentConvo.length === 0 ? (
              <Text position={[-0.255, 0.006, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color="#3a5a70">
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
                    <Text position={[-0.255, yPos, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color={labelColor}>
                      {`${label}:`}
                    </Text>
                    <Text position={[-0.213, yPos, 0]} anchorX="left" anchorY="middle" fontSize={0.018} color="#e8f4ff">
                      {truncated}
                    </Text>
                  </group>
                )
              })
            )}
          </group>

          <group position={[0.50, -0.65, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.56, 0.30]} />
              <meshBasicMaterial color={panelColor} transparent opacity={0.56} />
            </mesh>
            <Text position={[-0.255, 0.118, 0]} anchorX="left" anchorY="middle" fontSize={0.027} color="#cfe8ff">
              PATIENT ABSTRACT
            </Text>
            <Text
              position={[-0.255, 0.028, 0]}
              anchorX="left"
              anchorY="top"
              fontSize={0.02}
              maxWidth={0.5}
              lineHeight={1.35}
              textAlign="left"
              color="#f3f8ff"
            >
              {summaryText}
            </Text>
          </group>

          <group position={[0.50, -0.92, 0]}>
            <mesh position={[0, 0, -0.002]} onClick={onEndSimulation}>
              <planeGeometry args={[0.56, 0.068]} />
              <meshBasicMaterial color="#5c0f1a" transparent opacity={0.9} />
            </mesh>
            <Text position={[0, 0, 0]} anchorX="center" anchorY="middle" fontSize={0.023} color="#ffcdd3">
              END SIMULATION
            </Text>
          </group>
        </>
      )}
    </group>
  )
}

export default SimulatedHUD