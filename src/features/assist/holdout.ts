// 검증용 새 발화 16건. 추출 규칙을 고친 뒤(2차) 처음 작성했고, 이 결과를 보고 규칙을 더 고치지 않는다.
import type { Case } from './cases'

export const HOLDOUT: Case[] = [
  { id: 'h01', category: '정확한 이름', utterances: ['동서울터미널에서 서울대학교병원 가요'], expected: { origin: 'dong-seoul-terminal', destination: 'snuh' } },
  { id: 'h02', category: '정확한 이름', utterances: ['신촌역에서 홍대입구역까지요'], expected: { origin: 'sinchon-station', destination: 'hongik-station' } },
  { id: 'h03', category: '구어·조사', utterances: ['할머니가 지금 수원역에 계신데 수원역에서 출발해요', '대전역 말고요 그냥 서울역으로요'], expected: { origin: 'suwon-station', destination: 'seoul-station' } },
  { id: 'h04', category: '구어·조사', utterances: ['아산병원 앞인데 잠실 롯데타워로 가 줘요'], expected: { origin: 'asan', destination: 'lotte-tower' } },
  { id: 'h05', category: '구어·조사', utterances: ['어 그 경복궁 있잖아요 거기서 타요'], expected: { origin: 'gyeongbokgung', destination: 'missing' } },
  { id: 'h06', category: '나눠 말하기', utterances: ['저기요 택시요', '삼성서울병원에 있어요', '집이 서울역 근처라서 서울역 가요'], expected: { origin: 'samsung-hospital', destination: 'seoul-station' } },
  { id: 'h07', category: '나눠 말하기', utterances: ['광화문이요', '거기서 타고요', '김포공항 가요'], expected: { origin: 'gwanghwamun', destination: 'gimpo-airport' } },
  { id: 'h08', category: '애매한 이름', utterances: ['터미널 가요', '지금 용산역이에요'], expected: { origin: 'yongsan-station', destination: 'ambiguous' } },
  { id: 'h09', category: '애매한 이름', utterances: ['강남 세브란스에서 탈게요 공항 가요 김포요'], expected: { origin: 'gangnam-severance', destination: 'gimpo-airport' } },
  { id: 'h10', category: '애매한 이름', utterances: ['서울대병원 가요'], expected: { origin: 'missing', destination: 'ambiguous' } },
  { id: 'h11', category: '말 바꾸기', utterances: ['용산역에서 경복궁 가요', '죄송해요 목적지를 서울성모병원으로 바꿔 주세요'], expected: { origin: 'yongsan-station', destination: 'st-mary' } },
  { id: 'h12', category: '말 바꾸기', utterances: ['시청역에서 탈게요', '아 시청역 아니고 종로3가에서 탈게요', 'DDP 가요'], expected: { origin: 'jongno3', destination: 'ddp' } },
  { id: 'h13', category: '목록 밖·모호', utterances: ['구로디지털단지역에서 탈게요', '서울역 가요'], expected: { origin: 'missing', destination: 'seoul-station' } },
  { id: 'h14', category: '목록 밖·모호', utterances: ['서울역 롯데마트에서 탈게요', '강남역 가요'], expected: { origin: 'missing', destination: 'gangnam-station' } },
  { id: 'h15', category: '목록 밖·모호', utterances: ['노량진 학원가에서 출발해요', '여의도 가요'], expected: { origin: 'missing', destination: 'yeouido-park' } },
  { id: 'h16', category: '목록 밖·모호', utterances: ['병원 갔다가 집에 가야 돼요'], expected: { origin: 'missing', destination: 'missing' } },
]
