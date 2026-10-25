// 자동 시연 대본. 두 시나리오를 같은 통화 화면으로 보여준다.
//  - full: AI 상담원 혼자 처리 (대사는 실제 대화 엔진 출력)
//  - assist: 사람 상담원 + AI 보조 (AI 정리는 실제 추출기 출력)
// 음성 클립 파일 이름은 '화자|문장'의 해시라서, 생성 스크립트와 화면이 같은 규칙으로 찾는다.
import { createInitialState, reduce, type DispatchResult } from '../dialog/machine'
import { extract } from '../assist/extract'
import { speakPlate } from '../dialog/speech-format'

export type Speaker = 'agent' | 'counselor' | 'customer'

export type Step =
  | { type: 'say'; speaker: Speaker; text: string }
  | { type: 'note'; text: string }
  | { type: 'order'; patch: Partial<OrderState> }
  | { type: 'wait'; ms: number }
  | { type: 'dispatch'; originId: string; destinationId: string }
  | { type: 'result'; speaker: Speaker }

export interface OrderState {
  originId: string | null
  destinationId: string | null
  originNote?: string
  destinationNote?: string
  approval: 'locked' | 'pending' | 'done'
}

export function clipId(speaker: Speaker, text: string): string {
  let h = 0x811c9dc5
  for (const ch of `${speaker}|${text}`) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return `${speaker}-${(h >>> 0).toString(36)}`
}

const CUSTOMER_FULL = ['네, 잘 들려요.', '서울역 앞에서 탈게요.', '네, 맞아요.', '신촌 세브란스 병원이요.', '네.', '네, 불러주세요.']

/** 완전 자동: 대화 엔진을 실제로 돌려 AI 대사를 만든다. 배차 결과 대사는 실행 뒤에 붙인다. */
export function fullScript(): Step[] {
  const steps: Step[] = []
  let state = createInitialState()
  const run = (e: Parameters<typeof reduce>[1]) => {
    const o = reduce(state, e)
    state = o.state
    o.say.forEach((text) => steps.push({ type: 'say', speaker: 'agent', text }))
    return o
  }
  run({ type: 'start' })
  for (const line of CUSTOMER_FULL) {
    steps.push({ type: 'say', speaker: 'customer', text: line })
    const before = state.stage
    run({ type: 'utterance', text: line })
    if (state.origin && before === 'confirmOrigin') steps.push({ type: 'order', patch: { originId: state.origin.id } })
    if (state.destination && before === 'confirmDestination') steps.push({ type: 'order', patch: { destinationId: state.destination.id, approval: 'pending' } })
  }
  // 승인 → 호출
  steps.push({ type: 'order', patch: { approval: 'done' } })
  steps.push({ type: 'dispatch', originId: state.origin!.id, destinationId: state.destination!.id })
  steps.push({ type: 'result', speaker: 'agent' })
  steps.push({ type: 'say', speaker: 'customer', text: '고마워요.' })
  steps.push({ type: 'say', speaker: 'agent', text: '조심히 다녀오세요.' })
  return steps
}

/** 상담원 보조: 사람이 말하고, AI는 옆에서 장소를 정리한다. */
export function assistScript(): Step[] {
  const heard: string[] = []
  const steps: Step[] = []
  const customer = (text: string) => {
    steps.push({ type: 'say', speaker: 'customer', text })
    heard.push(text)
  }
  steps.push({ type: 'say', speaker: 'counselor', text: '네, 114 택시 대신 불러드리기입니다. 어디서 타세요?' })
  customer('여기 서울역이에요.')
  customer('세브란스 병원 가야 돼요.')
  const ex = extract(heard)
  const o = ex.origin.places[0]
  steps.push({ type: 'note', text: `AI 정리 · 출발지 ${o.name} · 목적지 후보 ${ex.destination.places.map((p) => p.name).join(', ')}` })
  steps.push({ type: 'order', patch: { originNote: `${o.name} 확인 대기`, destinationNote: `후보 ${ex.destination.places.length}곳` } })
  steps.push({ type: 'wait', ms: 900 })
  steps.push({ type: 'say', speaker: 'counselor', text: '신촌 세브란스요, 강남 세브란스요?' })
  customer('신촌이요.')
  steps.push({ type: 'note', text: '상담원 확인 · 출발지 서울역 · 목적지 신촌세브란스병원' })
  steps.push({ type: 'order', patch: { originId: 'seoul-station', destinationId: 'severance', originNote: undefined, destinationNote: undefined, approval: 'pending' } })
  steps.push({ type: 'say', speaker: 'counselor', text: '서울역에서 신촌세브란스병원으로 택시 불러드릴까요?' })
  customer('네, 불러 주세요.')
  steps.push({ type: 'order', patch: { approval: 'done' } })
  steps.push({ type: 'note', text: '상담원 승인 · Playwright가 호출 콘솔에 입력해요' })
  steps.push({ type: 'dispatch', originId: 'seoul-station', destinationId: 'severance' })
  steps.push({ type: 'say', speaker: 'counselor', text: '네, 지금 바로 불러드릴게요. 잠시만 기다려 주세요.' })
  steps.push({ type: 'result', speaker: 'counselor' })
  customer('고마워요.')
  return steps
}

export const COLORS = ['흰색', '검은색', '은색', '회색', '파란색']
export const MODELS = ['쏘나타', 'K5', '아이오닉 5', '그랜저', 'EV6', 'K8']
export const RESULT_FIXED = ['택시가 잡혔어요.', '차 번호는', '이에요.', '지금 근처에 빈 택시가 없어요.', '몇 분 뒤에 다시 불러드릴까요?']
export const DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
export const LETTERS = [...'가나다라마바사아자하']

/** 배차 결과를 말 조각으로 나눈다. 차 번호는 한 자씩 끊어 읽는다. */
export function resultPieces(r: DispatchResult): { text: string; gapMs: number }[] {
  if (r.status !== 'assigned') return [{ text: '지금 근처에 빈 택시가 없어요.', gapMs: 200 }, { text: '몇 분 뒤에 다시 불러드릴까요?', gapMs: 200 }]
  const spoken = speakPlate(r.plate) // "일이, 가, 삼사오육"
  const chars = spoken.replace(/[, ]/g, '').split('')
  return [
    { text: '택시가 잡혔어요.', gapMs: 250 },
    { text: `약 ${Math.min(9, Math.max(1, r.etaMinutes))}분 뒤에 도착해요.`, gapMs: 250 },
    { text: '차 번호는', gapMs: 150 },
    ...chars.map((c, i) => ({ text: c, gapMs: i === 1 || i === 2 ? 260 : 90 })),
    { text: '이에요.', gapMs: 250 },
    { text: `${r.color} ${r.model} 차량이에요.`, gapMs: 250 },
  ]
}

/** 미리 만들어야 하는 모든 대사 (음성 생성 스크립트가 쓴다) */
export function allLines(): { speaker: Speaker; text: string }[] {
  const lines = new Map<string, { speaker: Speaker; text: string }>()
  const add = (speaker: Speaker, text: string) => lines.set(clipId(speaker, text), { speaker, text })
  for (const s of [...fullScript(), ...assistScript()]) if (s.type === 'say') add(s.speaker, s.text)
  for (const sp of ['agent', 'counselor'] as const) {
    for (const t of RESULT_FIXED) add(sp, t)
    for (let n = 1; n <= 9; n++) add(sp, `약 ${n}분 뒤에 도착해요.`)
    for (const d of DIGITS) add(sp, d)
    for (const l of LETTERS) add(sp, l)
    for (const c of COLORS) for (const m of MODELS) add(sp, `${c} ${m} 차량이에요.`)
  }
  return [...lines.values()]
}
