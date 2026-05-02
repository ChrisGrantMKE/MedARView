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
const DEMO_PANEL_W = 0.98
const obOffsetDemoSetup = new Vector3(0, 0.05 - DEMO_PANEL_H * 0.2, -0.72)
const panelDark = '#091522'
const btnDefault = '#0e4d7a'
const btnHover = '#1a6fa8'

/** ~1rem at this HUD scale — spacing under DEMO SETUP title */
const REM_HUD = 0.018
/** Prior gap from instruction block to Begin visit ~0.04 world units; user requested 3× */
const GAP_INSTRUCTION_TO_BEGIN = 0.04 * 3

/** Matches instruction column (`maxWidth` 0.38); padding ~1rem at HUD scale. */
const DEMO_INSTRUCTION_FS = 0.019
const BEGIN_BTN_W = 0.38
const BEGIN_REM_PAD = 0.018
const BEGIN_BTN_H = DEMO_INSTRUCTION_FS * 1.25 + 2 * BEGIN_REM_PAD

const PANEL_HALF_H = DEMO_PANEL_H / 2
const LEFT_PAD = 0.06
/** Top-left x for instruction column inside main overlay */
const LEFT_COL_X = -DEMO_PANEL_W / 2 + LEFT_PAD
/** Instruction block vertical extent (approx lines × lineHeight × fontSize) for layout below header */
const INSTRUCTION_BLOCK_H = 0.21

const AR_BTN_W = 0.34
const AR_BTN_H = 0.042

/** Patient illustration + labels: 50% larger than prior */
const PATIENT_SCALE_MUL = 1.5
const PATIENT_IMG_SCALE_X = 0.135 * PATIENT_SCALE_MUL
const PATIENT_IMG_SCALE_Y = 0.26 * PATIENT_SCALE_MUL

function beginVisitBtnRadius(w, h) {
  const half = Math.min(w, h) / 2
  return Math.min(0.014, Math.max(0.004, half * 0.2))
}

function arToggleBtnRadius(w, h) {
  const half = Math.min(w, h) / 2
  return Math.min(0.016, Math.max(0.004, half * 0.22))
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

function OnboardingHUD({
  step,
  onContinue,
  onBeginVisit,
  demoSetupArSupported,
  inArMode,
  onToggleDemoArMode,
}) {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const [hovering, setHovering] = useState(false)
  const [arHovering, setArHovering] = useState(false)

  const beginFillR = useMemo(() => beginVisitBtnRadius(BEGIN_BTN_W, BEGIN_BTN_H), [])
  const arFillR = useMemo(() => arToggleBtnRadius(AR_BTN_W, AR_BTN_H), [])

  const demoTitleFs = 0.026
  /** DEMO SETUP — top-centered on main overlay */
  const titleTopY = PANEL_HALF_H - 0.026
  /** AR toggle — 1 rem below title block */
  const arBtnCenterY = titleTopY - demoTitleFs - REM_HUD - AR_BTN_H / 2

  /** Header stack bottom (AR button bottom edge) + gap before left instruction column */
  const headerBottomY = arBtnCenterY - AR_BTN_H / 2 - 0.032
  /** Instructions: top-left within overlay, below header */
  const instructionTopY = headerBottomY

  /** Begin visit — below instruction block with 3× prior spacing */
  const beginVisitCenterY = instructionTopY - INSTRUCTION_BLOCK_H - GAP_INSTRUCTION_TO_BEGIN - BEGIN_BTN_H / 2
  const beginVisitCenterX = LEFT_COL_X + BEGIN_BTN_W / 2

  const beginVisitOffset = useMemo(
    () => [beginVisitCenterX, beginVisitCenterY, 0.005],
    [beginVisitCenterX, beginVisitCenterY],
  )

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

  const pickArToggle = (e) => {
    e.stopPropagation()
    onToggleDemoArMode?.()
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

  const arLabel = inArMode ? 'Exit AR mode' : 'Enter AR mode'
  const arFill = arHovering ? '#1a6fa8' : '#0e4d7a'

  // ── Step 3: Demo setup ────────────────────────────────────────────
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[DEMO_PANEL_W, DEMO_PANEL_H]} />
        <meshBasicMaterial color={panelDark} transparent opacity={0.72} />
      </mesh>

      <Text
        position={[0, titleTopY, 0]}
        anchorX="center"
        anchorY="top"
        fontSize={demoTitleFs}
        color="#cfe8ff"
      >
        DEMO SETUP
      </Text>

      {demoSetupArSupported && onToggleDemoArMode ? (
        <group position={[0, arBtnCenterY, 0.005]}>
          <RoundedRect
            width={AR_BTN_W}
            height={AR_BTN_H}
            radius={arFillR}
            color={arFill}
            opacity={0.92}
            borderColor="#7eb8ff"
            borderOpacity={0.4}
            borderWidth={1}
            z={-0.002}
            depthTest={false}
            pointerEventsOrder={1000}
            pointerEventsType={xrUiPointerEventsType}
            onClick={pickArToggle}
            onPointerDown={pickArToggle}
            onPointerOver={() => setArHovering(true)}
            onPointerOut={() => setArHovering(false)}
          />
          <Text
            position={[0, 0, 0.004]}
            anchorX="center"
            anchorY="middle"
            fontSize={0.019}
            color="#ffffff"
            pointerEventsOrder={1000}
            pointerEventsType={xrUiPointerEventsType}
            onClick={pickArToggle}
            onPointerDown={pickArToggle}
            onPointerOver={() => setArHovering(true)}
            onPointerOut={() => setArHovering(false)}
          >
            {arLabel}
          </Text>
        </group>
      ) : null}

      <Text
        position={[LEFT_COL_X, instructionTopY, 0]}
        anchorX="left"
        anchorY="top"
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

      <Image
        url={seatedOutlineUrl}
        position={[0.29, 0.06, 0]}
        scale={[PATIENT_IMG_SCALE_X, PATIENT_IMG_SCALE_Y, 1]}
        transparent
        opacity={0.9}
      />

      <Text position={[0.29, -0.28, 0]} anchorX="center" anchorY="middle" fontSize={0.019 * PATIENT_SCALE_MUL} color="#6bb5ff">
        PATIENT
      </Text>
      <Text position={[0.29, -0.312, 0]} anchorX="center" anchorY="middle" fontSize={0.014 * PATIENT_SCALE_MUL} color="#3a7aaa">
        (~8 ft / 2.4 m away)
      </Text>

      <Text position={[0.29, -0.355, 0]} anchorX="center" anchorY="middle" fontSize={0.016 * PATIENT_SCALE_MUL} maxWidth={0.42 * PATIENT_SCALE_MUL} textAlign="center" color="#9dbfe8">
        Tap “Begin visit” under the instructions when ready.
      </Text>
    </group>
  )
}

export default OnboardingHUD
