import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Color } from 'three'
import { hudTheme } from './hudTheme'

const pill = (w, h, x, y, z, color, opacity = 0.95) => (
  <mesh position={[x, y, z]}>
    <planeGeometry args={[w, h]} />
    <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
  </mesh>
)

/** Header area: stacked bars (replaces “Menu.png” reference). */
export function IconMenuMark({ color = hudTheme.iconStroke }) {
  const c = new Color(color)
  return (
    <group>
      {pill(0.032, 0.0055, 0, 0.01, 0, c)}
      {pill(0.032, 0.0055, 0, 0, 0, c)}
      {pill(0.032, 0.0055, 0, -0.01, 0, c)}
    </group>
  )
}

function IconPatient({ color = hudTheme.iconStroke }) {
  const c = new Color(color)
  return (
    <group>
      <mesh position={[0, 0.012, 0]}>
        <circleGeometry args={[0.009, 24]} />
        <meshBasicMaterial color={c} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      {pill(0.022, 0.016, 0, -0.008, 0, c, 0.92)}
    </group>
  )
}

/** BP + oxygen feel: droplet + small pulse tick (no PNG). */
function IconBloodPressure({ color = hudTheme.iconStroke }) {
  const c = new Color(color)
  const heartPoints = useMemo(
    () =>
      [
        [0, 0.012, 0.001],
        [0.006, 0.004, 0.001],
        [0.014, 0.002, 0.001],
        [0.01, -0.008, 0.001],
        [0, -0.016, 0.001],
        [-0.01, -0.008, 0.001],
        [-0.014, 0.002, 0.001],
        [-0.006, 0.004, 0.001],
        [0, 0.012, 0.001],
      ].map((p) => p),
    []
  )
  return (
    <group>
      <Line points={heartPoints} color={c} lineWidth={2} transparent opacity={0.95} />
      {pill(0.02, 0.003, 0.014, -0.012, 0.002, c, 0.85)}
    </group>
  )
}

function IconHeartRate({ color = hudTheme.iconStroke }) {
  const c = new Color(color)
  const pts = useMemo(
    () =>
      [
        [-0.02, 0, 0.001],
        [-0.012, 0, 0.001],
        [-0.008, 0.01, 0.001],
        [-0.004, -0.01, 0.001],
        [0, 0.012, 0.001],
        [0.004, -0.01, 0.001],
        [0.008, 0.01, 0.001],
        [0.012, 0, 0.001],
        [0.02, 0, 0.001],
      ].map((p) => p),
    []
  )
  return <Line points={pts} color={c} lineWidth={2} transparent opacity={0.95} />
}

function IconTestResults({ color = hudTheme.iconStroke }) {
  const c = new Color(color)
  return (
    <group>
      <Line
        points={[
          [-0.014, 0.014, 0.001],
          [0.014, 0.014, 0.001],
          [0.014, -0.014, 0.001],
          [-0.014, -0.014, 0.001],
          [-0.014, 0.014, 0.001],
        ]}
        color={c}
        lineWidth={2}
        transparent
        opacity={0.95}
      />
      {pill(0.02, 0.003, 0, 0.006, 0.002, c, 0.9)}
      {pill(0.02, 0.003, 0, 0, 0.002, c, 0.75)}
      {pill(0.014, 0.003, 0, -0.006, 0.002, c, 0.65)}
    </group>
  )
}

function IconAllergies({ color = hudTheme.iconMuted }) {
  const c = new Color(color)
  const tri = useMemo(
    () => [
      [0, 0.014, 0.001],
      [-0.014, -0.012, 0.001],
      [0.014, -0.012, 0.001],
      [0, 0.014, 0.001],
    ],
    []
  )
  return (
    <group>
      <Line points={tri} color={c} lineWidth={2} transparent opacity={0.95} />
      {pill(0.004, 0.012, 0, -0.002, 0.002, c, 0.95)}
      {pill(0.004, 0.004, 0, -0.012, 0.002, c, 0.95)}
    </group>
  )
}

const iconById = {
  patient: IconPatient,
  blood: IconBloodPressure,
  heart: IconHeartRate,
  tests: IconTestResults,
  allergies: IconAllergies,
}

/** Row icon, centered in a ~0.042 plane (matches prior UV tile size). */
export function HudMenuRowIcon({ menuId }) {
  const Cmp = iconById[menuId] || IconPatient
  return (
    <group scale={1.15}>
      <Cmp />
    </group>
  )
}
