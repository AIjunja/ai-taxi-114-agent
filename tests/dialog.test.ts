import { describe, expect, it } from 'vitest'
import { createInitialState, reduce, type DialogEvent, type DialogState, type Effect } from '../src/features/dialog/machine'
import { matchPlace, pickCandidate, resolvePlaces } from '../src/features/dialog/places'
import { changeTarget, parseYesNo } from '../src/features/dialog/intents'
import { speakPlate, withRo } from '../src/features/dialog/speech-format'

const u = (text: string): DialogEvent => ({ type: 'utterance', text })

function run(events: DialogEvent[]) {
  let state: DialogState = createInitialState()
  const said: string[] = []
  const effects: Effect[] = []
  for (const event of events) {
    const out = reduce(state, event)
    state = out.state
    said.push(...out.say)
    effects.push(...out.effects)
  }
  return { state, said, effects, last: said.at(-1) ?? '' }
}

const dispatches = (e: Effect[]) => e.filter((x) => x.type === 'requestDispatch')

const toApproval: DialogEvent[] = [{ type: 'start' }, u('네 잘 들려요'), u('서울역이요'), u('네'), u('신촌 세브란스 병원으로 가요'), u('맞아요')]

const ASSIGNED = { status: 'assigned' as const, etaMinutes: 4, plate: '12가 3456', color: '흰색', model: '쏘나타', requestId: 'r1' }

describe('장소 인식', () => {
  it('조사와 공백이 붙어도 찾는다', () => {
    expect(matchPlace('서울역 앞에서 탈게요')?.id).toBe('seoul-station')
    expect(matchPlace('신촌 세브란스 병원이요')?.id).toBe('severance')
  })
  it('애매한 이름은 후보를 여러 개 돌려준다', () => {
    expect(resolvePlaces('세브란스병원').map((p) => p.id)).toEqual(['severance', 'gangnam-severance'])
    expect(resolvePlaces('공항 가 주세요').length).toBe(2)
    expect(matchPlace('세브란스')).toBeNull()
  })
  it('후보는 번호나 구별 단어로 고른다', () => {
    const c = resolvePlaces('세브란스')
    expect(pickCandidate('2번이요', c)?.id).toBe('gangnam-severance')
    expect(pickCandidate('첫 번째요', c)?.id).toBe('severance')
    expect(pickCandidate('강남이요', c)?.id).toBe('gangnam-severance')
    expect(pickCandidate('모르겠어요', c)).toBeNull()
  })
  it('없는 장소는 빈 목록', () => {
    expect(resolvePlaces('우리 집 앞')).toEqual([])
  })
})

describe('의도 판별', () => {
  it.each([
    ['네', 'yes'],
    ['네네 맞아요', 'yes'],
    ['잘 들려요', 'yes'],
    ['아니요', 'no'],
    ['아뇨 거기 아니에요', 'no'],
    ['글쎄요', 'unknown'],
  ])('%s → %s', (text, expected) => {
    expect(parseYesNo(text)).toBe(expected)
  })
  it('바꿀 대상을 알아듣는다', () => {
    expect(changeTarget('목적지 바꿀래요')).toBe('destination')
    expect(changeTarget('타는 곳이 잘못됐어요')).toBe('origin')
    expect(changeTarget('네')).toBeNull()
  })
})

describe('말하기 형식', () => {
  it('차량 번호를 한 자씩 끊어 읽는다', () => {
    expect(speakPlate('12가 3456')).toBe('일이, 가, 삼사오육')
  })
  it('받침에 맞춰 조사를 붙인다', () => {
    expect(withRo('서울역')).toBe('서울역으로')
    expect(withRo('롯데월드타워')).toBe('롯데월드타워로')
  })
})

describe('대화 흐름', () => {
  it('인사하고 소리가 잘 들리는지 먼저 확인한다', () => {
    const { said, state } = run([{ type: 'start' }])
    expect(said.join(' ')).toContain('잘 들리시면')
    expect(state.stage).toBe('soundCheck')
  })

  it('안 들린다고 하면 크고 천천히 말하도록 바꾼다', () => {
    const { effects, state, last } = run([{ type: 'start' }, u('잘 안 들려요')])
    expect(effects).toContainEqual({ type: 'voice', louder: true, slower: true })
    expect(state.stage).toBe('soundCheck')
    expect(last).toBe('이제 잘 들리세요?')
  })

  it('출발지와 목적지를 각각 되읽고, 최종 확인에서 둘 다 다시 말한다', () => {
    const { state, said, effects } = run(toApproval)
    expect(said).toContain('서울역에서 타시는 거 맞으세요?')
    expect(said).toContain('신촌세브란스병원으로 가시는 거 맞으세요?')
    expect(said).toContain('타시는 곳은 서울역.')
    expect(said).toContain('가시는 곳은 신촌세브란스병원.')
    expect(state.stage).toBe('finalApproval')
    expect(effects).toHaveLength(0)
  })

  it('애매한 장소는 후보를 읽어 주고 번호로 고르게 한다', () => {
    const { said, state } = run([{ type: 'start' }, u('네'), u('서울역'), u('네'), u('세브란스 병원이요')])
    expect(state.stage).toBe('chooseDestination')
    expect(said).toContain('1번, 신촌세브란스병원.')
    expect(said).toContain('2번, 강남세브란스병원.')
    const next = run([{ type: 'start' }, u('네'), u('서울역'), u('네'), u('세브란스 병원이요'), u('2번이요')])
    expect(next.last).toBe('강남세브란스병원으로 가시는 거 맞으세요?')
  })

  it('승인하면 배차 요청을 정확히 한 번 낸다', () => {
    const { state, effects } = run([...toApproval, u('네 불러주세요')])
    expect(state.stage).toBe('dispatching')
    expect(state.approved).toBe(true)
    expect(dispatches(effects)).toEqual([expect.objectContaining({ attempt: 1, origin: expect.objectContaining({ id: 'seoul-station' }) })])
  })

  it('최종 확인에서 아니라고 하면 호출하지 않고 무엇을 바꿀지 묻는다', () => {
    const { state, effects, said } = run([...toApproval, u('아니요')])
    expect(dispatches(effects)).toHaveLength(0)
    expect(state.approved).toBe(false)
    expect(state.stage).toBe('askChange')
    expect(said.join(' ')).toContain('어떤 걸 바꿀까요')
  })

  it('최종 확인에서 목적지를 새로 말하면 목적지만 바꾸고 다시 확인한다', () => {
    const { state, said, effects } = run([...toApproval, u('아니 강남역으로 가 주세요'), u('네')])
    expect(said).toContain('강남역으로 가시는 거 맞으세요?')
    expect(state.stage).toBe('finalApproval')
    expect(state.origin?.id).toBe('seoul-station')
    expect(state.destination?.id).toBe('gangnam-station')
    expect(dispatches(effects)).toHaveLength(0)
  })

  it('"목적지 바꿀래요"로 목적지를 다시 묻는다', () => {
    const { state } = run([...toApproval, u('목적지 바꿀래요')])
    expect(state.stage).toBe('askDestination')
  })

  it('출발지를 바꾸면 목적지는 유지하고 최종 확인으로 돌아온다', () => {
    const { state, said } = run([...toApproval, u('출발지 바꿔 주세요'), u('용산역'), u('네')])
    expect(said).toContain('타실 곳을 바꿨어요.')
    expect(state.stage).toBe('finalApproval')
    expect(state.origin?.id).toBe('yongsan-station')
    expect(state.destination?.id).toBe('severance')
  })

  it('호출 중에 같은 말을 반복해도 요청하지 않는다', () => {
    const { effects, last } = run([...toApproval, u('네'), u('네'), u('빨리 불러줘요')])
    expect(dispatches(effects)).toHaveLength(1)
    expect(last).toContain('찾고 있어요')
  })

  it('못 알아들으면 다시 묻고, 세 번 실패하면 상담원에게 넘긴다', () => {
    const one = run([{ type: 'start' }, u('네'), u('우리 집 앞')])
    expect(one.last).toContain('찾지 못했어요')
    const three = run([{ type: 'start' }, u('네'), u('우리 집'), u('저기 거기'), u('몰라요')])
    expect(three.state.stage).toBe('handoff')
    expect(three.effects).toContainEqual({ type: 'endCall' })
  })

  it('출발지와 목적지가 같으면 목적지를 다시 묻는다', () => {
    const { state, last } = run([{ type: 'start' }, u('네'), u('서울역'), u('네'), u('서울역')])
    expect(state.stage).toBe('askDestination')
    expect(last).toContain('같아요')
  })

  it('"다시 말해 주세요"는 직전 안내를 그대로 다시 말한다', () => {
    const { last, state } = run([{ type: 'start' }, u('네'), u('서울역'), u('뭐라고요?')])
    expect(last).toBe('서울역에서 타시는 거 맞으세요?')
    expect(state.stage).toBe('confirmOrigin')
  })

  it('"천천히 말해 주세요"는 속도를 낮추고 다시 말한다', () => {
    const { effects, said } = run([{ type: 'start' }, u('네'), u('천천히 말해 주세요')])
    expect(effects).toContainEqual({ type: 'voice', slower: true })
    expect(said.at(-1)).toContain('타실 곳을 알려주세요')
  })

  it('배차 결과를 한 줄씩 나눠 안내한다', () => {
    const { state, said } = run([...toApproval, u('네'), { type: 'dispatchResult', result: ASSIGNED }])
    expect(state.stage).toBe('dispatched')
    expect(said).toContain('택시가 잡혔어요.')
    expect(said).toContain('약 4분 뒤에 도착해요.')
    expect(said).toContain('차 번호는 일이, 가, 삼사오육이에요.')
  })

  it('배차 뒤에 취소하면 취소 요청을 내고 결과를 안내한다', () => {
    const { effects, state, said } = run([
      ...toApproval,
      u('네'),
      { type: 'dispatchResult', result: ASSIGNED },
      u('아니요'),
      u('취소해 주세요'),
      { type: 'cancelResult', ok: true },
    ])
    expect(effects).toContainEqual({ type: 'requestCancel', requestId: 'r1' })
    expect(state.stage).toBe('cancelled')
    expect(said).toContain('택시 호출을 취소했어요.')
  })

  it('빈 택시가 없으면 다시 부를 때 새 시도로 요청한다', () => {
    const { effects, state } = run([...toApproval, u('네'), { type: 'dispatchResult', result: { status: 'no_taxi', requestId: 'r1' } }, u('네')])
    expect(dispatches(effects).map((e) => (e as { attempt: number }).attempt)).toEqual([1, 2])
    expect(state.stage).toBe('dispatching')
  })

  it('호출 화면 연결 실패도 원인과 다음 행동을 안내한다', () => {
    const { said, state } = run([...toApproval, u('네'), { type: 'dispatchFailed', reason: 'network' }])
    expect(state.stage).toBe('noTaxi')
    expect(said.join(' ')).toContain('연결하지 못했어요')
  })

  it('배차 전에는 언제든 취소할 수 있다', () => {
    const { state, effects } = run([{ type: 'start' }, u('네'), u('취소할게요')])
    expect(state.stage).toBe('cancelled')
    expect(dispatches(effects)).toHaveLength(0)
  })
})
