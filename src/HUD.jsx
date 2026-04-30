import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import { Color, Vector3 } from 'three'

import HudMenuPanel from './hud/HudMenuPanel'

const cameraOffset = new Vector3(-0.28, 0.18, -0.65)
const panelColor = new Color('#091522')

/** Match SimulatedHUD: top-right patient live chip (half prior width). */
const PATIENT_LIVE_W = 0.72 * 0.5
const PATIENT_LIVE_H = 0.1
const PATIENT_LIVE_INSET_X = 0.02
const PATIENT_LIVE_INSET_Y = 0.02

function HUD({ conversation, activeSpeaker, onEndSimulation, patient, micStatus, speechSupported, lastHeardCommand, patientLiveCaption, speakerAttributionStatus, speechProviderLabel, budgetStatus }) {
  const groupRef = useRef(null)
  const subtitleTextRef = useRef(null)
  const subtitleOffsetRef = useRef(0.29)
  const { camera } = useThree()
  const [hoverEnd, setHoverEnd] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [overlayEnabled, setOverlayEnabled] = useState(true)
  const menuLayout = useMemo(() => {
    const depth = Math.abs(cameraOffset.z)
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
    return {
      scale,
      position: [xLeft + (baseWidth * scale) / 2, yTop - 0.225 * scale, 0],
    }
  }, [camera.aspect, camera.fov])

  const patientLivePosition = useMemo(() => {
    const depth = Math.abs(cameraOffset.z)
    const fovRad = (camera.fov * Math.PI) / 180
    const visibleHeight = 2 * Math.tan(fovRad / 2) * depth
    const visibleWidth = visibleHeight * camera.aspect
    const x = visibleWidth / 2 - PATIENT_LIVE_W / 2 - PATIENT_LIVE_INSET_X
    const y = visibleHeight / 2 - PATIENT_LIVE_H / 2 - PATIENT_LIVE_INSET_Y
    return [x, y, 0]
  }, [camera.aspect, camera.fov])
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const worldOffset = cameraOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)

    if (!subtitleTextRef.current) return

    const subtitleCaption = patientLiveCaption || ''
    const subtitleEstimatedWidth = Math.max(0.16, subtitleCaption.length * 0.008)
    const subtitleResetX = 0.29
    const subtitleMinX = -0.29 - subtitleEstimatedWidth

    subtitleOffsetRef.current -= delta * 0.12
    if (subtitleOffsetRef.current < subtitleMinX) {
      subtitleOffsetRef.current = subtitleResetX
    }

    subtitleTextRef.current.position.x = subtitleOffsetRef.current
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
      <HudMenuPanel
        position={menuLayout.position}
        scale={menuLayout.scale}
        overlayEnabled={overlayEnabled}
        onToggleOverlay={() => setOverlayEnabled((prev) => !prev)}
        selectedMenuId={selectedMenuId}
        onToggleItem={(id) => setSelectedMenuId((prev) => (prev === id ? null : id))}
        detailHint="Swipe left on the menu panel to close detail"
      />

      {overlayEnabled && (
        <>
          {/* ─── PATIENT LIVE (same chip layout as SimulatedHUD; WebXR uses live mic status) ─── */}
          <group position={patientLivePosition}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[PATIENT_LIVE_W, PATIENT_LIVE_H]} />
              <meshBasicMaterial color={panelColor} transparent opacity={0.72} depthWrite={false} />
            </mesh>
            <Text position={[-PATIENT_LIVE_W / 2 + 0.01, 0.028, 0]} anchorX="left" anchorY="middle" fontSize={0.013} color="#f3c96b">
              PATIENT LIVE
            </Text>
            <Text position={[-PATIENT_LIVE_W / 2 + 0.01, 0.004, 0]} anchorX="left" anchorY="middle" fontSize={0.01} color="#9dbfe8">
              {`Mic: ${speechSupported ? micStatus : 'unsupported'}`}
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

          {/* ─── CONVERSATION LOG ─── */}
          <group position={[0.16, -0.12, 0]}>
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
            <Text position={[0.255, 0.072, 0]} anchorX="right" anchorY="middle" fontSize={0.013} color="#6bb5ff">
              {`Mic: ${speechSupported ? micStatus : 'unsupported'}`}
            </Text>
            <Text position={[0.255, 0.048, 0]} anchorX="right" anchorY="middle" fontSize={0.012} color="#4f7a9a" maxWidth={0.21} textAlign="right">
              {speakerAttributionStatus ? `Attribution: ${speakerAttributionStatus}` : 'Attribution: --'}
            </Text>
            <Text position={[0.255, 0.024, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
            </Text>
            <Text position={[0.255, 0.001, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
            </Text>
            <Text position={[0.255, -0.022, 0]} anchorX="right" anchorY="middle" fontSize={0.011} color="#3f6888" maxWidth={0.21} textAlign="right">
              {lastHeardCommand ? `Heard: ${lastHeardCommand}` : 'Heard: --'}
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

          {/* ─── PATIENT ABSTRACT ─── */}
          <group position={[0.16, -0.39, 0]}>
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

          {/* ─── END SIMULATION BUTTON ─── */}
          <group position={[0.22, -0.62, 0]}>
            <mesh
              position={[0, 0, -0.002]}
              onClick={onEndSimulation}
              onPointerOver={() => setHoverEnd(true)}
              onPointerOut={() => setHoverEnd(false)}
            >
              <planeGeometry args={[0.29, 0.058]} />
              <meshBasicMaterial color={hoverEnd ? '#8f1527' : '#5c0f1a'} transparent opacity={0.85} />
            </mesh>
            <Line
              points={[[-0.145, -0.029, 0.001], [0.145, -0.029, 0.001], [0.145, 0.029, 0.001], [-0.145, 0.029, 0.001], [-0.145, -0.029, 0.001]]}
              color="#ff6a78"
              lineWidth={4}
              transparent
              opacity={0.95}
            />
            <Text position={[0, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.022} color="#ffcdd3">
              END SIMULATION
            </Text>
          </group>

          {/* ─── SCROLLING PATIENT SUBTITLE BAR ─── */}
          <group position={[0, -0.68, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.56, 0.04]} />
              <meshBasicMaterial color={panelColor} transparent opacity={0.8} />
            </mesh>
            <Text
              ref={subtitleTextRef}
              position={[0.29, 0, 0]}
              anchorX="left"
              anchorY="middle"
              fontSize={0.015}
              color="#f3c96b"
              maxWidth={2}
              textAlign="left"
            >
              {patientLiveCaption}
            </Text>
          </group>
        </>
      )}
    </group>
  )
}

export default HUD
