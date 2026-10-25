// 브라우저 내장 음성 기능. 서버 API 키가 필요 없다.
// 음성 인식(SpeechRecognition)은 Chrome·Edge에서 브라우저 회사 서버를 거칠 수 있다.

type Voice = 'agent' | 'caller'

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko'))
}

/** 한 문장을 읽고, 다 읽으면 resolve. 지원하지 않거나 오류가 나도 resolve 한다. */
export function speak(text: string, voice: Voice = 'agent'): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    const v = pickVoice()
    if (v) u.voice = v
    u.rate = voice === 'agent' ? 1 : 0.9
    u.pitch = voice === 'agent' ? 1.05 : 0.75
    const done = () => resolve()
    u.onend = done
    u.onerror = done
    // 일부 브라우저는 onend가 오지 않아서 안전장치를 둔다.
    setTimeout(done, 1500 + text.length * 180)
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

interface RecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function sttSupported(): boolean {
  return recognitionCtor() !== null
}

export type ListenError = 'not-allowed' | 'no-speech' | 'unsupported' | 'network' | 'aborted' | 'other'

/** 한 번 듣고 문장 하나를 돌려준다. */
export function listenOnce(): { promise: Promise<string>; cancel: () => void } {
  const Ctor = recognitionCtor()
  if (!Ctor) return { promise: Promise.reject<string>('unsupported' satisfies ListenError), cancel: () => {} }
  const rec = new Ctor()
  rec.lang = 'ko-KR'
  rec.interimResults = false
  rec.maxAlternatives = 1
  let timer: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<string>((resolve, reject) => {
    let got = false
    // 브라우저가 아무 이벤트도 주지 않는 경우를 막는다.
    timer = setTimeout(() => {
      rec.abort()
      reject('no-speech' satisfies ListenError)
    }, 10_000)
    rec.onresult = (e) => {
      got = true
      resolve(e.results[0][0].transcript)
    }
    rec.onerror = (e) => {
      const map: Record<string, ListenError> = {
        'not-allowed': 'not-allowed',
        'service-not-allowed': 'not-allowed',
        'no-speech': 'no-speech',
        network: 'network',
        aborted: 'aborted',
      }
      reject(map[e.error] ?? 'other')
    }
    rec.onend = () => {
      if (!got) reject('no-speech' satisfies ListenError)
    }
  })
  promise.finally(() => clearTimeout(timer)).catch(() => {})
  try {
    rec.start()
  } catch {
    return { promise: Promise.reject<string>('other' satisfies ListenError), cancel: () => {} }
  }
  return { promise, cancel: () => rec.abort() }
}

export const LISTEN_ERROR_TEXT: Record<ListenError, string> = {
  'not-allowed': '마이크 권한이 없어서 음성을 들을 수 없어요. 아래 입력창에 글로 써도 똑같이 체험할 수 있어요.',
  'no-speech': '말씀이 들리지 않았어요. 마이크 버튼을 다시 누르고 말씀해 주세요.',
  unsupported: '이 브라우저는 음성 인식을 지원하지 않아요. 아래 입력창에 글로 써서 체험해 주세요.',
  network: '음성 인식 서버에 연결하지 못했어요. 글로 입력해 계속 체험할 수 있어요.',
  aborted: '듣기를 멈췄어요.',
  other: '음성 인식을 시작하지 못했어요. 글로 입력해 계속 체험할 수 있어요.',
}
