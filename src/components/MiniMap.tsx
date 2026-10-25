// Mock 지도. 실제 지도 API가 아니라 근사 좌표를 평면에 그린다.
import type { Place } from '../features/dialog/places'

// 한강 개략선 (표시용)
const RIVER: [number, number][] = [
  [37.6, 126.7],
  [37.57, 126.8],
  [37.565, 126.86],
  [37.545, 126.9],
  [37.53, 126.94],
  [37.515, 126.99],
  [37.522, 127.04],
  [37.53, 127.08],
  [37.54, 127.11],
  [37.56, 127.16],
]

export interface MapPoint {
  lat: number
  lng: number
}

interface Props {
  origin?: Place | null
  destination?: Place | null
  driver?: MapPoint | null
  pending?: Place | null
  height?: number
  className?: string
}

export function MiniMap({ origin, destination, driver, pending, height = 220, className = '' }: Props) {
  const pts = [origin, destination, driver, pending].filter(Boolean) as MapPoint[]
  let minLat = 37.47, maxLat = 37.62, minLng = 126.86, maxLng = 127.12
  if (pts.length) {
    minLat = Math.min(...pts.map((p) => p.lat))
    maxLat = Math.max(...pts.map((p) => p.lat))
    minLng = Math.min(...pts.map((p) => p.lng))
    maxLng = Math.max(...pts.map((p) => p.lng))
    const padLat = Math.max(0.02, (maxLat - minLat) * 0.3)
    const padLng = Math.max(0.03, (maxLng - minLng) * 0.3)
    minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng
  }
  const W = 400
  const H = 220
  // 위도 보정으로 가로세로 비율을 맞춘다
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const spanX = (maxLng - minLng) * k
  const spanY = maxLat - minLat
  const scale = Math.min(W / spanX, H / spanY)
  const ox = (W - spanX * scale) / 2
  const oy = (H - spanY * scale) / 2
  const xy = (p: MapPoint) => [ox + (p.lng - minLng) * k * scale, oy + (maxLat - p.lat) * scale] as const

  const river = RIVER.map((p) => xy({ lat: p[0], lng: p[1] }).join(',')).join(' ')

  return (
    <div className={`relative overflow-hidden rounded-lg border border-line bg-[#eef1f3] ${className}`} style={{ height }} data-testid="mini-map">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label="호출 위치 지도 (Mock)">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(i * W) / 8} y1={0} x2={(i * W) / 8} y2={H} stroke="#dde2e6" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i * H) / 5} x2={W} y2={(i * H) / 5} stroke="#dde2e6" strokeWidth={1} />
        ))}
        <polyline points={river} fill="none" stroke="#c9dcea" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        {origin && destination && (
          <line x1={xy(origin)[0]} y1={xy(origin)[1]} x2={xy(destination)[0]} y2={xy(destination)[1]} stroke="#17191c" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 5" />
        )}
        {pending && <Pin p={xy(pending)} color="#8a5a00" label="?" dashed />}
        {origin && <Pin p={xy(origin)} color="#0d6b4f" label="출" />}
        {destination && <Pin p={xy(destination)} color="#b42318" label="도" />}
        {driver && (
          <g transform={`translate(${xy(driver)[0]},${xy(driver)[1]})`} data-testid="map-driver">
            <circle r={11} fill="#f5c400" stroke="#17191c" strokeWidth={1.5} />
            <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#17191c">
              T
            </text>
          </g>
        )}
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-muted">Mock 지도 · 근사 좌표</span>
    </div>
  )
}

function Pin({ p, color, label, dashed }: { p: readonly [number, number]; color: string; label: string; dashed?: boolean }) {
  return (
    <g transform={`translate(${p[0]},${p[1]})`}>
      <path d="M0 0 C -9 -12 -11 -16 -11 -21 A 11 11 0 1 1 11 -21 C 11 -16 9 -12 0 0 Z" fill={dashed ? '#fff' : color} stroke={color} strokeWidth={2} strokeDasharray={dashed ? '3 2' : undefined} />
      <text y={-17} textAnchor="middle" fontSize={11} fontWeight={700} fill={dashed ? color : '#fff'}>
        {label}
      </text>
    </g>
  )
}

/** 기사 위치: 출발지 근처에서 출발지 쪽으로 다가온다 (표시용 계산). */
export function driverPosition(origin: MapPoint, seed: string, fraction: number): MapPoint {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const angle = (h % 360) * (Math.PI / 180)
  const dist = 0.018 * (1 - Math.min(1, Math.max(0, fraction)))
  return { lat: origin.lat + Math.sin(angle) * dist, lng: origin.lng + Math.cos(angle) * dist * 1.25 }
}

export function distanceKm(a: MapPoint, b: MapPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
