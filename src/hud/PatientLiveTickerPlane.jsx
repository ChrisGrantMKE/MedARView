import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

/**
 * Horizontal marquee inside a fixed world-size plane: text enters from the right and exits left.
 * Used in simulated HUD patient caption strip (conversation panel).
 */
export default function PatientLiveTickerPlane({
  text,
  worldWidth,
  worldHeight,
  color = '#fff6de',
  /** Scroll speed in world units per second (mapped to pixel scroll). */
  speed = 0.06,
  active,
}) {
  const scrollRef = useRef(0)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 128
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    return tex
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  const displayText = (text && String(text).trim() ? String(text).trim() : '—') + '   ·   '

  useEffect(() => {
    scrollRef.current = 0
  }, [displayText])

  useFrame((_, delta) => {
    const canvas = texture.image
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!active) {
      ctx.fillStyle = 'rgba(100, 140, 170, 0.55)'
      ctx.font = '500 28px "Segoe UI", system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText('—', 16, h / 2)
      texture.needsUpdate = true
      return
    }

    ctx.fillStyle = color
    ctx.font = '500 30px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const metrics = ctx.measureText(displayText)
    const tw = Math.max(metrics.width, 8)
    const gap = 96
    const period = tw + gap

    scrollRef.current += speed * delta * 520

    let x = w - (scrollRef.current % period)
    while (x > -period) {
      ctx.fillText(displayText, x, h / 2)
      x -= period
    }

    texture.needsUpdate = true
  })

  return (
    <mesh position={[0, 0, 0.004]}>
      <planeGeometry args={[worldWidth, worldHeight]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}
