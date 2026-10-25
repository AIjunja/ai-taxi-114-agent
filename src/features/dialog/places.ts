// 데모용 장소 목록. 실제 지오코딩이 아니라 이름 일치로만 찾는다.
// 공개 장소 이름만 쓰고, 정확한 주소·좌표는 담지 않는다.
export interface Place {
  id: string
  name: string
  area: string
  aliases: string[]
}

export const PLACES: Place[] = [
  { id: 'seoul-station', name: '서울역', area: '서울 용산구', aliases: ['서울역'] },
  { id: 'yongsan-station', name: '용산역', area: '서울 용산구', aliases: ['용산역'] },
  { id: 'gangnam-station', name: '강남역', area: '서울 강남구', aliases: ['강남역'] },
  { id: 'city-hall', name: '시청역', area: '서울 중구', aliases: ['시청역', '서울시청'] },
  { id: 'jongno3', name: '종로3가역', area: '서울 종로구', aliases: ['종로3가', '종로삼가'] },
  { id: 'sinchon-station', name: '신촌역', area: '서울 서대문구', aliases: ['신촌역'] },
  { id: 'hongik-station', name: '홍대입구역', area: '서울 마포구', aliases: ['홍대입구', '홍대'] },
  { id: 'express-terminal', name: '고속버스터미널', area: '서울 서초구', aliases: ['고속버스터미널', '고속터미널', '강남터미널'] },
  { id: 'gimpo-airport', name: '김포공항', area: '서울 강서구', aliases: ['김포공항'] },
  { id: 'snuh', name: '서울대학교병원', area: '서울 종로구', aliases: ['서울대학교병원', '서울대병원'] },
  { id: 'severance', name: '세브란스병원', area: '서울 서대문구', aliases: ['세브란스병원', '세브란스', '신촌세브란스'] },
  { id: 'samsung-hospital', name: '삼성서울병원', area: '서울 강남구', aliases: ['삼성서울병원', '삼성병원'] },
  { id: 'asan', name: '서울아산병원', area: '서울 송파구', aliases: ['서울아산병원', '아산병원'] },
  { id: 'gyeongbokgung', name: '경복궁', area: '서울 종로구', aliases: ['경복궁'] },
  { id: 'gwanghwamun', name: '광화문광장', area: '서울 종로구', aliases: ['광화문광장', '광화문'] },
  { id: 'yeouido-park', name: '여의도공원', area: '서울 영등포구', aliases: ['여의도공원', '여의도'] },
  { id: 'lotte-tower', name: '롯데월드타워', area: '서울 송파구', aliases: ['롯데월드타워', '롯데타워', '잠실롯데'] },
  { id: 'ddp', name: '동대문디자인플라자', area: '서울 중구', aliases: ['동대문디자인플라자', 'ddp', '동대문'] },
  { id: 'noryangjin', name: '노량진수산시장', area: '서울 동작구', aliases: ['노량진수산시장', '노량진'] },
  { id: 'mapo-office', name: '마포구청', area: '서울 마포구', aliases: ['마포구청'] },
  { id: 'suwon-station', name: '수원역', area: '경기 수원시', aliases: ['수원역'] },
  { id: 'daejeon-station', name: '대전역', area: '대전 동구', aliases: ['대전역'] },
  { id: 'busan-station', name: '부산역', area: '부산 동구', aliases: ['부산역'] },
  { id: 'gwangju-terminal', name: '광주종합버스터미널', area: '광주 서구', aliases: ['광주종합버스터미널', '광주터미널', '유스퀘어'] },
]

export const PLACE_IDS = new Set(PLACES.map((p) => p.id))

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s.,!?~·'"()\-]/g, '')
}

const ALIASES = PLACES.flatMap((place) => place.aliases.map((alias) => ({ place, key: normalize(alias) }))).sort(
  (a, b) => b.key.length - a.key.length,
)

/** 발화 안에 들어 있는 가장 긴 장소 별칭을 찾는다. */
export function matchPlace(utterance: string): Place | null {
  const text = normalize(utterance)
  if (!text) return null
  const hit = ALIASES.find(({ key }) => text.includes(key))
  return hit ? hit.place : null
}

export function findPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id)
}
