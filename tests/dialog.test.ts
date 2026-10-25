import { describe, expect, it } from 'vitest'
import { createInitialState, reduce, type DialogEvent, type DialogState } from '../src/features/dialog/machine'
import { matchPlace } from '../src/features/dialog/places'
import { parseYesNo } from '../src/features/dialog/intents'
import { speakPlate } from '../src/features/dialog/speech-format'

function run(events: DialogEvent[]) {
  let state: DialogState = createInitialState()
  const said: string[] = []
  const effects: unknown[] = []
  for (const event of events) {
    const out = reduce(state, event)
    state = out.state
    said.push(...out.say)
    effects.push(...out.effects)
  }
  return { state, said, effects }
}

const happyPath: DialogEvent[] = [
  { type: 'start' },
  { type: 'utterance', text: '네 택시 좀 불러주세요' },
  { type: 'utterance', text: '서울역이요' },
  { type: 'utterance', text: '네' },
  { type: 'utterance', text: '세브란스병원으로 가요' },
  { type: 'utterance', text: '맞아요' },
]

describe('matchPlace', () => {
  it('조사와 공백이 붙어도 장소를 찾는다', () => {
    expect(matchPlace('서울역 앞에서 탈게요')?.id).toBe('seoul-station')
    expect(matchPlace('신촌 세브란스 병원이요')?.id).toBe('severance')
  })
  it('별칭으로도 찾는다', () => {
    expect(matchPlace('아산병원')?.id).toBe('asan')
  })
  it('없는 장소는 null', () => {
    expect(matchPlace('우리 집 앞')).toBeNull()
  })
})

describe('parseYesNo', () => {
  it.each([
    ['네', 'yes'],
    ['네네 맞아요', 'yes'],
    ['응', 'yes'],
    ['예 불러주세요', 'yes'],
    ['아니요', 'no'],
    ['아뇨 거기 아니에요', 'no'],
    ['글쎄요', 'unknown'],
  ])('%s → %s', (text, expected) => {
    expect(parseYesNo(text)).toBe(expected)
  })
})

describe('speakPlate', () => {
  it('차량 번호를 한 자씩 끊어 읽는다', () => {
    expect(speakPlate('12가 3456')).toBe('일이, 가, 삼사오육')
  })
})

describe('dialog machine', () => {
  it('첫인사는 해요체로 시작한다', () => {
    const { said, state } = run([{ type: 'start' }])
    expect(said[0]).toBe('네, 114예요. 택시 불러드릴까요?')
    expect(state.stage).toBe('askIntent')
  })

  it('출발지와 목적지를 각각 되읽어 확인한 뒤 최종 승인을 묻는다', () => {
    const { state, said, effects } = run(happyPath)
    expect(said.some((s) => s.includes('서울역') && s.includes('맞으세요'))).toBe(true)
    expect(said.some((s) => s.includes('세브란스병원') && s.includes('맞으세요'))).toBe(true)
    expect(state.stage).toBe('finalApproval')
    expect(state.approved).toBe(false)
    expect(effects).toHaveLength(0)
  })

  it('승인하면 배차 요청 효과를 정확히 한 번 낸다', () => {
    const { state, effects } = run([...happyPath, { type: 'utterance', text: '네 불러주세요' }])
    expect(state.stage).toBe('dispatching')
    expect(state.approved).toBe(true)
    expect(effects).toEqual([
      expect.objectContaining({ type: 'requestDispatch', attempt: 1, origin: expect.objectContaining({ id: 'seoul-station' }) }),
    ])
  })

  it('승인하지 않으면 배차를 요청하지 않는다', () => {
    const { state, effects, said } = run([...happyPath, { type: 'utterance', text: '아니요' }])
    expect(effects).toHaveLength(0)
    expect(state.approved).toBe(false)
    expect(state.stage).toBe('cancelled')
    expect(said.at(-1)).toContain('택시를 부르지 않았어요')
  })

  it('호출 중에 다시 승인해도 중복 요청하지 않는다', () => {
    const { effects, said } = run([
      ...happyPath,
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '빨리 불러줘요' },
    ])
    expect(effects).toHaveLength(1)
    expect(said.at(-1)).toContain('찾고 있어요')
  })

  it('출발지를 아니라고 하면 다시 묻는다', () => {
    const { state, said } = run([
      { type: 'start' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '서울역' },
      { type: 'utterance', text: '아니요' },
    ])
    expect(state.stage).toBe('askOrigin')
    expect(state.origin).toBeUndefined()
    expect(said.at(-1)).toContain('다시 알려주세요')
  })

  it('못 찾은 장소는 탓하지 않고 다른 단서를 묻는다', () => {
    const { state, said } = run([
      { type: 'start' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '우리 집 앞' },
    ])
    expect(state.stage).toBe('askOrigin')
    expect(said.at(-1)).toContain('찾지 못했어요')
  })

  it('출발지와 목적지가 같으면 목적지를 다시 묻는다', () => {
    const { state, said } = run([
      { type: 'start' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '서울역' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '서울역' },
    ])
    expect(state.stage).toBe('askDestination')
    expect(said.at(-1)).toContain('같아요')
  })

  it('배차 성공 결과를 한 줄씩 나눠 안내한다', () => {
    const { state, said } = run([
      ...happyPath,
      { type: 'utterance', text: '네' },
      {
        type: 'dispatchResult',
        result: { status: 'assigned', etaMinutes: 4, plate: '12가 3456', color: '흰색', model: '쏘나타', requestId: 'r1' },
      },
    ])
    expect(state.stage).toBe('dispatched')
    expect(said).toContain('택시가 잡혔어요.')
    expect(said).toContain('약 4분 뒤에 도착해요.')
    expect(said).toContain('차 번호는 일이, 가, 삼사오육이에요.')
  })

  it('빈 택시가 없으면 원인과 다음 행동을 말하고, 다시 부르면 새 시도로 요청한다', () => {
    const { effects, said, state } = run([
      ...happyPath,
      { type: 'utterance', text: '네' },
      { type: 'dispatchResult', result: { status: 'no_taxi', requestId: 'r1' } },
      { type: 'utterance', text: '네' },
    ])
    expect(said).toContain('지금 근처에 빈 택시가 없어요.')
    expect(effects).toHaveLength(2)
    expect(effects[1]).toEqual(expect.objectContaining({ attempt: 2 }))
    expect(state.stage).toBe('dispatching')
  })

  it('서버 오류도 원인과 다음 행동을 안내한다', () => {
    const { said, state } = run([
      ...happyPath,
      { type: 'utterance', text: '네' },
      { type: 'dispatchFailed', reason: 'network' },
    ])
    expect(state.stage).toBe('noTaxi')
    expect(said.join(' ')).toContain('연결하지 못했어요')
  })

  it('배차 전에는 언제든 취소할 수 있다', () => {
    const { state, effects } = run([
      { type: 'start' },
      { type: 'utterance', text: '네' },
      { type: 'utterance', text: '취소할게요' },
    ])
    expect(state.stage).toBe('cancelled')
    expect(effects).toHaveLength(0)
  })
})

import { withRo } from '../src/features/dialog/speech-format'
describe('withRo', () => {
  it('받침에 맞춰 조사를 붙인다', () => {
    expect(withRo('서울역')).toBe('서울역으로')
    expect(withRo('롯데월드타워')).toBe('롯데월드타워로')
    expect(withRo('서울')).toBe('서울로')
  })
})
