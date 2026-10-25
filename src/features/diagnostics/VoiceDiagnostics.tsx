// 음성 진단: STT가 안 될 때 원인을 단계별로 나눠 확인한다.
//   1) 브라우저 지원  2) 마이크 권한·입력  3) 음성 인식 서버 응답  4) 음성 합성(TTS) 목소리
// 결과는 화면에만 보여주고 저장하지 않는다.
import { useState } from 'react'
import { ArrowLeft, Copy } from 'lucide-react'

type Status = 'idle' | 'running' | 'ok' | 'fail' | 'warn'

interface Check {
  key: string
  title: string
  status: Status
  detail: string[]
}

const INITIAL: Check[] = [
  { key: 'support', title: '1. 브라우저 지원', status: 'idle', detail: [] },
  { key: 'mic', title: '2. 마이크 권한과 입력 소리', status: 'idle', detail: [] },
  { key: 'stt', title: '3. 음성 인식 서버 응답', status: 'idle', detail: [] },
  { key: 'tts', title: '4. 음성 합성 목소리', status: 'idle', detail: [] },
]

const ICON: Record<Status, string> = { idle: '대기', running: '확인 중', ok: '정상', fail: '실패', warn: '주의' }
const TONE: Record<Status, string> = {
  idle: 'bg-bg text-muted',
  running: 'bg-info-soft text-info',
  ok: 'bg-accent-soft text-accent-strong',
  fail: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
}

interface RecLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string; message?: string }) => void) | null
  onend: (() => void) | null
  addEventListener: (n: string, f: () => void) => void
  start: () => void
  stop: () => void
}

function browserName(): string {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Microsoft Edge'
  if (/Whale\//.test(ua)) return '네이버 웨일'
  if (/SamsungBrowser/.test(ua)) return '삼성 인터넷'
  if (/Chrome\//.test(ua)) return 'Chrome 계열'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/Firefox\//.test(ua)) return 'Firefox'
  return '알 수 없음'
}

export function VoiceDiagnostics() {
  const [checks, setChecks] = useState<Check[]>(INITIAL)
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)

  const set = (key: string, patch: Partial<Check>) => setChecks((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  const add = (key: string, line: string) => setChecks((cs) => cs.map((c) => (c.key === key ? { ...c, detail: [...c.detail, line] } : c)))

  async function run() {
    setBusy(true)
    setChecks(INITIAL)

    // 1) 지원 여부
    const w = window as unknown as { SpeechRecognition?: new () => RecLike; webkitSpeechRecognition?: new () => RecLike }
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition
    const support = [
      `브라우저: ${browserName()}`,
      `보안 연결(HTTPS): ${window.isSecureContext ? '예' : '아니요'}`,
      `음성 인식 API: ${w.SpeechRecognition ? 'SpeechRecognition' : w.webkitSpeechRecognition ? 'webkitSpeechRecognition' : '없음'}`,
      `음성 합성 API: ${'speechSynthesis' in window ? '있음' : '없음'}`,
      `마이크 API: ${typeof navigator.mediaDevices?.getUserMedia === 'function' ? '있음' : '없음'}`,
    ]
    set('support', { status: Rec && window.isSecureContext ? 'ok' : 'fail', detail: support })

    // 2) 마이크
    set('mic', { status: 'running' })
    try {
      const perm = await navigator.permissions?.query({ name: 'microphone' as PermissionName }).catch(() => null)
      if (perm) add('mic', `권한 상태(요청 전): ${perm.state}`)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const track = stream.getAudioTracks()[0]
      add('mic', `입력 장치: ${track.label || '(이름 없음)'}`)
      const ctx = new AudioContext()
      await ctx.resume()
      const an = ctx.createAnalyser()
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.fftSize)
      let peak = 0
      const until = performance.now() + 3000
      add('mic', '3초 동안 아무 말이나 해 주세요.')
      await new Promise<void>((resolve) => {
        const loop = () => {
          an.getByteTimeDomainData(buf)
          let s = 0
          for (const v of buf) s += ((v - 128) / 128) ** 2
          const l = Math.min(1, Math.sqrt(s / buf.length) * 4)
          peak = Math.max(peak, l)
          setLevel(l)
          if (performance.now() < until) requestAnimationFrame(loop)
          else resolve()
        }
        loop()
      })
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
      setLevel(0)
      add('mic', `최대 입력 크기: ${(peak * 100).toFixed(0)}%`)
      set('mic', { status: peak > 0.05 ? 'ok' : 'warn' })
      if (peak <= 0.05) add('mic', '소리가 거의 들어오지 않았어요. 마이크 음소거나 다른 입력 장치 선택을 확인해 주세요.')
    } catch (e) {
      const err = e as DOMException
      add('mic', `오류: ${err.name} ${err.message}`)
      add('mic', err.name === 'NotAllowedError' ? '마이크 권한이 거부됐어요. 주소창 왼쪽 아이콘에서 허용해 주세요.' : err.name === 'NotFoundError' ? '연결된 마이크가 없어요.' : '마이크를 열지 못했어요.')
      set('mic', { status: 'fail' })
    }

    // 3) 음성 인식
    if (!Rec) {
      set('stt', { status: 'fail', detail: ['이 브라우저에는 음성 인식 API가 없어요. Chrome이나 Edge, Safari에서 열어 주세요.'] })
    } else {
      set('stt', { status: 'running', detail: ['8초 동안 "서울역에서 세브란스병원 가요"라고 말해 주세요.'] })
      const t0 = performance.now()
      const stamp = () => `${((performance.now() - t0) / 1000).toFixed(1)}초`
      const result = await new Promise<{ text: string; error?: string; events: string[] }>((resolve) => {
        const events: string[] = []
        let text = ''
        let error: string | undefined
        const rec = new Rec()
        rec.lang = 'ko-KR'
        rec.interimResults = true
        rec.continuous = true
        for (const n of ['audiostart', 'soundstart', 'speechstart', 'speechend', 'audioend']) rec.addEventListener(n, () => events.push(`${stamp()} ${n}`))
        rec.onresult = (e) => {
          text = Array.from(e.results)
            .map((r) => r[0].transcript)
            .join(' ')
          events.push(`${stamp()} result "${text}"`)
        }
        rec.onerror = (e) => {
          error = e.error
          events.push(`${stamp()} error ${e.error}${e.message ? ` (${e.message})` : ''}`)
        }
        rec.onend = () => resolve({ text: text.trim(), error, events })
        try {
          rec.start()
        } catch (err) {
          resolve({ text: '', error: `start 실패: ${(err as Error).message}`, events })
        }
        setTimeout(() => rec.stop(), 8000)
      })
      result.events.forEach((l) => add('stt', l))
      const heardSound = result.events.some((l) => l.includes('soundstart') || l.includes('speechstart'))
      let verdict: string
      let status: Status
      if (result.text) {
        verdict = `인식됨: "${result.text}"`
        status = 'ok'
      } else if (result.error === 'not-allowed' || result.error === 'service-not-allowed') {
        verdict = '원인: 권한. 브라우저나 운영체제가 음성 인식 사용을 막았어요.'
        status = 'fail'
      } else if (result.error === 'network') {
        verdict = '원인: 음성 인식 서버 연결 실패. 이 브라우저는 인식을 위해 외부 서버에 접속해요.'
        status = 'fail'
      } else if (result.error === 'language-not-supported') {
        verdict = '원인: 이 브라우저가 한국어 인식을 지원하지 않아요.'
        status = 'fail'
      } else if (heardSound) {
        verdict = '원인: 소리는 들어갔지만 인식 서버가 글자를 돌려주지 않았어요 (서버 응답 문제).'
        status = 'fail'
      } else {
        verdict = '원인: 마이크 소리가 인식기로 들어가지 않았어요 (입력 장치·음소거 확인).'
        status = 'fail'
      }
      add('stt', verdict)
      set('stt', { status })
    }

    // 4) TTS
    set('tts', { status: 'running' })
    const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const v = speechSynthesis.getVoices()
      if (v.length) return resolve(v)
      speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices())
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500)
    })
    const ko = voices.filter((v) => v.lang.toLowerCase().startsWith('ko'))
    add('tts', `한국어 목소리 ${ko.length}개: ${ko.map((v) => `${v.name}${v.localService ? '(기기)' : '(온라인)'}`).join(', ') || '없음'}`)
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance('서울역에서 세브란스병원까지 택시를 불러 드릴게요.')
      u.lang = 'ko-KR'
      if (ko[0]) u.voice = ko[0]
      u.rate = 0.92
      u.onend = () => resolve()
      u.onerror = () => resolve()
      setTimeout(resolve, 9000)
      speechSynthesis.speak(u)
    })
    add('tts', `예시 문장 읽기: ${((performance.now() - started) / 1000).toFixed(1)}초`)
    add('tts', '기기에 설치된 합성 음성이라 사람 상담원 목소리와는 차이가 커요. 이 PoC는 TTS 품질을 주장하지 않아요.')
    set('tts', { status: ko.length ? 'warn' : 'fail' })
    setBusy(false)
  }

  const report = checks.map((c) => `${c.title} [${ICON[c.status]}]\n${c.detail.map((d) => `  - ${d}`).join('\n')}`).join('\n')

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[860px] items-center gap-2 px-4 py-3">
          <a href="/" className="rounded-md p-1 hover:bg-bg" aria-label="돌아가기">
            <ArrowLeft size={18} />
          </a>
          <h1 className="font-display text-base font-bold">음성 진단</h1>
          <span className="text-xs text-muted">STT가 안 될 때 원인을 나눠서 확인해요 · 결과는 저장하지 않아요</span>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] space-y-3 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={run} disabled={busy} data-testid="diag-run" className="h-11 rounded-lg bg-ink px-5 font-bold text-white disabled:opacity-40">
            {busy ? '확인하는 중' : '진단 시작'}
          </button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(report)} className="flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-bold">
            <Copy size={15} /> 결과 복사
          </button>
          <div className="ml-auto h-2 w-40 overflow-hidden rounded-full bg-line" aria-label="마이크 입력 크기">
            <div className="h-full bg-info transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
          </div>
        </div>
        {checks.map((c) => (
          <section key={c.key} className="rounded-xl border border-line bg-surface p-4" data-testid={`diag-${c.key}`} data-status={c.status}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{c.title}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[c.status]}`}>{ICON[c.status]}</span>
            </div>
            {c.detail.length > 0 && (
              <ul className="num mt-2 space-y-0.5 text-[13px] text-muted">
                {c.detail.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}
