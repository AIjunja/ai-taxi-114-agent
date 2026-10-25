// 고객 발화(여러 마디)에서 출발지·목적지를 정리한다. 규칙 기반이다.
// 결과는 '확정'이 아니라 상담원에게 보여줄 '제안'이다. 상담원이 확인해야 콘솔에 입력한다.
import { aliasEntries, normalize, pickCandidate, type Place } from '../dialog/places'

export type Role = 'origin' | 'destination' | 'unknown' | 'rejected'

export interface Mention {
  utterance: number
  key: string
  places: Place[]
  role: Role
  reason: string
}

export interface Slot {
  status: 'found' | 'ambiguous' | 'missing'
  places: Place[]
  /** 근거가 된 발화 번호 */
  utterance?: number
  reason?: string
  changed?: boolean
}

export interface Extraction {
  origin: Slot
  destination: Slot
  mentions: Mention[]
  notes: string[]
}

const AFTER_ORIGIN = /^(에서|앞에서|앞이|앞인데|앞이에요|앞이야|앞에있|에있|앞쪽|입구|정문|역앞)/
const AFTER_DEST = /^(으로|로|까지|에가|가요|가야|가려|가는|갈|에갈|쪽으로)/
const AFTER_REJECT = /^(말고|아니고|아니라|아니야|아니에요|취소)/
const ORIGIN_WORDS = /(타|탈게|탈건|있어|있는데|있거든|여기|출발|나왔|계신|이에요$|이야$|인데$)/
const DEST_WORDS = /(가요|가야|가려|갈게|갈거|가주|가줘|가는데|까지|가고싶|데려|병원가|가자)/
const CHANGE_WORDS = /(바꿔|바꿀|변경|정정|말고|아니다|아니아니|다시)/

/** 한 문장에서 장소 언급을 모두 찾는다. 같은 위치에서는 가장 긴 별칭을 쓴다. */
export function findMentions(text: string, utterance = 0): Mention[] {
  const t = normalize(text)
  const aliases = aliasEntries()
  const found: Mention[] = []
  let i = 0
  while (i < t.length) {
    const hit = aliases.find((a) => t.startsWith(a.key, i))
    if (!hit) {
      i++
      continue
    }
    const after = t.slice(i + hit.key.length)
    let role: Role = 'unknown'
    let reason = '문장 맥락'
    if (AFTER_REJECT.test(after)) {
      role = 'rejected'
      reason = `뒤에 '${after.match(AFTER_REJECT)![0]}'`
    } else if (AFTER_ORIGIN.test(after)) {
      role = 'origin'
      reason = `뒤에 '${after.match(AFTER_ORIGIN)![0]}'`
    } else if (AFTER_DEST.test(after)) {
      role = 'destination'
      reason = `뒤에 '${after.match(AFTER_DEST)![0]}'`
    }
    // 이름이 겹치면 같은 문장의 구별 단어(신촌, 분당, 본원 등)로 좁힌다
    let places = hit.places
    if (places.length > 1) {
      const picked = pickCandidate(text, places)
      if (picked) {
        places = [picked]
        reason += ` · '${picked.hints.find((h) => t.includes(normalize(h))) ?? picked.name}'로 좁힘`
      }
    }
    found.push({ utterance, key: hit.key, places, role, reason })
    i += hit.key.length
  }
  // 조사로 역할을 못 정한 언급은 문장 전체의 표현으로 정한다
  // 같은 문장에 이미 정해진 역할이 있으면 남은 역할을 준다
  const unknown = found.filter((m) => m.role === 'unknown')
  if (unknown.length === 1) {
    const taken = new Set(found.map((m) => m.role))
    if (taken.has('destination') && !taken.has('origin')) Object.assign(unknown[0], { role: 'origin', reason: '같은 문장의 다른 곳이 목적지' })
    else if (taken.has('origin') && !taken.has('destination')) Object.assign(unknown[0], { role: 'destination', reason: '같은 문장의 다른 곳이 출발지' })
    else {
      const dest = DEST_WORDS.test(t)
      const orig = ORIGIN_WORDS.test(t)
      if (dest && !orig) Object.assign(unknown[0], { role: 'destination', reason: "문장에 '가다' 표현" })
      else if (orig && !dest) Object.assign(unknown[0], { role: 'origin', reason: "문장에 '타다·있다' 표현" })
    }
  }
  return found
}

function slotFrom(m: Mention | undefined, changed: boolean): Slot {
  if (!m) return { status: 'missing', places: [] }
  return { status: m.places.length > 1 ? 'ambiguous' : 'found', places: m.places, utterance: m.utterance, reason: m.reason, changed }
}

export function extract(utterances: string[]): Extraction {
  const mentions = utterances.flatMap((u, i) => findMentions(u, i))
  const notes: string[] = []
  let origin: Mention | undefined
  let destination: Mention | undefined
  let originChanged = false
  let destChanged = false

  for (const m of mentions) {
    if (m.role === 'rejected') {
      notes.push(`${m.utterance + 1}번째 말의 '${m.places[0].name}'은(는) 고객이 아니라고 해서 뺐어요.`)
      continue
    }
    if (m.role === 'origin') {
      if (origin && origin.key !== m.key) originChanged = true
      origin = m
    } else if (m.role === 'destination') {
      if (destination && destination.key !== m.key) destChanged = true
      destination = m
    }
  }
  // 역할을 모르는 언급: 빈 칸을 출발지 → 목적지 순서로 채운다.
  // 이미 둘 다 있으면 바꾸는 말인지 보고 목적지를 바꾼다.
  for (const m of mentions.filter((x) => x.role === 'unknown')) {
    if (!origin) {
      origin = { ...m, reason: '역할 표현이 없어 먼저 나온 곳을 출발지로 추정' }
    } else if (!destination && m.key !== origin.key) {
      destination = { ...m, reason: '역할 표현이 없어 뒤에 나온 곳을 목적지로 추정' }
    } else if (destination && CHANGE_WORDS.test(normalize(utterances[m.utterance])) && m.key !== destination.key) {
      destination = { ...m, reason: '바꾸는 말이 있어 목적지를 새 장소로 추정' }
      destChanged = true
    }
  }
  if (origin && destination && origin.places.length === 1 && destination.places.length === 1 && origin.places[0].id === destination.places[0].id) {
    notes.push('출발지와 목적지가 같아요. 고객에게 다시 확인해야 해요.')
  }
  if (originChanged) notes.push('고객이 중간에 출발지를 바꿨어요. 마지막에 말한 곳을 썼어요.')
  if (destChanged) notes.push('고객이 중간에 목적지를 바꿨어요. 마지막에 말한 곳을 썼어요.')
  return { origin: slotFrom(origin, originChanged), destination: slotFrom(destination, destChanged), mentions, notes }
}
