import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import { Vector3 } from 'three'

const obOffset = new Vector3(0, 0.05, -0.72)
const panelDark = '#091522'
const btnDefault = '#0e4d7a'
const btnHover = '#1a6fa8'
const btnGreen = '#0b5c3a'
const btnGreenHover = '#0d7a4e'

const STEPS = [
  {
    heading: 'Welcome to MedARView',
    body: 'Please press Continue to begin.',
    cta: 'Continue',
  },
  {
    heading: null,
    body: 'Physicians are losing the ability to be fully present with their patients. Screen-based documentation pulls their attention away during every consultation, reducing eye contact, eroding trust and driving burnout.',
    cta: 'Continue',
  },
  {
    heading: null,
    body: "MedARView restores presence by moving clinical intelligence into the doctor's field of vision, enabling eye-contact-first care while eliminating the documentation burden that follows every patient encounter.",
    cta: 'Continue to Begin',
  },
]

function circlePoints(cx, cy, r, segs = 24) {
  return Array.from({ length: segs + 1 }, (_, i) => {
    const a = (i / segs) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]
  })
}

function PatientSilhouette({ x = 0, y = 0, s = 1 }) {
  const p = {
    color: '#6bb5ff',
    lineWidth: 1.5,
    dashed: true,
    dashScale: 40,
    gapSize: 0.3,
  }

  return (
    <group>
      {/* Head */}
      <Line points={circlePoints(x, y + 0.14 * s, 0.048 * s)} {...p} />
      {/* Neck */}
      <Line points={[[x, y + 0.092 * s, 0], [x, y + 0.074 * s, 0]]} {...p} />
      {/* Shoulders */}
      <Line points={[[x - 0.092 * s, y + 0.064 * s, 0], [x + 0.092 * s, y + 0.064 * s, 0]]} {...p} />
      {/* Left arm */}
      <Line points={[
        [x - 0.092 * s, y + 0.064 * s, 0],
        [x - 0.112 * s, y + 0.000 * s, 0],
        [x - 0.102 * s, y - 0.060 * s, 0],
      ]} {...p} />
      {/* Right arm */}
      <Line points={[
        [x + 0.092 * s, y + 0.064 * s, 0],
        [x + 0.112 * s, y + 0.000 * s, 0],
        [x + 0.102 * s, y - 0.060 * s, 0],
      ]} {...p} />
      {/* Left torso side */}
      <Line points={[[x - 0.068 * s, y + 0.064 * s, 0], [x - 0.068 * s, y - 0.060 * s, 0]]} {...p} />
      {/* Right torso side */}
      <Line points={[[x + 0.068 * s, y + 0.064 * s, 0], [x + 0.068 * s, y - 0.060 * s, 0]]} {...p} />
      {/* Hip / lap */}
      <Line points={[[x - 0.092 * s, y - 0.060 * s, 0], [x + 0.092 * s, y - 0.060 * s, 0]]} {...p} />
      {/* Left knee */}
      <Line points={[[x - 0.052 * s, y - 0.060 * s, 0], [x - 0.052 * s, y - 0.136 * s, 0]]} {...p} />
      {/* Right knee */}
      <Line points={[[x + 0.052 * s, y - 0.060 * s, 0], [x + 0.052 * s, y - 0.136 * s, 0]]} {...p} />
      {/* Floor / feet */}
      <Line points={[[x - 0.092 * s, y - 0.136 * s, 0], [x + 0.092 * s, y - 0.136 * s, 0]]} {...p} />
    </group>
  )
}

function OnboardingHUD({ step, onContinue, onBeginVisit, speechSupported, micStatus, lastHeardCommand }) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [hovering, setHovering] = useState(false)
  const [hoverBegin, setHoverBegin] = useState(false)

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = obOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  // ── Steps 0–2: message panel ──────────────────────────────────────
  if (step <= 2) {
    const { heading, body, cta } = STEPS[step]
    const bodyY = heading ? 0.018 : 0.055

    return (
      <group ref={groupRef}>
        <mesh position={[0, 0.02, -0.002]}>
          <planeGeometry args={[0.54, 0.36]} />
          <meshBasicMaterial color={panelDark} transparent opacity={0.72} />
        </mesh>

        {heading && (
          <Text
            position={[0, 0.13, 0]}
            anchorX="center"
            anchorY="middle"
            fontSize={0.034}
            color="#cfe8ff"
          >
            {heading}
          </Text>
        )}

        <Text
          position={[0, bodyY, 0]}
          anchorX="center"
          anchorY="middle"
          fontSize={0.021}
          maxWidth={0.47}
          textAlign="center"
          lineHeight={1.45}
          color="#f3f8ff"
        >
          {body}
        </Text>

        {/* Continue button */}
        <mesh
          position={[0, -0.128, 0]}
          onClick={onContinue}
          onPointerOver={() => setHovering(true)}
          onPointerOut={() => setHovering(false)}
        >
          <planeGeometry args={[0.19, 0.05]} />
          <meshBasicMaterial color={hovering ? btnHover : btnDefault} transparent opacity={0.9} />
        </mesh>
        <Text position={[0, -0.128, 0.002]} anchorX="center" anchorY="middle" fontSize={0.021} color="#ffffff">
          {cta}
        </Text>
      </group>
    )
  }

  // ── Step 3: Demo setup ────────────────────────────────────────────
  return (
    <group ref={groupRef}>
      {/* Full background */}
      <mesh position={[0.05, 0, -0.002]}>
        <planeGeometry args={[0.70, 0.58]} />
        <meshBasicMaterial color={panelDark} transparent opacity={0.72} />
      </mesh>

      {/* ── Left: instructions ── */}
      <Text
        position={[-0.14, 0.245, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.026}
        color="#cfe8ff"
      >
        DEMO SETUP
      </Text>

      <Text
        position={[-0.14, 0.04, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.019}
        maxWidth={0.32}
        textAlign="left"
        lineHeight={1.5}
        color="#f3f8ff"
      >
        {`This simulation requires 2 people.\n\nImagine you have entered the visit room wearing your glasses and the patient is having vitals taken.\n\nWith a colleague sitting across from you, say out loud:\n\n"MED VIEW Begin Visit"`}
      </Text>

      {/* Listening indicator */}
      <Text
        position={[-0.14, -0.232, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.018}
        color="#6bb5ff"
      >
        {speechSupported ? `[ MIC ] ${micStatus}` : '[ MIC ] SpeechRecognition unsupported'}
      </Text>

      <Text
        position={[-0.14, -0.252, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.012}
        color="#3a7aaa"
        maxWidth={0.31}
        textAlign="center"
      >
        {lastHeardCommand ? `Last heard: ${lastHeardCommand}` : 'Last heard: --'}
      </Text>

      {/* Manual Begin Visit fallback button */}
      <mesh
        position={[-0.14, -0.292, 0]}
        onClick={onBeginVisit}
        onPointerOver={() => setHoverBegin(true)}
        onPointerOut={() => setHoverBegin(false)}
      >
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color={hoverBegin ? btnGreenHover : btnGreen} transparent opacity={0.88} />
      </mesh>
      <Text position={[-0.14, -0.292, 0.002]} anchorX="center" anchorY="middle" fontSize={0.017} color="#a8f5d0">
        TAP TO BEGIN VISIT
      </Text>

      {/* ── Right: patient silhouette ── */}
      <mesh position={[0.26, 0.04, -0.003]}>
        <planeGeometry args={[0.22, 0.46]} />
        <meshBasicMaterial color="#050f18" transparent opacity={0.55} />
      </mesh>

      <PatientSilhouette x={0.26} y={0.06} s={1.3} />

      <Text
        position={[0.26, -0.215, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.019}
        color="#6bb5ff"
      >
        PATIENT
      </Text>
      <Text
        position={[0.26, -0.238, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.014}
        color="#3a7aaa"
      >
        (~8 ft / 2.4 m away)
      </Text>
    </group>
  )
}

export default OnboardingHUD
