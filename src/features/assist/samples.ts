// 상담원 보조 화면에서 고를 수 있는 예시 통화. 실험 데이터(cases.ts)에서 골랐고, 실패 사례도 넣었다.
import { CASES } from './cases'
import { HOLDOUT } from './holdout'

export interface SampleCall {
  id: string
  title: string
  hint: string
  utterances: string[]
}

const pick = (id: string) => [...CASES, ...HOLDOUT].find((c) => c.id === id)!.utterances

export const SAMPLE_CALLS: SampleCall[] = [
  { id: 'c13', title: '나눠 말하는 통화', hint: 'AI가 정리 → 상담원은 확인만', utterances: pick('c13') },
  { id: 'c17', title: '이름이 겹치는 병원', hint: '세브란스 두 곳 중 상담원이 고름', utterances: pick('c17') },
  { id: 'c22', title: '중간에 목적지 변경', hint: '마지막에 말한 곳으로 정리', utterances: pick('c22') },
  { id: 'c28', title: '목록에 없는 곳', hint: 'AI가 모른다고 표시 → 상담원이 직접 검색', utterances: pick('c28') },
  { id: 'c30', title: 'AI가 틀리는 통화', hint: "'동대문시장'을 DDP로 잘못 정리 → 상담원 확인에서 걸러야 함", utterances: pick('c30') },
]
