import { useEffect, useLayoutEffect, useMemo } from 'react'
import { ShaderMaterial } from 'three'

/** Renders SVG-based textures as solid white using luminance/alpha as mask (fixes tinted SVG fills on colored rows). */
export function useWhiteIconMaterial(map) {
  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          float m = max(t.r, max(t.g, t.b));
          float a = t.a * max(m, 0.001);
          if (a < 0.02) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
  }, [])

  useLayoutEffect(() => {
    if (map) {
      material.uniforms.map.value = map
    }
  }, [map, material])

  return material
}

/** Menu row icon plane; SVG pixels → solid white. */
export function HudMenuIcon({ texture }) {
  const material = useWhiteIconMaterial(texture)
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={[-0.122, 0, 0.003]} material={material}>
      <planeGeometry args={[0.03, 0.03]} />
    </mesh>
  )
}
