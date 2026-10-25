// 자동 시연 자료. 고객 발화는 미리 정한 합성 문장이고,
// AI 상담원 문장은 실제 대화 엔진이 만든다. 업무 화면은 Playwright 실제 실행 녹화를 쓴다.
import type { DispatchResult } from '../dialog/machine'

export const DEMO_SCRIPT = ['네, 잘 들려요.', '서울역 앞에서 탈게요.', '네, 맞아요.', '세브란스 병원이요.', '1번이요.', '네.', '네, 불러주세요.', '아니요, 됐어요.', '끝.']

export interface Recording {
  recordedAt: string
  environment: string
  video: string
  poster: string
  steps: { t: number; action: string; detail?: string }[]
  durationMs: number
  result: DispatchResult
}

let cache: Promise<Recording> | null = null

export function loadRecording(): Promise<Recording> {
  cache ??= fetch('/evidence/worker-run.json').then((r) => {
    if (!r.ok) throw new Error('녹화 기록을 불러오지 못했어요')
    return r.json()
  })
  return cache
}
