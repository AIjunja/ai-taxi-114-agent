// 장소 정리 결과 채점. 가장 위험한 오류는 '틀린 장소를 자신 있게 채운 것'이다.
import type { Slot } from './extract'

export type Verdict = 'correct' | 'wrong_confident' | 'missed'

export function judge(slot: Slot, expected: string): Verdict {
  if (expected === 'missing') return slot.status === 'missing' ? 'correct' : 'wrong_confident'
  if (expected === 'ambiguous') {
    if (slot.status === 'ambiguous') return 'correct'
    return slot.status === 'found' ? 'wrong_confident' : 'missed'
  }
  if (slot.status === 'found') return slot.places[0].id === expected ? 'correct' : 'wrong_confident'
  if (slot.status === 'ambiguous' && slot.places.some((p) => p.id === expected)) return 'missed'
  return slot.status === 'missing' ? 'missed' : 'wrong_confident'
}

export function slotLabel(slot: Slot): string {
  if (slot.status === 'missing') return '모름'
  if (slot.status === 'ambiguous') return `후보 ${slot.places.map((p) => p.name).join('·')}`
  return slot.places[0].name
}
