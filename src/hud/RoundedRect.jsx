import { useMemo } from 'react'
import { Shape } from 'three'
import { Line } from '@react-three/drei'

function buildRoundedShape(width, height, radius) {
  const w = width / 2
  const h = height / 2
  const r = Math.max(0.0001, Math.min(radius, w, h))
  const s = new Shape()
  s.moveTo(-w + r, h)
  s.lineTo(w - r, h)
  s.quadraticCurveTo(w, h, w, h - r)
  s.lineTo(w, -h + r)
  s.quadraticCurveTo(w, -h, w - r, -h)
  s.lineTo(-w + r, -h)
  s.quadraticCurveTo(-w, -h, -w, -h + r)
  s.lineTo(-w, h - r)
  s.quadraticCurveTo(-w, h, -w + r, h)
  return s
}

export default function RoundedRect({
  width,
  height,
  radius,
  color,
  opacity = 1,
  borderColor,
  borderOpacity = 1,
  borderWidth = 2,
  z = 0,
}) {
  const shape = useMemo(() => buildRoundedShape(width, height, radius), [width, height, radius])
  const borderPoints = useMemo(
    () => shape.getPoints(40).map((p) => [p.x, p.y, z + 0.001]),
    [shape, z]
  )

  return (
    <group position={[0, 0, z]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {borderColor ? (
        <Line
          points={borderPoints}
          color={borderColor}
          lineWidth={borderWidth}
          transparent
          opacity={borderOpacity}
        />
      ) : null}
    </group>
  )
}
