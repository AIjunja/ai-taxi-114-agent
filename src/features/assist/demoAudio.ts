// 자동 시연 음성 재생. 클립은 public/audio/demo 에 미리 만든 한국어 음성(Microsoft 신경망 음성)이다.
import manifest from '../../../public/audio/demo/manifest.json'

type Clip = { text: string; voice: string; sec: number }
const CLIPS = manifest as Record<string, Clip>

export function clipText(id: string): string {
  return CLIPS[id]?.text ?? ''
}

export class DemoAudio {
  private audio: HTMLAudioElement | null = null
  /** 클립 폴더와 길이 표. 기본값은 상담원 보조 화면용 클립이다. */
  constructor(
    private base = '/audio/demo',
    private seconds: (id: string) => number | undefined = (id) => CLIPS[id]?.sec,
  ) {}
  private paused = false
  muted = false
  stopped = false

  pause() {
    this.paused = true
    this.audio?.pause()
  }

  resume() {
    this.paused = false
    void this.audio?.play().catch(() => {})
  }

  stop() {
    this.stopped = true
    this.audio?.pause()
    this.audio = null
  }

  /** 일시정지 중이면 풀릴 때까지 기다린다. 멈췄으면 false */
  async gate(): Promise<boolean> {
    while (this.paused && !this.stopped) await new Promise((r) => setTimeout(r, 120))
    return !this.stopped
  }

  async wait(ms: number): Promise<boolean> {
    const until = Date.now() + ms
    while (Date.now() < until) {
      if (!(await this.gate())) return false
      await new Promise((r) => setTimeout(r, Math.min(100, until - Date.now())))
    }
    return this.gate()
  }

  /** 클립 하나를 끝까지 재생한다. 소리를 끄면 같은 시간만큼 기다린다. */
  async play(id: string): Promise<boolean> {
    if (!(await this.gate())) return false
    const sec = this.seconds(id)
    if (sec === undefined) return true
    const clip = { sec }
    if (this.muted) return this.wait(clip.sec * 1000)
    const a = new Audio(`${this.base}/${encodeURIComponent(id)}.mp3`)
    this.audio = a
    await new Promise<void>((resolve) => {
      const done = () => resolve()
      a.onended = done
      a.onerror = done
      // 재생이 막히거나 이벤트가 안 오면 클립 길이 + 여유 뒤에 넘어간다
      const guard = setInterval(() => {
        if (this.stopped || (!this.paused && a.ended)) {
          clearInterval(guard)
          done()
        }
      }, 200)
      a.play().catch(() => setTimeout(done, clip.sec * 1000))
      setTimeout(() => {
        clearInterval(guard)
        done()
      }, clip.sec * 1000 + 3000)
    })
    this.audio = null
    return !this.stopped
  }
}
