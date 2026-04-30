import { useMemo, useState } from 'react'
import { Text, useTexture } from '@react-three/drei'
import { Color } from 'three'
import { HUD_MENU_ITEMS } from './menuData'
import { hudTheme } from './hudTheme'
import RoundedRect from './RoundedRect'
import { HudMenuIcon } from './WhiteIconMaterial'
import patientIconUrl from '../assets/SVGS/Patient.svg'
import testResultsIconUrl from '../assets/SVGS/Test Results.svg'
import allergiesIconUrl from '../assets/SVGS/Allergies.svg'
import heartRateIconUrl from '../assets/SVGS/Heart Rate.svg'
import bloodPressureIconUrl from '../assets/SVGS/Blood Pressure.svg'

export default function HudMenuPanel({
  position = [-0.28, 0.12, 0],
  scale = 1,
  overlayEnabled,
  onToggleOverlay,
  selectedMenuId,
  onToggleItem,
  detailHint,
}) {
  const [touchStartX, setTouchStartX] = useState(null)
  const [dragging, setDragging] = useState(false)

  const selectedMenu = HUD_MENU_ITEMS.find((item) => item.id === selectedMenuId)
  const iconTextures = useTexture([
    patientIconUrl,
    testResultsIconUrl,
    allergiesIconUrl,
    heartRateIconUrl,
    bloodPressureIconUrl,
  ])
  const iconMap = useMemo(
    () => ({
      patient: iconTextures[0],
      tests: iconTextures[1],
      allergies: iconTextures[2],
      heart: iconTextures[3],
      blood: iconTextures[4],
    }),
    [iconTextures]
  )

  const surfaceTint = new Color(hudTheme.surfaceTint)

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
      onToggleItem(selectedMenuId)
    }
  }

  const renderDetail = () => {
    if (!selectedMenu) return null

    if (selectedMenu.detail === 'patient') {
      /* Solid fill (not 0.2 — that read as “ghost” over the scene); slightly wider for wrap. */
      const zText = 0.004
      const zPanel = -0.012
      const xl = -0.136
      const xr = 0.136
      const fillW = 0.32
      const fillH = 0.38
      const innerW = 0.292
      return (
        <>
          <RoundedRect width={fillW} height={fillH} radius={0.02} color="#000000" opacity={0.86} borderColor="#accbff" borderOpacity={0.95} z={zPanel} />
          <mesh position={[0, 0.056, zText - 0.001]}>
            <planeGeometry args={[innerW, 0.0018]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh position={[0, -0.062, zText - 0.001]}>
            <planeGeometry args={[innerW, 0.0018]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <Text position={[xl, 0.156, zText]} anchorX="left" anchorY="middle" fontSize={0.014} color="#ffffff">
            Patient
          </Text>
          <Text position={[xl, 0.126, zText]} anchorX="left" anchorY="middle" fontSize={0.021} color="#ffffff" maxWidth={0.27} textAlign="left" lineHeight={1.2}>
            Reyan Verol
          </Text>
          <Text position={[xl, 0.092, zText]} anchorX="left" anchorY="middle" fontSize={0.015} color="#ffffff" maxWidth={0.27} textAlign="left" lineHeight={1.2}>
            74 yrs | M | DOB: 01/10/1944
          </Text>
          <Text position={[xl, 0.062, zText]} anchorX="left" anchorY="middle" fontSize={0.015} color="#ffffff" maxWidth={0.27} textAlign="left" lineHeight={1.2}>
            GP Visit | 10:30 AM
          </Text>

          <Text position={[xl, 0.026, zText]} anchorX="left" anchorY="middle" fontSize={0.016} color="#ffffff">
            Active medication
          </Text>

          <Text position={[xl, -0.002, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            Metformin
          </Text>
          <Text position={[xr, -0.002, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            500 mg daily
          </Text>
          <Text position={[xl, -0.028, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            Lisinopril
          </Text>
          <Text position={[xr, -0.028, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            10 mg daily
          </Text>
          <Text position={[xl, -0.054, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            Aspirin
          </Text>
          <Text position={[xr, -0.054, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            81 mg daily
          </Text>

          <Text position={[xl, -0.088, zText]} anchorX="left" anchorY="middle" fontSize={0.016} color="#ffffff" maxWidth={0.27} textAlign="left" lineHeight={1.2}>
            Last visit - 14 Feb 2026
          </Text>
          <Text position={[xl, -0.114, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            BP
          </Text>
          <Text position={[xr, -0.114, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            148/92
          </Text>
          <Text position={[xl, -0.138, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            HBA1c
          </Text>
          <Text position={[xr, -0.138, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            7.1%
          </Text>
          <Text position={[xl, -0.162, zText]} anchorX="left" anchorY="middle" fontSize={0.0155} color="#ffffff">
            Follow-up
          </Text>
          <Text position={[xr, -0.162, zText]} anchorX="right" anchorY="middle" fontSize={0.0155} color="#ffffff">
            8 weeks
          </Text>

          <group position={[0, -0.218, 0]}>
            <RoundedRect width={fillW} height={0.058} radius={0.02} color="#ffb7b7" opacity={0.95} z={zPanel + 0.002} />
            <Text
              position={[xl, 0, zText]}
              anchorX="left"
              anchorY="middle"
              fontSize={0.0145}
              color="#ffffff"
              maxWidth={0.28}
              textAlign="left"
              lineHeight={1.25}
            >
              • Patient expressed concern about medication side effects at last visit
            </Text>
          </group>
        </>
      )
    }

    if (selectedMenu.detail === 'tests') {
      const rows = [
        ['Glucose', '500 mg daily', 'OK', '#ffffff'],
        ['Cholesterol', '10 mg daily', 'High', '#ec928e'],
        ['HBA1c', '7.1 %', 'OK', '#ffffff'],
        ['Hemoglobin', '118 g/L', 'Low', '#ec928e'],
        ['eGFR', '82 mL/min', 'OK', '#ffffff'],
      ]
      return (
        <>
          <RoundedRect width={0.3} height={0.145} radius={0.02} color="#000000" opacity={0.84} borderColor="#accbff" borderOpacity={0.95} z={-0.01} />
          {rows.map((row, idx) => {
            const y = 0.055 - idx * 0.03
            return (
              <group key={`${row[0]}-${idx}`}>
                <Text position={[-0.128, y, 0.004]} anchorX="left" anchorY="middle" fontSize={0.017} color="#ffffff">{row[0]}</Text>
                <Text position={[0.08, y, 0.004]} anchorX="right" anchorY="middle" fontSize={0.017} color="#ffffff">{row[1]}</Text>
                <Text position={[0.128, y, 0.004]} anchorX="right" anchorY="middle" fontSize={0.017} color={row[3]}>{row[2]}</Text>
              </group>
            )
          })}
        </>
      )
    }

    if (selectedMenu.detail === 'allergies') {
      return (
        <>
          <RoundedRect width={0.3} height={0.21} radius={0.02} color="#000000" opacity={0.84} borderColor="#accbff" borderOpacity={0.95} z={-0.01} />
          <Text
            position={[-0.128, 0.09, 0.004]}
            anchorX="left"
            anchorY="top"
            fontSize={0.016}
            lineHeight={1.32}
            maxWidth={0.255}
            textAlign="left"
            color="#ffffff"
          >
            {'Allergy: Penicillin\n• Reaction: Hives, itching, swelling.\n• Severity: Moderate.\n• Action: Avoid related beta-lactams.\n\nAllergy: Latex\n• Reaction: Contact dermatitis, wheezing.\n• Action: Use latex-free gloves.\n\nNo Known Allergies (NKA)\n• Patient denies known allergies.'}
          </Text>
        </>
      )
    }

    if (selectedMenu.detail === 'heart') {
      return (
        <>
          <RoundedRect width={0.3} height={0.145} radius={0.02} color="#000000" opacity={0.84} borderColor="#accbff" borderOpacity={0.95} z={-0.01} />
          <Text position={[-0.128, 0.055, 0.004]} anchorX="left" anchorY="middle" fontSize={0.022} color="#ffffff">94 bpm</Text>
          <Text position={[-0.128, 0.028, 0.004]} anchorX="left" anchorY="middle" fontSize={0.017} color="#ffffff">Resting · Live Reading</Text>
          <Text position={[-0.128, 0.002, 0.004]} anchorX="left" anchorY="middle" fontSize={0.017} color="#ec928e">• Slightly elevated</Text>
          <RoundedRect width={0.272} height={0.07} radius={0.02} color="#111111" opacity={0.58} borderColor="#ffffff" borderOpacity={0.35} z={-0.006} />
        </>
      )
    }

    return (
      <>
        <RoundedRect width={0.3} height={0.145} radius={0.02} color="#000000" opacity={0.84} borderColor="#accbff" borderOpacity={0.95} z={-0.01} />
        <Text position={[-0.128, 0.055, 0.004]} anchorX="left" anchorY="middle" fontSize={0.022} color="#ffffff">118/76 mmHg</Text>
        <Text position={[-0.128, 0.028, 0.004]} anchorX="left" anchorY="middle" fontSize={0.017} color="#ffffff">Systolic / Diastolic</Text>
        <Text position={[-0.128, 0.002, 0.004]} anchorX="left" anchorY="middle" fontSize={0.017} color="#4ce995">• Normal</Text>
        <RoundedRect width={0.272} height={0.07} radius={0.02} color="#111111" opacity={0.58} borderColor="#ffffff" borderOpacity={0.35} z={-0.006} />
      </>
    )
  }

  const visibleRows = selectedMenu ? [selectedMenu] : HUD_MENU_ITEMS

  if (!overlayEnabled) {
    return (
      <group position={position} scale={scale}>
        <group position={[0, 0.2, 0]}>
          <RoundedRect
            width={0.3}
            height={0.05}
            radius={0.012}
            color={surfaceTint}
            opacity={hudTheme.surfaceOpacity}
            borderColor={hudTheme.border}
            borderOpacity={0.45}
            z={-0.003}
          />
        </group>
        <Text
          position={[-0.122, 0.2, 0.004]}
          anchorX="left"
          anchorY="middle"
          fontSize={0.022}
          color="#ffffff"
        >
          Overlay
        </Text>
        <group position={[0.08, 0.2, 0.002]}>
          <RoundedRect width={0.165} height={0.036} radius={0.016} color={hudTheme.toggleOff} opacity={0.95} z={0} />
          <group position={[-0.042, 0, 0.001]} onClick={onToggleOverlay}>
            <RoundedRect width={0.08} height={0.03} radius={0.015} color={hudTheme.toggleOff} opacity={0.95} />
          </group>
          <Text position={[-0.042, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.016} color="#ffffff">On</Text>
          <group position={[0.042, 0, 0.001]}>
            <RoundedRect width={0.08} height={0.03} radius={0.015} color={hudTheme.toggleOn} opacity={0.95} />
          </group>
          <Text position={[0.042, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.016} color={hudTheme.toggleTextOn}>Off</Text>
        </group>
      </group>
    )
  }

  return (
    <group position={position} scale={scale}>
      <group position={[0, 0.2, 0]}>
        <RoundedRect
          width={0.3}
          height={0.05}
          radius={0.012}
          color={surfaceTint}
          opacity={hudTheme.surfaceOpacity}
          borderColor={hudTheme.border}
          borderOpacity={0.45}
          z={-0.003}
        />
      </group>
      <Text
        position={[-0.122, 0.2, 0.004]}
        anchorX="left"
        anchorY="middle"
        fontSize={0.022}
        color="#ffffff"
      >
        Overlay
      </Text>

      <group position={[0.08, 0.2, 0.002]}>
        <RoundedRect width={0.165} height={0.036} radius={0.016} color={hudTheme.toggleOff} opacity={0.95} z={0} />
        <group position={[-0.042, 0, 0.001]} onClick={() => (overlayEnabled ? null : onToggleOverlay())} onPointerDown={() => (overlayEnabled ? null : onToggleOverlay())}>
          <RoundedRect width={0.08} height={0.03} radius={0.015} color={overlayEnabled ? hudTheme.toggleOn : hudTheme.toggleOff} opacity={0.95} />
        </group>
        <Text position={[-0.042, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.016} color={overlayEnabled ? hudTheme.toggleTextOn : '#ffffff'}>On</Text>
        <group position={[0.042, 0, 0.001]} onClick={() => (overlayEnabled ? onToggleOverlay() : null)} onPointerDown={() => (overlayEnabled ? onToggleOverlay() : null)}>
          <RoundedRect width={0.08} height={0.03} radius={0.015} color={overlayEnabled ? hudTheme.toggleOff : hudTheme.toggleOn} opacity={0.95} />
        </group>
        <Text position={[0.042, 0, 0.002]} anchorX="center" anchorY="middle" fontSize={0.016} color={!overlayEnabled ? hudTheme.toggleTextOn : '#ffffff'}>Off</Text>
      </group>

      {overlayEnabled && (
        <group onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
          {visibleRows.map((item, index) => {
            const y = 0.128 - index * 0.066
            const selected = item.id === selectedMenuId
            return (
              <group key={item.id} position={[0, y, 0.002]}>
                <group
                  position={[0, 0, 0]}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleItem(item.id)
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onToggleItem(item.id)
                  }}
                >
                  <RoundedRect
                    width={0.3}
                    height={0.058}
                    radius={0.02}
                    color={selected ? '#accbff' : surfaceTint}
                    opacity={selected ? 0.95 : hudTheme.surfaceOpacity}
                    borderColor={selected && selectedMenu ? undefined : selected ? hudTheme.borderActive : hudTheme.border}
                    borderOpacity={selected && selectedMenu ? 0 : 0.9}
                    z={0}
                  />
                </group>
                <HudMenuIcon texture={iconMap[item.id]} />
                <Text
                  position={[-0.095, 0.009, 0.003]}
                  anchorX="left"
                  anchorY="middle"
                  fontSize={0.018}
                  color="#ffffff"
                >
                  {item.label}
                </Text>
                <Text
                  position={[-0.095, -0.011, 0.003]}
                  anchorX="left"
                  anchorY="middle"
                  fontSize={0.014}
                  color="#ffffff"
                >
                  {item.subtitle}
                </Text>
                {item.status && (
                  <Text position={[0.128, -0.011, 0.003]} anchorX="right" anchorY="middle" fontSize={0.014} color={item.status.color}>
                    {item.status.text}
                  </Text>
                )}
              </group>
            )
          })}

          {selectedMenu && (
            <group position={[0, selectedMenu.detail === 'patient' ? -0.078 : -0.055, 0.002]}>
              {renderDetail()}
              {selectedMenu.detail !== 'patient' && (
                <Text position={[0, -0.102, 0.003]} anchorX="center" anchorY="middle" fontSize={0.014} color={hudTheme.textMuted}>
                  {detailHint}
                </Text>
              )}
            </group>
          )}
        </group>
      )}
    </group>
  )
}
