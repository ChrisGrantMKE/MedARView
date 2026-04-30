import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import { Color, Vector3 } from 'three'

const hudOffset = new Vector3(0, 0.05, -0.72)

import patientIconURL from './assets/UI IMAGES/Patient data.png'
import bloodPressureIconURL from './assets/UI IMAGES/BloodpressureO2.png'
import heartRateIconURL from './assets/UI IMAGES/Heartrate.png'
import testResultsIconURL from './assets/UI IMAGES/Testresults.png'
import allergiesIconURL from './assets/UI IMAGES/Allergies.png'
import menuHeaderIconURL from './assets/UI IMAGES/Menu.png'
import patientBgURL from './assets/PATIENT.png'

const panelColor = new Color('#091522')
const detailPanelColor = new Color('#0e1a2e')
const endDefault = new Color('#5c0f1a')
const endHover = new Color('#8f1527')

function SimulatedHUD({ vitals, conversation, activeSpeaker, onEndSimulation, patient, micStatus, speechSupported, lastHeardCommand, patientLiveCaption, speakerAttributionStatus, speechProviderLabel, budgetStatus }) {
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [overlayEnabled, setOverlayEnabled] = useState(true)
  const [touchStartX, setTouchStartX] = useState(null)
  const [dragging, setDragging] = useState(false)
  const groupRef = useRef(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    const worldOffset = hudOffset.clone().applyQuaternion(camera.quaternion)
    groupRef.current.position.copy(camera.position).add(worldOffset)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const textures = useTexture([
    patientIconURL,
    bloodPressureIconURL,
    heartRateIconURL,
    testResultsIconURL,
    allergiesIconURL,
    menuHeaderIconURL,
    patientBgURL,
  ])

  const menuItems = useMemo(() => [
    {
      id: 'patient',
      label: 'Patient data',
      subtitle: 'Last updated 02/14/26',
      icon: textures[0],
      body: 'Reyan Verol • 74 yrs • M • DOB: 01/10/1944. GP visit 10:30 AM. Active meds: Metformin 500 mg, Lisinopril 10 mg, Aspirin 81 mg. Follow-up in 8 weeks.',
    },
    {
      id: 'blood',
      label: 'Blood pressure',
      subtitle: '118 / 76 mmHg • 2h ago',
      icon: textures[1],
      body: 'Systolic/Diastolic recorded at 118/76. Trend is stable within target range. Continue current antihypertensive protocol and monitor for orthostatic changes.',
    },
    {
      id: 'heart',
      label: 'Heart rate',
      subtitle: '94 bpm • live',
      icon: textures[2],
      body: 'Resting heart rate at 94 bpm. Slightly elevated for baseline but within acceptable range for current medication regimen. Watch for >100 bpm.',
    },
    {
      id: 'tests',
      label: 'Test results',
      subtitle: '3 of 5 in range • 24 Apr',
      icon: textures[3],
      body: 'Glucose 120 mg/dL • Cholesterol 198 mg/dL • HBA1c 7.1% • Hemoglobin 11.8 g/dL • eGFR 82 mL/min. Two values remain flagged for follow-up.',
    },
    {
      id: 'allergies',
      label: 'Allergies',
      subtitle: '3 documented',
      icon: textures[4],
      body: 'Penicillin: hives and lip swelling. Latex: contact dermatitis and wheezing. No known food allergies documented. Avoid related beta-lactams.',
    },
  ], [textures])

  const selectedMenu = menuItems.find(item => item.id === selectedMenuId)
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

  const handlePointerDown = (event) => {
    setTouchStartX(event.point.x)
    setDragging(true)
  }

  const handlePointerUp = (event) => {
    if (!dragging || touchStartX === null) {
      setDragging(false)
      return
    }
    const deltaX = event.point.x - touchStartX
    setDragging(false)
    setTouchStartX(null)

    if (selectedMenuId && deltaX < -0.08) {
      setSelectedMenuId(null)
    }
  }

  const handleMenuSelect = (id) => {
    setSelectedMenuId(id)
  }

  return (
    <group ref={groupRef}>
      {/* Background image */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[1.4, 1.2]} />
        <meshBasicMaterial map={textures[6]} />
      </mesh>

      {/* Menu Panel - left side */}
      <group position={[-0.65, 0.15, 0]}>
        <mesh
          position={[0, 0, -0.002]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[0.30, 0.44]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.58} />
        </mesh>

        <mesh position={[-0.11, 0.18, 0.001]}>
          <planeGeometry args={[0.095, 0.095]} />
          <meshBasicMaterial map={textures[5]} transparent opacity={0.92} />
        </mesh>
        <Text position={[-0.02, 0.18, 0.002]} anchorX="left" anchorY="middle" fontSize={0.026} color="#e8f4ff" maxWidth={0.18}>
          MENU
        </Text>

        <Text position={[-0.135, 0.125, 0.002]} anchorX="left" anchorY="middle" fontSize={0.013} color="#8fc8ff" maxWidth={0.24}>
          {overlayEnabled ? 'Overlay: On' : 'Overlay: Off'}
        </Text>
        <mesh position={[0.13, 0.12, 0.001]} onClick={() => setOverlayEnabled((prev) => !prev)}>
          <planeGeometry args={[0.08, 0.038]} />
          <meshBasicMaterial color={overlayEnabled ? '#7d9cff' : '#23334d'} transparent opacity={0.86} />
        </mesh>
        <Text position={[0.13, 0.12, 0.003]} anchorX="center" anchorY="middle" fontSize={0.013} color="#f3f7fc">
          {overlayEnabled ? 'On' : 'Off'}
        </Text>

        {menuItems.map((item, index) => {
          const y = 0.05 - index * 0.068
          const selected = item.id === selectedMenuId
          return (
            <group key={item.id} position={[0, y, 0.002]}>
              <mesh
                position={[0, 0, 0]}
                onClick={() => handleMenuSelect(item.id)}
              >
                <planeGeometry args={[0.27, 0.055]} />
                <meshBasicMaterial color={selected ? '#1d3f63' : '#0e1a2e'} transparent opacity={0.88} />
              </mesh>
              <mesh position={[-0.12, 0, 0.003]}>
                <planeGeometry args={[0.042, 0.042]} />
                <meshBasicMaterial map={item.icon} transparent opacity={1} />
              </mesh>
              <Text position={[-0.06, 0.01, 0.003]} anchorX="left" anchorY="middle" fontSize={0.017} color="#f3f7fc">
                {item.label}
              </Text>
              <Text position={[-0.06, -0.013, 0.003]} anchorX="left" anchorY="middle" fontSize={0.011} color="#8fc8ff" maxWidth={0.16}>
                {item.subtitle}
              </Text>
              <Text position={[0.115, 0, 0.003]} anchorX="right" anchorY="middle" fontSize={0.017} color="#8fc8ff">
                {'›'}
              </Text>
            </group>
          )
        })}

        {selectedMenu && (
          <group position={[0, -0.22, 0.002]}>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[0.27, 0.16]} />
              <meshBasicMaterial color={detailPanelColor} transparent opacity={0.88} />
            </mesh>
            <Text position={[-0.125, 0.055, 0.001]} anchorX="left" anchorY="middle" fontSize={0.018} color="#cfe8ff">
              {selectedMenu.label}
            </Text>
            <Text
              position={[-0.125, 0.025, 0.001]}
              anchorX="left"
              anchorY="top"
              fontSize={0.013}
              maxWidth={0.245}
              lineHeight={1.35}
              textAlign="left"
              color="#dce8ff"
            >
              {selectedMenu.body}
            </Text>
            <Text position={[0, -0.067, 0.001]} anchorX="center" anchorY="middle" fontSize={0.01} color="#89c4ff">
              Click menu item again to close
            </Text>
          </group>
        )}
      </group>

      {/* HUD Panels - right side */}
      <group position={[0.50, 0.15, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.56, 0.062]} />
          <meshBasicMaterial color={panelColor} transparent opacity={0.7} />
        </mesh>
        <Text position={[-0.255, 0, 0]} anchorX="left" anchorY="middle" fontSize={0.016} color="#f3c96b">
          PATIENT LIVE
        </Text>
        <Text
          position={[0.29, 0, 0]}
          anchorX="left"
          anchorY="middle"
          fontSize={0.017}
          color="#fff6de"
          maxWidth={0.5}
          textAlign="left"
        >
          {patientLiveCaption || 'Awaiting patient speech...'}
        </Text>
      </group>

      <group position={[0.50, -0.12, 0]}>
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
        <Text position={[0.255, 0.072, 0]} anchorX="right" anchorY="middle" fontSize={0.013} color="#6bb5ff">
          Mic: disabled (simulated mode)
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
        <mesh
          position={[0, 0, -0.002]}
          onClick={onEndSimulation}
        >
          <planeGeometry args={[0.56, 0.068]} />
          <meshBasicMaterial color={endDefault} transparent opacity={0.9} />
        </mesh>
        <Text position={[0, 0, 0]} anchorX="center" anchorY="middle" fontSize={0.023} color="#ffcdd3">
          END SIMULATION
        </Text>
      </group>
    </group>
  )
}

export default SimulatedHUD