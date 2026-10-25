// 데모용 장소 목록. 실제 지오코딩이 아니라 이름 일치로만 찾는다.
// 공개 장소 이름과 근사 좌표만 쓴다(지도 표시용, 정확한 주소 아님).
export interface Place {
  id: string
  name: string
  area: string
  lat: number
  lng: number
  /** 후보 중에서 고를 때 쓰는 구별 단어 (예: 신촌, 강남) */
  hints: string[]
}

export const PLACES: Place[] = [
  { id: 'seoul-station', name: '서울역', area: '서울 용산구', lat: 37.5547, lng: 126.9707, hints: [] },
  { id: 'yongsan-station', name: '용산역', area: '서울 용산구', lat: 37.5298, lng: 126.9648, hints: [] },
  { id: 'gangnam-station', name: '강남역', area: '서울 강남구', lat: 37.4979, lng: 127.0276, hints: [] },
  { id: 'city-hall', name: '시청역', area: '서울 중구', lat: 37.5657, lng: 126.9769, hints: [] },
  { id: 'jongno3', name: '종로3가역', area: '서울 종로구', lat: 37.5714, lng: 126.9917, hints: [] },
  { id: 'sinchon-station', name: '신촌역', area: '서울 서대문구', lat: 37.5552, lng: 126.9369, hints: [] },
  { id: 'hongik-station', name: '홍대입구역', area: '서울 마포구', lat: 37.5572, lng: 126.9245, hints: [] },
  { id: 'express-terminal', name: '서울고속버스터미널', area: '서울 서초구', lat: 37.5049, lng: 127.0049, hints: ['고속', '서초', '강남'] },
  { id: 'dong-seoul-terminal', name: '동서울터미널', area: '서울 광진구', lat: 37.5345, lng: 127.0947, hints: ['동서울', '강변', '광진'] },
  { id: 'gimpo-airport', name: '김포공항', area: '서울 강서구', lat: 37.5587, lng: 126.7945, hints: ['김포'] },
  { id: 'incheon-airport', name: '인천공항', area: '인천 중구', lat: 37.4602, lng: 126.4407, hints: ['인천'] },
  { id: 'snuh', name: '서울대학교병원', area: '서울 종로구', lat: 37.5796, lng: 126.999, hints: ['종로', '혜화', '본원', '대학로'] },
  { id: 'snubh', name: '분당서울대학교병원', area: '경기 성남시', lat: 37.352, lng: 127.1239, hints: ['분당', '성남'] },
  { id: 'severance', name: '신촌세브란스병원', area: '서울 서대문구', lat: 37.5622, lng: 126.9408, hints: ['신촌', '서대문', '연세'] },
  { id: 'gangnam-severance', name: '강남세브란스병원', area: '서울 강남구', lat: 37.4927, lng: 127.0463, hints: ['강남', '도곡'] },
  { id: 'samsung-hospital', name: '삼성서울병원', area: '서울 강남구', lat: 37.4881, lng: 127.0855, hints: [] },
  { id: 'asan', name: '서울아산병원', area: '서울 송파구', lat: 37.5265, lng: 127.108, hints: [] },
  { id: 'st-mary', name: '서울성모병원', area: '서울 서초구', lat: 37.5016, lng: 127.0047, hints: [] },
  { id: 'gyeongbokgung', name: '경복궁', area: '서울 종로구', lat: 37.5796, lng: 126.977, hints: [] },
  { id: 'gwanghwamun', name: '광화문광장', area: '서울 종로구', lat: 37.5725, lng: 126.9769, hints: [] },
  { id: 'yeouido-park', name: '여의도공원', area: '서울 영등포구', lat: 37.5256, lng: 126.9221, hints: [] },
  { id: 'lotte-tower', name: '롯데월드타워', area: '서울 송파구', lat: 37.5126, lng: 127.1025, hints: ['타워', '몰'] },
  { id: 'lotte-world', name: '롯데월드 어드벤처', area: '서울 송파구', lat: 37.5111, lng: 127.0981, hints: ['어드벤처', '놀이공원', '민속'] },
  { id: 'ddp', name: '동대문디자인플라자', area: '서울 중구', lat: 37.5665, lng: 127.0092, hints: [] },
  { id: 'noryangjin', name: '노량진수산시장', area: '서울 동작구', lat: 37.5134, lng: 126.9407, hints: [] },
  { id: 'mapo-office', name: '마포구청', area: '서울 마포구', lat: 37.5662, lng: 126.9019, hints: [] },
  { id: 'suwon-station', name: '수원역', area: '경기 수원시', lat: 37.2659, lng: 127.0, hints: [] },
  { id: 'daejeon-station', name: '대전역', area: '대전 동구', lat: 36.3326, lng: 127.4342, hints: [] },
  { id: 'busan-station', name: '부산역', area: '부산 동구', lat: 35.1151, lng: 129.0422, hints: [] },
]

/** 별칭 → 장소. 한 별칭이 여러 곳을 가리키면 후보로 묻는다. */
const ALIAS_TABLE: [string, string[]][] = [
  ['서울역', ['seoul-station']],
  ['용산역', ['yongsan-station']],
  ['강남역', ['gangnam-station']],
  ['시청역', ['city-hall']],
  ['서울시청', ['city-hall']],
  ['종로3가', ['jongno3']],
  ['종로삼가', ['jongno3']],
  ['신촌역', ['sinchon-station']],
  ['홍대입구', ['hongik-station']],
  ['홍대', ['hongik-station']],
  ['서울고속버스터미널', ['express-terminal']],
  ['고속버스터미널', ['express-terminal']],
  ['고속터미널', ['express-terminal']],
  ['동서울터미널', ['dong-seoul-terminal']],
  ['동서울', ['dong-seoul-terminal']],
  ['터미널', ['express-terminal', 'dong-seoul-terminal']],
  ['김포공항', ['gimpo-airport']],
  ['인천공항', ['incheon-airport']],
  ['인천국제공항', ['incheon-airport']],
  ['공항', ['gimpo-airport', 'incheon-airport']],
  ['서울대학교병원', ['snuh']],
  ['분당서울대학교병원', ['snubh']],
  ['분당서울대병원', ['snubh']],
  ['서울대병원', ['snuh', 'snubh']],
  ['신촌세브란스', ['severance']],
  ['연세세브란스', ['severance']],
  ['강남세브란스', ['gangnam-severance']],
  ['세브란스', ['severance', 'gangnam-severance']],
  ['삼성서울병원', ['samsung-hospital']],
  ['삼성병원', ['samsung-hospital']],
  ['서울아산병원', ['asan']],
  ['아산병원', ['asan']],
  ['서울성모병원', ['st-mary']],
  ['성모병원', ['st-mary']],
  ['경복궁', ['gyeongbokgung']],
  ['광화문', ['gwanghwamun']],
  ['여의도공원', ['yeouido-park']],
  ['여의도', ['yeouido-park']],
  ['롯데월드타워', ['lotte-tower']],
  ['롯데타워', ['lotte-tower']],
  ['롯데월드어드벤처', ['lotte-world']],
  ['롯데월드', ['lotte-tower', 'lotte-world']],
  ['동대문디자인플라자', ['ddp']],
  ['ddp', ['ddp']],
  ['동대문', ['ddp']],
  ['노량진수산시장', ['noryangjin']],
  ['노량진', ['noryangjin']],
  ['마포구청', ['mapo-office']],
  ['수원역', ['suwon-station']],
  ['대전역', ['daejeon-station']],
  ['부산역', ['busan-station']],
]

export const PLACE_IDS = new Set(PLACES.map((p) => p.id))

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s.,!?~·'"()\-]/g, '')
}

export function findPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id)
}

const ALIASES = ALIAS_TABLE.map(([alias, ids]) => ({ key: normalize(alias), places: ids.map((id) => findPlace(id)!) })).sort(
  (a, b) => b.key.length - a.key.length,
)

/** 발화에서 장소 후보를 찾는다. 가장 구체적인(긴) 별칭이 이긴다. */
export function resolvePlaces(utterance: string): Place[] {
  const text = normalize(utterance)
  if (!text) return []
  const hit = ALIASES.find(({ key }) => text.includes(key))
  return hit ? hit.places : []
}

/** 후보가 하나일 때만 장소를 돌려준다. */
export function matchPlace(utterance: string): Place | null {
  const r = resolvePlaces(utterance)
  return r.length === 1 ? r[0] : null
}

const ORDINALS: [RegExp, number][] = [
  [/(^|[^0-9])1번|일번|첫번째|첫째|하나|처음거|앞에거|앞에꺼/, 0],
  [/(^|[^0-9])2번|이번째|두번째|둘째|^둘|두번|뒤에거|뒤에꺼|^이번$/, 1],
  [/(^|[^0-9])3번|삼번|세번째|셋째/, 2],
]

/** 후보 목록에서 사용자가 고른 장소를 찾는다. 번호, 이름, 구별 단어 순으로 본다. */
export function pickCandidate(utterance: string, candidates: Place[]): Place | null {
  const text = normalize(utterance)
  for (const [re, i] of ORDINALS) if (re.test(text) && candidates[i]) return candidates[i]
  const exact = resolvePlaces(utterance)
  if (exact.length === 1 && candidates.some((c) => c.id === exact[0].id)) return exact[0]
  const byHint = candidates.filter((c) => c.hints.some((h) => text.includes(normalize(h))))
  return byHint.length === 1 ? byHint[0] : null
}

/** 후보를 말로 읽을 때 쓰는 짧은 이름 */
export function candidateLabel(p: Place): string {
  return p.name
}
