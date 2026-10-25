// 실제 지도 (OpenStreetMap 타일 + Leaflet). 장소 좌표는 공개 장소의 근사값이다.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Place } from '../features/dialog/places'
import type { MapPoint } from './MiniMap'

interface Props {
  origin?: Place | null
  destination?: Place | null
  pending?: Place | null
  driver?: MapPoint | null
  height?: number
}

function pin(label: string, color: string, dashed = false) {
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    html: `<div style="position:relative;width:30px;height:38px">
      <svg viewBox="0 0 30 38" width="30" height="38"><path d="M15 37C6 25 2 20 2 14a13 13 0 1 1 26 0c0 6-4 11-13 23z" fill="${dashed ? '#fff' : color}" stroke="${color}" stroke-width="2.5" ${dashed ? 'stroke-dasharray="4 3"' : ''}/></svg>
      <span style="position:absolute;top:6px;left:0;width:30px;text-align:center;font:700 12px GmarketSans,sans-serif;color:${dashed ? color : '#fff'}">${label}</span></div>`,
  })
}

const TAXI = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: '<div style="width:26px;height:26px;border-radius:50%;background:#f5c400;border:2px solid #17191c;display:flex;align-items:center;justify-content:center;font:800 12px sans-serif;color:#17191c">T</div>',
})

export function RealMap({ origin, destination, pending, driver, height = 230 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([37.5547, 126.9707], 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const pts: L.LatLngExpression[] = []
    if (pending) {
      L.marker([pending.lat, pending.lng], { icon: pin('?', '#8a5a00', true) }).addTo(g)
      pts.push([pending.lat, pending.lng])
    }
    if (origin) {
      L.marker([origin.lat, origin.lng], { icon: pin('출', '#0d6b4f') }).addTo(g).bindTooltip(origin.name, { permanent: true, direction: 'right', offset: [10, -18] })
      pts.push([origin.lat, origin.lng])
    }
    if (destination) {
      L.marker([destination.lat, destination.lng], { icon: pin('도', '#b42318') }).addTo(g).bindTooltip(destination.name, { permanent: true, direction: 'right', offset: [10, -18] })
      pts.push([destination.lat, destination.lng])
    }
    if (origin && destination) L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], { color: '#17191c', weight: 3, opacity: 0.6, dashArray: '8 6' }).addTo(g)
    if (driver) {
      L.marker([driver.lat, driver.lng], { icon: TAXI }).addTo(g)
      pts.push([driver.lat, driver.lng])
    }
    if (pts.length === 1) m.flyTo(pts[0], 15, { duration: 0.6 })
    else if (pts.length > 1) m.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], duration: 0.6, maxZoom: 15 })
    box.current?.setAttribute('data-points', String(pts.length))
  }, [origin, destination, pending, driver])

  return (
    <div className="relative overflow-hidden rounded-lg border border-line" style={{ height }}>
      <div ref={box} className="h-full w-full" data-testid="real-map" />
      <span className="pointer-events-none absolute bottom-1 left-1 z-[500] rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-muted">실제 지도 · 장소 좌표는 근사값</span>
    </div>
  )
}
