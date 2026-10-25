import { describe, expect, it } from 'vitest'
import { DEMO_STEPS } from '../src/features/demo/scenario'

describe('자동 시연 시나리오', () => {
  it('요구한 10단계를 순서대로 만든다', () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      'AI 상담원 첫인사',
      '출발지 음성 입력',
      '출발지 인식과 확인',
      '목적지 입력',
      '목적지 재확인',
      '호출 전 최종 승인',
      '업무 웹 자동 입력',
      'Mock 배차 성공',
      '차량 정보 음성 안내',
      '처리 결과',
    ])
  })
  it('최종 승인 단계까지는 승인되지 않았고, 업무 웹 단계에서 처음 승인된다', () => {
    expect(DEMO_STEPS.slice(0, 6).every((s) => !s.state.approved)).toBe(true)
    expect(DEMO_STEPS[6].state).toMatchObject({ approved: true, stage: 'dispatching' })
  })
  it('AI 문장은 실제 대화 로직에서 나온다', () => {
    expect(DEMO_STEPS[2].turns[0].text).toBe('서울역에서 타시는 거 맞으세요?')
    expect(DEMO_STEPS[4].turns[0].text).toBe('세브란스병원으로 가시는 거 맞으세요?')
    expect(DEMO_STEPS[8].turns.map((t) => t.text)).toContain('차 번호는 일이, 가, 삼사오육이에요.')
  })
})
