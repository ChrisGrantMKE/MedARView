import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Image } from '@react-three/drei'
import { Vector3 } from 'three'
import seatedOutlineUrl from './assets/Seated.svg'
import RoundedRect from './hud/RoundedRect'
import { xrUiPointerEventsType } from './hud/hudTheme'

const obOffset = new Vector3(0, 0.05, -0.72)
/** Demo setup (step 3): lower HUD ~20% of panel height so it sits less “in the air”. */
const DEMO_PANEL_H = 0.812
const obOffsetDemoSetup = new Vector3(0, 0.05 - DEMO_PANEL_H * 0.2, -0.72)
const panelDark = '#091522'
const btnDefault = '#0e4d7a'
const btnHover = '#1a6fa8'

/** Matches instruction column (`maxWidth` 0.38); padding ~1rem at HUD scale. */
const DEMO_INSTRUCTION_FS = 0.019
const BEGIN_BTN_W = 0.38
const BEGIN_REM_PAD = 0.018
const BEGIN_BTN_H = DEMO_INSTRUCTION_FS * 1.25 + 2 * BEGIN_REM_PAD

function beginVisitBtnRadius(w, h) {
  const half = Math.min(w, h) / 2
  return Math.min(0.014, Math.max(0.004, half * 0.2))
}

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

function OnboardingHUD({ step, onContinue, onBeginVisit }) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [hovering, setHovering] = useState(false)

  const beginFillR = useMemo(() => beginVisitBtnRadius(BEGIN_BTN_W, BEGIN_BTN_H), [])

  /** Left column: instructions start at x = -0.29; button centered under that block. */
  const beginVisitOffset = useMemo(() => {
    const centerX = -0.29 + BEGIN_BTN_W / 2
    const centerY = -0.103
    return [centerX, centerY, 0.005]
  }, [])

  useFrame(() => {
    if (!groupRef.current) return
    const offset = step >= 3 ? obOffsetDemoSetup : obOffset
    const worldOffset = offset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const pickBegin = (e) => {
    e.stopPropagation()
    onBeginVisit?.()
  }

  // ── Steps 0–2: message panel ──────────────────────────────────────
  if (step < 3) {
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
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.98, 0.812]} />
        <meshBasicMaterial color={panelDark} transparent opacity={0.72} />
      </mesh>

      <Text position={[0, 0.36, 0]} anchorX="center" anchorY="middle" fontSize={0.026} color="#cfe8ff">
        DEMO SETUP
      </Text>

      <Text
        position={[-0.29, 0.06, 0]}
        anchorX="left"
        anchorY="middle"
        fontSize={DEMO_INSTRUCTION_FS}
        maxWidth={0.38}
        textAlign="left"
        lineHeight={1.5}
        color="#f3f8ff"
      >
        {`This simulation requires 2 people.\n\nImagine you have entered the visit room wearing your glasses and the patient is having vitals taken.\n\nWith a colleague sitting across from you, say out loud:\n\n"MED VIEW Begin Visit"`}
      </Text>

      {onBeginVisit ? (
        <group position={beginVisitOffset}>
          <RoundedRect
            width={BEGIN_BTN_W}
            height={BEGIN_BTN_H}
            radius={beginFillR}
            color="#0b5c3a"
            opacity={0.94}
            borderColor="#5ecf8f"
            borderOpacity={0.45}
            borderWidth={1}
            z={-0.002}
            depthTest={false}
            pointerEventsOrder={1000}
            pointerEventsType={xrUiPointerEventsType}
            onClick={pickBegin}
            onPointerDown={pickBegin}
          />
          <Text
            position={[0, 0, 0.004]}
            anchorX="center"
            anchorY="middle"
            fontSize={DEMO_INSTRUCTION_FS}
            color="#a8f5d0"
            pointerEventsOrder={1000}
            pointerEventsType={xrUiPointerEventsType}
            onClick={pickBegin}
            onPointerDown={pickBegin}
          >
            Begin visit
          </Text>
        </group>
      ) : null}

      <mesh position={[0.29, 0.04, -0.003]}>
        <planeGeometry args={[0.22, 0.46]} />
        <meshBasicMaterial color="#050f18" transparent opacity={0.55} />
      </mesh>

      <Image
        url={seatedOutlineUrl}
        position={[0.29, 0.06, 0]}
        scale={[0.135, 0.26, 1]}
        transparent
        opacity={0.9}
      />

      <Text position={[0.29, -0.215, 0]} anchorX="center" anchorY="middle" fontSize={0.019} color="#6bb5ff">
        PATIENT
      </Text>
      <Text position={[0.29, -0.238, 0]} anchorX="center" anchorY="middle" fontSize={0.014} color="#3a7aaa">
        (~8 ft / 2.4 m away)
      </Text>

      <Text position={[0.29, -0.28, 0]} anchorX="center" anchorY="middle" fontSize={0.016} maxWidth={0.42} textAlign="center" color="#9dbfe8">
        Tap “Begin visit” under the instructions when ready.
      </Text>
    </group>
  )
}

export default OnboardingHUD
