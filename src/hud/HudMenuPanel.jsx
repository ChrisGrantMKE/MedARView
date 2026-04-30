import { useMemo } from 'react'
import { Text, useTexture } from '@react-three/drei'
import { Color } from 'three'

import { DRILL_HEADER_W, HUD_MENU_ITEMS } from './menuData'
import RoundedRect from './RoundedRect'
import { hudTheme } from './hudTheme'

const ROW_W = 0.3
const ROW_H = 0.054
const ROW_RADIUS = 0.012
const ROW_GAP = 0.012
const ICON_SLOT_X = -0.118
const ICON_PLANE = 0.034

const OVERLAY_CENTER_Y = 0.205
const OVERLAY_H = 0.037
const OVERLAY_TO_FIRST_ROW_GAP = 0.016

const overlayBarW = 0.3
const overlayBarH = OVERLAY_H
/** Capsule-like bar; stay inside half-height so shape stays smooth */
const overlayRadius = Math.min(0.014, overlayBarH / 2 - 0.002)
const TOGGLE_SEG_W = 0.04
const TOGGLE_SEG_H = Math.min(0.022, overlayBarH - 0.01)
const TOGGLE_GAP = 0.005
const TOGGLE_CORNER = Math.min(0.008, TOGGLE_SEG_H / 2 - 0.001)

/** Padding around menu stack (~24px at reference scale; local menu units). */
const MENU_BACKDROP_PAD = 0.024

function OverlayToggleBar({ overlayEnabled, onSetOverlay }) {
  const track = new Color('#1a2838')
  const activeFill = new Color(hudTheme.toggleOn)
  const inactiveFill = new Color('#2a3544')
  const segTextActive = '#0f1d2d'
  const segTextMuted = '#d0e4f8'

  const halfBar = overlayBarW / 2
  /** Extra margin keeps the On/Off cluster off the bar’s right edge (avoids clipped / “thumb” overflow). */
  const rightInset = 0.028
  const clusterW = TOGGLE_SEG_W * 2 + TOGGLE_GAP
  const clusterCenterX = halfBar - rightInset - clusterW / 2
  const onCenterX = clusterCenterX - TOGGLE_SEG_W / 2 - TOGGLE_GAP / 2
  const offCenterX = clusterCenterX + TOGGLE_SEG_W / 2 + TOGGLE_GAP / 2

  const pick = (e, v) => {
    e.stopPropagation()
    onSetOverlay(v)
  }

  return (
    <group position={[0, OVERLAY_CENTER_Y, 0.002]}>
      <RoundedRect
        width={overlayBarW}
        height={overlayBarH}
        radius={overlayRadius}
        color={track}
        opacity={0.46}
        borderColor={hudTheme.border}
        borderOpacity={0.175}
        borderWidth={1}
      />
      <Text position={[-halfBar + 0.036, 0, 0.003]} anchorX="left" anchorY="middle" fontSize={0.014} color="#f5f9ff">
        Overlay
      </Text>

      <group position={[onCenterX, 0, 0.002]}>
        <RoundedRect
          width={TOGGLE_SEG_W}
          height={TOGGLE_SEG_H}
          radius={TOGGLE_CORNER}
          color={overlayEnabled ? activeFill : inactiveFill}
          opacity={overlayEnabled ? 0.5 : 0.45}
          borderColor={overlayEnabled ? '#8eb4e8' : '#4a5f78'}
          borderOpacity={overlayEnabled ? 0.25 : 0.14}
          borderWidth={1}
          z={0}
        />
        <Text position={[0, 0, 0.0015]} anchorX="center" anchorY="middle" fontSize={0.011} color={overlayEnabled ? segTextActive : segTextMuted}>
          On
        </Text>
        <mesh position={[0, 0, 0.004]} onPointerDown={(e) => pick(e, true)}>
          <planeGeometry args={[TOGGLE_SEG_W, TOGGLE_SEG_H]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      <group position={[offCenterX, 0, 0.002]}>
        <RoundedRect
          width={TOGGLE_SEG_W}
          height={TOGGLE_SEG_H}
          radius={TOGGLE_CORNER}
          color={!overlayEnabled ? activeFill : inactiveFill}
          opacity={!overlayEnabled ? 0.5 : 0.45}
          borderColor={!overlayEnabled ? '#8eb4e8' : '#4a5f78'}
          borderOpacity={!overlayEnabled ? 0.25 : 0.14}
          borderWidth={1}
          z={0}
        />
        <Text position={[0, 0, 0.0015]} anchorX="center" anchorY="middle" fontSize={0.011} color={!overlayEnabled ? segTextActive : segTextMuted}>
          Off
        </Text>
        <mesh position={[0, 0, 0.004]} onPointerDown={(e) => pick(e, false)}>
          <planeGeometry args={[TOGGLE_SEG_W, TOGGLE_SEG_H]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Full-width selected row + page SVGs (design “submenu” art). */
function HudMenuDrillView({ item, firstRowY, rowW, onHeaderClick }) {
  const [headerMap, pageMap] = useTexture([item.drillSelectedSrc, item.drillPageSrc])
  const headerH = rowW * (item.drillHeaderH / DRILL_HEADER_W)
  const pageH = rowW * (item.drillPageH / DRILL_HEADER_W)
  const gap = 0.012
  const headerCenterY = firstRowY
  const pageCenterY = headerCenterY - headerH / 2 - gap - pageH / 2
  const hintY = pageCenterY - pageH / 2 - 0.022

  return (
    <>
      <group
        position={[0, headerCenterY, 0.004]}
        onClick={(e) => {
          e.stopPropagation()
          onHeaderClick()
        }}
      >
        <mesh>
          <planeGeometry args={[rowW, headerH]} />
          <meshBasicMaterial map={headerMap} transparent depthWrite depthTest toneMapped={false} />
        </mesh>
      </group>
      <group position={[0, pageCenterY, 0.003]}>
        <mesh>
          <planeGeometry args={[rowW, pageH]} />
          <meshBasicMaterial map={pageMap} transparent depthWrite depthTest toneMapped={false} />
        </mesh>
      </group>
      <Text position={[0, hintY, 0.004]} anchorX="center" anchorY="middle" fontSize={0.011} color="#7eb0d4">
        Tap the header bar to return to the menu
      </Text>
    </>
  )
}

/** List: procedural row chrome; icons from `assets/SVGS` only. */
function HudMenuListView({ firstRowY, listHintY, onToggleItem }) {
  const iconUrls = useMemo(() => HUD_MENU_ITEMS.map((i) => i.iconSrc), [])
  const iconTextures = useTexture(iconUrls)

  const rowFill = useMemo(() => new Color('#152a42'), [])
  const border = '#7a8fa8'

  return (
    <>
      {HUD_MENU_ITEMS.map((item, index) => {
        const y = firstRowY - index * (ROW_H + ROW_GAP)
        const tex = iconTextures[index]

        return (
          <group
            key={item.id}
            position={[0, y, 0]}
            onClick={(e) => {
              e.stopPropagation()
              onToggleItem(item.id)
            }}
          >
            <RoundedRect
              width={ROW_W}
              height={ROW_H}
              radius={ROW_RADIUS}
              color={rowFill}
              opacity={0.48}
              borderColor={border}
              borderOpacity={0.325}
              borderWidth={1}
              z={0}
            />
            <mesh position={[ICON_SLOT_X, 0, 0.004]}>
              <planeGeometry args={[ICON_PLANE, ICON_PLANE]} />
              <meshBasicMaterial map={tex} transparent depthWrite depthTest toneMapped={false} />
            </mesh>
            <Text position={[-0.092, 0.007, 0.005]} anchorX="left" anchorY="middle" fontSize={0.015} color="#ffffff" maxWidth={0.2}>
              {item.label}
            </Text>
            <Text position={[-0.092, -0.01, 0.005]} anchorX="left" anchorY="middle" fontSize={0.011} color="#d8e6f5" maxWidth={0.2}>
              {item.subtitle}
            </Text>
          </group>
        )
      })}
      <Text position={[0, listHintY, 0.002]} anchorX="center" anchorY="middle" fontSize={0.011} color="#7eb0d4">
        Tap a row to open
      </Text>
    </>
  )
}

export default function HudMenuPanel({
  position = [-0.28, 0.12, 0],
  scale = 1,
  overlayEnabled,
  onSetOverlay,
  selectedMenuId,
  onToggleItem,
}) {
  const { firstRowY, listHintY } = useMemo(() => {
    const overlayBottom = OVERLAY_CENTER_Y - OVERLAY_H / 2
    const firstY = overlayBottom - OVERLAY_TO_FIRST_ROW_GAP - ROW_H / 2
    const n = HUD_MENU_ITEMS.length
    const lastIdx = n - 1
    const lastCenterY = firstY - lastIdx * (ROW_H + ROW_GAP)
    const lastBottom = lastCenterY - ROW_H / 2
    const hint = lastBottom - 0.024
    return { firstRowY: firstY, listHintY: hint }
  }, [])

  const drillItem = useMemo(
    () => HUD_MENU_ITEMS.find((m) => m.id === selectedMenuId),
    [selectedMenuId]
  )

  const backdropLayout = useMemo(() => {
    const top = OVERLAY_CENTER_Y + OVERLAY_H / 2
    let bottom
    if (!overlayEnabled) {
      bottom = OVERLAY_CENTER_Y - OVERLAY_H / 2
    } else if (drillItem) {
      const headerH = ROW_W * (drillItem.drillHeaderH / DRILL_HEADER_W)
      const pageH = ROW_W * (drillItem.drillPageH / DRILL_HEADER_W)
      const gap = 0.012
      const headerCenterY = firstRowY
      const pageCenterY = headerCenterY - headerH / 2 - gap - pageH / 2
      const hintY = pageCenterY - pageH / 2 - 0.022
      bottom = hintY - 0.018
    } else {
      bottom = listHintY - 0.022
    }
    const innerH = top - bottom
    const h = innerH + 2 * MENU_BACKDROP_PAD
    const centerY = (top + bottom) / 2
    const w = overlayBarW + 2 * MENU_BACKDROP_PAD
    const radius = Math.min(0.016, MENU_BACKDROP_PAD + ROW_RADIUS * 0.5)
    return { centerY, h, w, radius }
  }, [overlayEnabled, drillItem, firstRowY, listHintY])

  return (
    <group position={position} scale={scale}>
      <group position={[0, backdropLayout.centerY, -0.008]}>
        <RoundedRect
          width={backdropLayout.w}
          height={backdropLayout.h}
          radius={backdropLayout.radius}
          color="#030910"
          opacity={0.62}
          borderColor="#4a6a8c"
          borderOpacity={0.22}
          borderWidth={1}
          z={0}
        />
      </group>
      <OverlayToggleBar overlayEnabled={overlayEnabled} onSetOverlay={onSetOverlay} />

      {overlayEnabled && drillItem ? (
        <HudMenuDrillView
          item={drillItem}
          firstRowY={firstRowY}
          rowW={ROW_W}
          onHeaderClick={() => onToggleItem(drillItem.id)}
        />
      ) : null}

      {overlayEnabled && !drillItem ? (
        <HudMenuListView firstRowY={firstRowY} listHintY={listHintY} onToggleItem={onToggleItem} />
      ) : null}
    </group>
  )
}
