import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Image } from '@react-three/drei'
import { Vector3 } from 'three'
import seatedOutlineUrl from './assets/Seated.svg'

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
    cta: 'Continue',
  },
  {
    heading: 'Recording & Data Notice',
    body: 'This app uses your microphone to capture and transcribe conversation audio during a visit session.\n\nAudio is streamed to a third-party speech recognition service for transcription and speaker identification. Transcripts are stored temporarily for this session only and are not transmitted to any additional parties.\n\nThis is a test environment using mock data only. Do not conduct real patient visits using this prototype.\n\nBy pressing Accept & Continue you consent to microphone capture and transcription for the duration of this demo session.',
    cta: 'Accept & Continue',
  },
]

function OnboardingHUD({ step, onContinue, onBeginVisit, speechSupported, micStatus, lastHeardCommand, speechProviderLabel, budgetStatus }) {
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

  // ── Steps 0–3: message panel ──────────────────────────────────────
  if (step <= 3) {
    const { heading, body, cta } = STEPS[step]
    const isConsent = step === 3
    const bodyY = heading ? (isConsent ? 0.04 : 0.018) : 0.055
    const bodyFontSize = isConsent ? 0.017 : 0.021
    const panelHeight = isConsent ? 0.48 : 0.36
    const panelY = isConsent ? 0.03 : 0.02

    return (
      <group ref={groupRef}>
        <mesh position={[0, panelY, -0.002]}>
          <planeGeometry args={[0.54, panelHeight]} />
          <meshBasicMaterial color={panelDark} transparent opacity={0.72} />
        </mesh>

        {heading && (
          <Text
            position={[0, panelY + (panelHeight / 2) - 0.04, 0]}
            anchorX="center"
            anchorY="middle"
            fontSize={isConsent ? 0.026 : 0.034}
            color={isConsent ? '#f3c96b' : '#cfe8ff'}
          >
            {heading}
          </Text>
        )}

        <Text
          position={[0, bodyY, 0]}
          anchorX="center"
          anchorY="top"
          fontSize={bodyFontSize}
          maxWidth={0.47}
          textAlign={isConsent ? 'left' : 'center'}
          lineHeight={1.5}
          color={isConsent ? '#ddeeff' : '#f3f8ff'}
        >
          {body}
        </Text>

        {/* Continue / Accept button */}
        <mesh
          position={[0, panelY - (panelHeight / 2) + 0.04, 0]}
          onClick={onContinue}
          onPointerOver={() => setHovering(true)}
          onPointerOut={() => setHovering(false)}
        >
          <planeGeometry args={[isConsent ? 0.28 : 0.19, 0.05]} />
          <meshBasicMaterial color={isConsent ? (hovering ? '#0d7a4e' : '#0b5c3a') : (hovering ? btnHover : btnDefault)} transparent opacity={0.9} />
        </mesh>
        <Text position={[0, panelY - (panelHeight / 2) + 0.04, 0.002]} anchorX="center" anchorY="middle" fontSize={0.021} color={isConsent ? '#a8f5d0' : '#ffffff'}>
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

      <Text
        position={[-0.14, -0.274, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.012}
        color="#3a7aaa"
        maxWidth={0.31}
        textAlign="center"
      >
        {speechProviderLabel ? `Dictation provider: ${speechProviderLabel}` : 'Dictation provider: --'}
      </Text>

      <Text
        position={[-0.14, -0.296, 0]}
        anchorX="center"
        anchorY="middle"
        fontSize={0.012}
        color="#3a7aaa"
        maxWidth={0.31}
        textAlign="center"
      >
        {budgetStatus ? `Budget: ${budgetStatus}` : 'Budget: --'}
      </Text>

      {/* Manual Begin Visit fallback button */}
      <mesh
        position={[-0.14, -0.334, 0]}
        onClick={onBeginVisit}
        onPointerOver={() => setHoverBegin(true)}
        onPointerOut={() => setHoverBegin(false)}
      >
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color={hoverBegin ? btnGreenHover : btnGreen} transparent opacity={0.88} />
      </mesh>
      <Text position={[-0.14, -0.334, 0.002]} anchorX="center" anchorY="middle" fontSize={0.017} color="#a8f5d0">
        TAP TO BEGIN VISIT
      </Text>

      {/* ── Right: patient silhouette ── */}
      <mesh position={[0.26, 0.04, -0.003]}>
        <planeGeometry args={[0.22, 0.46]} />
        <meshBasicMaterial color="#050f18" transparent opacity={0.55} />
      </mesh>

      <Image
        url={seatedOutlineUrl}
        position={[0.26, 0.06, 0]}
        scale={[0.135, 0.26, 1]}
        transparent
        opacity={0.9}
      />

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
