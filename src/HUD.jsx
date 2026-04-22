import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Color, Vector3 } from 'three'

const cameraOffset = new Vector3(0.28, 0.16, -0.65)
const panelColor = new Color('#091522')
const buttonOnColor = new Color('#0d8f63')
const buttonOffColor = new Color('#5a2531')

function HUD({ vitals, isListening, transcript, speechSupported, onToggleListening, patient }) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [isHoveringMic, setIsHoveringMic] = useState(false)

  useFrame(() => {
    if (!groupRef.current) return

    const worldOffset = cameraOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const summaryText = useMemo(() => {
    return [
      `Patient: ${patient.name} (${patient.age})`,
      `ID: ${patient.id}`,
      `History: ${patient.history}`,
      `AI Abstract: ${patient.aiAbstract}`,
    ].join('\n')
  }, [patient])

  return (
    <group ref={groupRef}>
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

      <group position={[0, -0.1, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.56, 0.2]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.58} />
        </mesh>
        <Text position={[-0.255, 0.055, 0]} anchorX="left" anchorY="middle" fontSize={0.027} color="#cfe8ff">
          VOICE DICTATION
        </Text>
        <Text
          position={[-0.255, -0.002, 0]}
          anchorX="left"
          anchorY="middle"
          fontSize={0.021}
          maxWidth={0.44}
          textAlign="left"
          color="#ffffff"
        >
          {speechSupported ? transcript : 'Speech recognition unavailable in this browser.'}
        </Text>

        <mesh
          position={[0.205, -0.055, 0]}
          onClick={onToggleListening}
          onPointerOver={() => setIsHoveringMic(true)}
          onPointerOut={() => setIsHoveringMic(false)}
        >
          <planeGeometry args={[0.09, 0.05]} />
          <meshBasicMaterial
            color={isListening ? buttonOnColor : buttonOffColor}
            transparent
            opacity={isHoveringMic ? 0.95 : 0.84}
          />
        </mesh>
        <Text position={[0.205, -0.055, 0.002]} anchorX="center" anchorY="middle" fontSize={0.017} color="#ffffff">
          {isListening ? 'STOP' : 'MIC'}
        </Text>
      </group>

      <group position={[0, -0.35, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.56, 0.32]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.56} />
        </mesh>
        <Text position={[-0.255, 0.128, 0]} anchorX="left" anchorY="middle" fontSize={0.027} color="#cfe8ff">
          PATIENT ABSTRACT
        </Text>
        <Text
          position={[-0.255, 0.03, 0]}
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
    </group>
  )
}

export default HUD
