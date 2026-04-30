import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import { Color, Vector3 } from 'three'

// Reset to a known-good, centered anchor so the HUD is reliably in view in WebXR.
const cameraOffset = new Vector3(0, 0.05, -0.72)
const panelColor = new Color('#091522')

function HUD({ conversation, activeSpeaker, onEndSimulation, patient, micStatus, speechSupported, lastHeardCommand, patientLiveCaption, speakerAttributionStatus, speechProviderLabel, budgetStatus }) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [hoverEnd, setHoverEnd] = useState(false)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const worldOffset = cameraOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const recentConvo = conversation.slice(-2)

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.68, 0.34]} />
        <meshBasicMaterial color={panelColor} transparent opacity={0.86} depthWrite={false} />
      </mesh>
      <Text position={[0, 0.11, 0.002]} anchorX="center" anchorY="middle" fontSize={0.033} color="#cfe8ff">
        MEDARVIEW ACTIVE
      </Text>
      <Text position={[0, 0.06, 0.002]} anchorX="center" anchorY="middle" fontSize={0.02} color="#f3f8ff">
        {`Patient: ${patient.name} (${patient.age})`}
      </Text>
      <Text position={[0, 0.028, 0.002]} anchorX="center" anchorY="middle" fontSize={0.017} color="#8af3d1">
        {`Active: ${activeSpeaker}`}
      </Text>
      <Text position={[0, 0.001, 0.002]} anchorX="center" anchorY="middle" fontSize={0.015} color="#9dbfe8">
        {`Mic: ${speechSupported ? micStatus : 'unsupported'}`}
      </Text>
      <Text position={[0, -0.024, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#6bb5ff" maxWidth={0.6} textAlign="center">
        {speechProviderLabel ? `Provider: ${speechProviderLabel}` : 'Provider: --'}
      </Text>
      <Text position={[0, -0.047, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#6bb5ff" maxWidth={0.6} textAlign="center">
        {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
      </Text>
      <Text position={[0, -0.07, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#9dbfe8" maxWidth={0.6} textAlign="center">
        {lastHeardCommand ? `Heard: ${lastHeardCommand}` : 'Heard: --'}
      </Text>
      <Text position={[0, -0.094, 0.002]} anchorX="center" anchorY="middle" fontSize={0.013} color="#fff6de" maxWidth={0.6} textAlign="center">
        {patientLiveCaption || 'Awaiting patient speech...'}
      </Text>
      <Text position={[0, -0.117, 0.002]} anchorX="center" anchorY="middle" fontSize={0.012} color="#4f7a9a" maxWidth={0.6} textAlign="center">
        {speakerAttributionStatus ? `Attribution: ${speakerAttributionStatus}` : 'Attribution: --'}
      </Text>
      {recentConvo[0] && (
        <Text position={[0, -0.14, 0.002]} anchorX="center" anchorY="middle" fontSize={0.012} color="#e8f4ff" maxWidth={0.62} textAlign="center">
          {`${recentConvo[recentConvo.length - 1].speaker}: ${recentConvo[recentConvo.length - 1].text.slice(0, 64)}`}
        </Text>
      )}

      <group position={[0, -0.185, 0]}>
        <mesh
          position={[0, 0, -0.002]}
          onClick={onEndSimulation}
          onPointerOver={() => setHoverEnd(true)}
          onPointerOut={() => setHoverEnd(false)}
        >
          <planeGeometry args={[0.3, 0.058]} />
          <meshBasicMaterial color={hoverEnd ? '#8f1527' : '#5c0f1a'} transparent opacity={0.9} />
        </mesh>
        <Line
          points={[[-0.15, -0.029, 0.001], [0.15, -0.029, 0.001], [0.15, 0.029, 0.001], [-0.15, 0.029, 0.001], [-0.15, -0.029, 0.001]]}
          color="#ff6a78"
          lineWidth={4}
          transparent
          opacity={0.95}
        />
        <Text position={[0, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.022} color="#ffcdd3">
          END SIMULATION
        </Text>
      </group>
    </group>
  )
}

export default HUD
