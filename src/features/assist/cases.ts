// 장소 정리 실험용 고객 발화 모음. 실제 녹취가 아니라 이 PoC를 위해 직접 만든 예시다.
// expected 값 규칙: 장소 id = 그 곳으로 정리해야 정답, 'ambiguous' = 후보를 여러 개 보여줘야 정답,
// 'missing' = 모른다고 표시해 상담원에게 넘겨야 정답 (틀린 장소를 자신 있게 채우면 오답).
export interface Case {
  id: string
  category: '정확한 이름' | '구어·조사' | '나눠 말하기' | '애매한 이름' | '말 바꾸기' | '목록 밖·모호'
  utterances: string[]
  expected: { origin: string; destination: string }
}

export const CASES: Case[] = [
  // 정확한 이름
  { id: 'c01', category: '정확한 이름', utterances: ['서울역에서 서울아산병원까지 가요'], expected: { origin: 'seoul-station', destination: 'asan' } },
  { id: 'c02', category: '정확한 이름', utterances: ['김포공항에서 강남역으로 가 주세요'], expected: { origin: 'gimpo-airport', destination: 'gangnam-station' } },
  { id: 'c03', category: '정확한 이름', utterances: ['용산역에서 삼성서울병원 가려고요'], expected: { origin: 'yongsan-station', destination: 'samsung-hospital' } },
  { id: 'c04', category: '정확한 이름', utterances: ['서울고속버스터미널에서 서울성모병원까지요'], expected: { origin: 'express-terminal', destination: 'st-mary' } },
  { id: 'c05', category: '정확한 이름', utterances: ['광화문광장에서 롯데월드타워로 가요'], expected: { origin: 'gwanghwamun', destination: 'lotte-tower' } },
  { id: 'c06', category: '정확한 이름', utterances: ['시청역에서 노량진수산시장 갈게요'], expected: { origin: 'city-hall', destination: 'noryangjin' } },
  // 구어·조사
  { id: 'c07', category: '구어·조사', utterances: ['나 지금 서울역 앞이야 아산병원 가야 돼'], expected: { origin: 'seoul-station', destination: 'asan' } },
  { id: 'c08', category: '구어·조사', utterances: ['여기 홍대 입구인데 신촌세브란스 좀 데려다 줘요'], expected: { origin: 'hongik-station', destination: 'severance' } },
  { id: 'c09', category: '구어·조사', utterances: ['종로 삼가에 있는데요 서울대병원 본원 가요'], expected: { origin: 'jongno3', destination: 'snuh' } },
  { id: 'c10', category: '구어·조사', utterances: ['마포구청 앞에서 탈게요 여의도공원 쪽으로요'], expected: { origin: 'mapo-office', destination: 'yeouido-park' } },
  { id: 'c11', category: '구어·조사', utterances: ['김포 공항 국내선에서 경복궁 가려고 하는데요'], expected: { origin: 'gimpo-airport', destination: 'gyeongbokgung' } },
  { id: 'c12', category: '구어·조사', utterances: ['서울역 가는데 지금 시청역이에요'], expected: { origin: 'city-hall', destination: 'seoul-station' } },
  // 나눠 말하기
  { id: 'c13', category: '나눠 말하기', utterances: ['여보세요', '택시 좀 불러 주세요', '서울역이요', '아산병원이요'], expected: { origin: 'seoul-station', destination: 'asan' } },
  { id: 'c14', category: '나눠 말하기', utterances: ['용산역 앞이에요', '거기서 삼성병원 가요'], expected: { origin: 'yongsan-station', destination: 'samsung-hospital' } },
  { id: 'c15', category: '나눠 말하기', utterances: ['병원 가야 되는데', '서울성모병원이요', '지금은 고속터미널에 있어요'], expected: { origin: 'express-terminal', destination: 'st-mary' } },
  { id: 'c16', category: '나눠 말하기', utterances: ['저 강남역에 있거든요', '동대문디자인플라자요'], expected: { origin: 'gangnam-station', destination: 'ddp' } },
  // 애매한 이름 (후보를 보여줘야 정답)
  { id: 'c17', category: '애매한 이름', utterances: ['서울역에서 세브란스 가요'], expected: { origin: 'seoul-station', destination: 'ambiguous' } },
  { id: 'c18', category: '애매한 이름', utterances: ['서울역에서 공항 가요'], expected: { origin: 'seoul-station', destination: 'ambiguous' } },
  { id: 'c19', category: '애매한 이름', utterances: ['롯데월드 가는데 지금 강남역이에요'], expected: { origin: 'gangnam-station', destination: 'ambiguous' } },
  { id: 'c20', category: '애매한 이름', utterances: ['서울역에서 세브란스 신촌 쪽이요'], expected: { origin: 'seoul-station', destination: 'severance' } },
  { id: 'c21', category: '애매한 이름', utterances: ['용산역에서 서울대병원 분당이요'], expected: { origin: 'yongsan-station', destination: 'snubh' } },
  // 말 바꾸기
  { id: 'c22', category: '말 바꾸기', utterances: ['서울역에서 강남역 가요', '아 강남역 말고 김포공항으로 가 주세요'], expected: { origin: 'seoul-station', destination: 'gimpo-airport' } },
  { id: 'c23', category: '말 바꾸기', utterances: ['서울역 말고 용산역에서 탈게요', '아산병원 가요'], expected: { origin: 'yongsan-station', destination: 'asan' } },
  { id: 'c24', category: '말 바꾸기', utterances: ['시청역에서 경복궁 가요', '아니다 광화문으로 바꿀게요'], expected: { origin: 'city-hall', destination: 'gwanghwamun' } },
  { id: 'c25', category: '말 바꾸기', utterances: ['강남역에서 삼성병원', '목적지를 아산병원으로 바꿔 주세요'], expected: { origin: 'gangnam-station', destination: 'asan' } },
  { id: 'c26', category: '말 바꾸기', utterances: ['홍대에서 여의도 가요', '아니 여의도 말고 노량진으로'], expected: { origin: 'hongik-station', destination: 'noryangjin' } },
  // 목록 밖·모호 (모른다고 표시해야 정답)
  { id: 'c27', category: '목록 밖·모호', utterances: ['역삼역 근처에서 탈게요', '서울아산병원 가요'], expected: { origin: 'missing', destination: 'asan' } },
  { id: 'c28', category: '목록 밖·모호', utterances: ['우리 동네 농협 앞에서 탈 건데', '큰 병원 가요'], expected: { origin: 'missing', destination: 'missing' } },
  { id: 'c29', category: '목록 밖·모호', utterances: ['여기가 어딘지 잘 모르겠어요', '아들 집에 가요'], expected: { origin: 'missing', destination: 'missing' } },
  { id: 'c30', category: '목록 밖·모호', utterances: ['서울역에서 동대문시장 가요'], expected: { origin: 'seoul-station', destination: 'missing' } },
  { id: 'c31', category: '목록 밖·모호', utterances: ['용산역에서 여의도 63빌딩 가요'], expected: { origin: 'yongsan-station', destination: 'missing' } },
  { id: 'c32', category: '목록 밖·모호', utterances: ['서울역에서 인천공항 2터미널이요'], expected: { origin: 'seoul-station', destination: 'incheon-airport' } },
  { id: 'c33', category: '목록 밖·모호', utterances: ['삼성역에서 탈게요', '강남세브란스 가요'], expected: { origin: 'missing', destination: 'gangnam-severance' } },
  { id: 'c34', category: '목록 밖·모호', utterances: ['병원이요 병원', '아까 갔던 데요'], expected: { origin: 'missing', destination: 'missing' } },
]
