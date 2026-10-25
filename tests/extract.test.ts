import { describe, expect, it } from 'vitest'
import { extract, findMentions } from '../src/features/assist/extract'
import { judge } from '../src/features/assist/score'

const ids = (r: ReturnType<typeof extract>) => ({ o: r.origin.places.map((p) => p.id), d: r.destination.places.map((p) => p.id) })

describe('발화 정리', () => {
  it('조사로 출발지·목적지를 나눈다', () => {
    expect(ids(extract(['서울역에서 서울아산병원까지 가요']))).toEqual({ o: ['seoul-station'], d: ['asan'] })
  })
  it('여러 마디에 나눠 말해도 정리한다', () => {
    expect(ids(extract(['여보세요', '서울역이요', '아산병원이요']))).toEqual({ o: ['seoul-station'], d: ['asan'] })
  })
  it('이름이 겹치면 후보로 남기고, 구별 단어가 있으면 좁힌다', () => {
    expect(extract(['서울역에서 세브란스 가요']).destination.status).toBe('ambiguous')
    expect(ids(extract(['서울역에서 세브란스 신촌 쪽이요'])).d).toEqual(['severance'])
  })
  it("'말고'로 부정한 장소는 빼고, 바꾼 목적지를 쓴다", () => {
    const r = extract(['서울역에서 강남역 가요', '아 강남역 말고 김포공항으로 가 주세요'])
    expect(ids(r).d).toEqual(['gimpo-airport'])
    expect(r.destination.changed).toBe(true)
    expect(r.notes.join(' ')).toContain('바꿨어요')
  })
  it('모르는 장소는 비워 둔다', () => {
    expect(extract(['우리 동네 농협 앞에서 탈 건데']).origin.status).toBe('missing')
  })
  it('근거(몇 번째 말, 이유)를 남긴다', () => {
    const r = extract(['용산역 앞이에요', '거기서 삼성병원 가요'])
    expect(r.origin).toMatchObject({ utterance: 0 })
    expect(r.origin.reason).toContain('앞이')
  })
  it('한 문장의 여러 장소를 모두 찾는다', () => {
    expect(findMentions('고속터미널에서 타서 강남세브란스 가요').map((m) => m.key)).toEqual(['고속터미널', '강남세브란스'])
  })
})

describe('채점', () => {
  it('틀린 장소를 자신 있게 채우면 wrong_confident', () => {
    const r = extract(['서울역에서 동대문시장 가요'])
    expect(judge(r.destination, 'missing')).toBe('wrong_confident')
  })
  it('모른다고 비워 두면 missed, 후보를 보여주면 정답 처리', () => {
    expect(judge({ status: 'missing', places: [] }, 'asan')).toBe('missed')
    expect(judge(extract(['서울역에서 공항 가요']).destination, 'ambiguous')).toBe('correct')
  })
})
