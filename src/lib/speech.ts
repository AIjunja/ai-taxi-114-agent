// 브라우저 내장 음성 기능 (Web Speech API).
// STT: SpeechRecognition — Chrome·Edge는 인식을 위해 음성을 브라우저 회사 서버로 보낸다.
// TTS: speechSynthesis — 기기에 설치된 한국어 음성으로 읽는다.

export type Voice = 'agent' | 'caller'

export interface VoiceSettings {
  rate: number // 0.6 ~ 1.1
  volume: number // 0 ~ 1
}

export const VOICE_NORMAL: VoiceSettings = { rate: 0.92, volume: 1 }
export const VOICE_SLOW: VoiceSettings = { rate: 0.78, volume: 1 }

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let cachedVoices: SpeechSynthesisVoice[] = []
if (ttsSupported()) {
  const load = () => (cachedVoices = window.speechSynthesis.getVoices())
  load()
  window.speechSynthesis.addEventListener?.('voiceschanged', load)
}

export function koreanVoices(): SpeechSynthesisVoice[] {
  return cachedVoices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ko'))
}

function pickVoice(kind: Voice): SpeechSynthesisVoice | undefined {
  const ko = koreanVoices()
  if (kind === 'caller' && ko.length > 1) return ko[1]
  // 자연스러운 온라인 음성을 먼저 고른다
  return ko.find((v) => /natural|online|google/i.test(v.name)) ?? ko[0]
}

export function hasKoreanVoice(): boolean {
  return koreanVoices().length > 0
}

/** 문장을 또박또박 읽는다. 쉼표에서 짧게 쉬고, 다 읽으면 resolve 한다. */
export function speak(text: string, settings: VoiceSettings = VOICE_NORMAL, kind: Voice = 'agent'): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    const v = pickVoice(kind)
    if (v) u.voice = v
    u.rate = kind === 'caller' ? Math.min(1, settings.rate + 0.05) : settings.rate
    u.pitch = kind === 'caller' ? 0.8 : 1
    u.volume = settings.volume
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(guard)
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    // 일부 브라우저는 onend가 오지 않아서 안전장치를 둔다.
    const guard = setTimeout(finish, 2500 + (text.length * 260) / settings.rate)
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onspeechstart?: (() => void) | null
  start(): void
  stop(): void
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

/** 한 문장을 듣는다. 듣는 동안 중간 인식 결과를 onInterim으로 보낸다. */
export function listenOnce(onInterim?: (text: string) => void, maxMs = 9000): { promise: Promise<string>; cancel: () => void } {
  const Ctor = recognitionCtor()
  if (!Ctor) return { promise: Promise.reject<string>('unsupported' satisfies ListenError), cancel: () => {} }
  const rec = new Ctor()
  rec.lang = 'ko-KR'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  let timer: ReturnType<typeof setTimeout> | undefined
  let finalText = ''
  let interim = ''
  const promise = new Promise<string>((resolve, reject) => {
    timer = setTimeout(() => {
      // 오래 말하면 들은 데까지 쓴다
      if (interim) {
        finalText = interim
        rec.stop()
      } else {
        rec.abort()
        reject('no-speech' satisfies ListenError)
      }
    }, maxMs)
    rec.onresult = (e) => {
      let text = ''
      let isFinal = false
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
        if (e.results[i].isFinal) isFinal = true
      }
      interim = text
      onInterim?.(text)
      if (isFinal) finalText = text
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
      const text = (finalText || interim).trim()
      if (text) resolve(text)
      else reject('no-speech' satisfies ListenError)
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
  'not-allowed': '마이크 권한이 없어서 음성을 들을 수 없어요. 주소창의 마이크 아이콘에서 허용하거나, 아래 입력창에 글로 써도 똑같이 진행돼요.',
  'no-speech': '말씀이 들리지 않았어요.',
  unsupported: '이 브라우저는 음성 인식을 지원하지 않아요. Chrome이나 Edge에서 열거나, 아래 입력창에 글로 써서 진행해 주세요.',
  network: '음성 인식 서버에 연결하지 못했어요. 글로 입력해 계속할 수 있어요.',
  aborted: '듣기를 멈췄어요.',
  other: '음성 인식을 시작하지 못했어요. 글로 입력해 계속할 수 있어요.',
}

/** 마이크 입력 크기(0~1)를 계속 알려준다. 소리 확인과 듣는 중 표시에 쓴다. */
export async function startMicMeter(onLevel: (level: number) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  src.connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  let raf = 0
  const loop = () => {
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += ((v - 128) / 128) ** 2
    onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
    raf = requestAnimationFrame(loop)
  }
  loop()
  return () => {
    cancelAnimationFrame(raf)
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }
}
