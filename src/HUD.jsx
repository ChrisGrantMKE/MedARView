import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Color, Vector3 } from 'three'

const cameraOffset = new Vector3(-0.28, 0.18, -0.65)
const panelColor = new Color('#091522')
const endDefault = new Color('#5c0f1a')
const endHover = new Color('#8f1527')

function HUD({ vitals, conversation, activeSpeaker, onEndSimulation, patient, micStatus, speechSupported, lastHeardCommand, speakerAttributionStatus, speechProviderLabel, budgetStatus }) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [hoverEnd, setHoverEnd] = useState(false)

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = cameraOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const summaryText = useMemo(() => [
    `Patient: ${patient.name} (${patient.age})`,
    `ID: ${patient.id}`,
    `History: ${patient.history}`,
    `AI Abstract: ${patient.aiAbstract}`,
  ].join('\n'), [patient])

  const recentConvo = conversation.slice(-3)

  return (
    <group ref={groupRef}>

      {/* ─── LIVE VITALS ─── */}
      <group position={[0, 0.1, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.56, 0.2]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.58} />
        </mesh>
        <Text position={[-0.255, 0.055, 0]} anchorX="left" anchorY="middle" fontSize={0.027} color="#cfe8ff">
          LIVE VITALS
        </Text>
        <Text position={[-0.255, 0.004, 0]} anchorX="left" anchorY="middle" fontSize={0.038} color="#ffffff">
          {`BP ${vitals.systolic}/${vitals.diastolic}`}
        </Text>
        <Text position={[0.06, 0.004, 0]} anchorX="left" anchorY="middle" fontSize={0.038} color="#8af3d1">
          {`SpO2 ${vitals.spo2}%`}
        </Text>
      </group>

      {/* ─── CONVERSATION LOG ─── */}
      <group position={[0, -0.12, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.56, 0.26]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.58} />
        </mesh>

        {/* Header */}
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

        {/* Conversation entries (last 3) */}
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
      <group position={[0, -0.39, 0]}>
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
      <group position={[0, -0.605, 0]}>
        <mesh
          position={[0, 0, -0.002]}
          onClick={onEndSimulation}
          onPointerOver={() => setHoverEnd(true)}
          onPointerOut={() => setHoverEnd(false)}
        >
          <planeGeometry args={[0.56, 0.068]} />
          <meshBasicMaterial color={hoverEnd ? endHover : endDefault} transparent opacity={0.9} />
        </mesh>
        <Text position={[0, 0, 0]} anchorX="center" anchorY="middle" fontSize={0.023} color="#ffcdd3">
          END SIMULATION
        </Text>
      </group>

    </group>
  )
}

export default HUD
