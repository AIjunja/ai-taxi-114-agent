// 공개 URL에서 실제 Chrome으로 음성 흐름을 확인한다.
// 마이크 입력은 미리 만든 한국어 음성 파일(--use-file-for-fake-audio-capture)을 쓰고,
// 음성 인식·합성은 Chrome의 실제 Web Speech API를 쓴다.
//   BASE=https://... WAV=C:\dev\voice\seoul.wav OUT=dir npx tsx scripts/verify-voice.ts
import { chromium } from '@playwright/test'

const base = process.env.BASE ?? 'https://ai-taxi-114-agent.vercel.app'
const wav = process.env.WAV!
const out = process.env.OUT ?? '.'
const t0 = Date.now()
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] })
const page = await context.newPage()
await page.addInitScript(() => {
  const w = window as unknown as { __tts: { text: string; rate: number; started: boolean; ended: boolean }[] }
  w.__tts = []
  const synth = window.speechSynthesis
  const orig = synth.speak.bind(synth)
  synth.speak = (u: SpeechSynthesisUtterance) => {
    const rec = { text: u.text, rate: u.rate, started: false, ended: false }
    w.__tts.push(rec)
    u.addEventListener('start', () => (rec.started = true))
    u.addEventListener('end', () => (rec.ended = true))
    orig(u)
  }
})
page.on('pageerror', (e) => log('PAGEERR', e.message))

await page.goto(base, { waitUntil: 'networkidle' })
log('voices', await page.evaluate(() => speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ko')).map((v) => v.name)))
await page.getByTestId('call-start').click()
log('통화 시작')

// 1) 실제 TTS로 첫인사 → 자동으로 듣기 → 실제 STT가 마이크의 "서울역이요"를 인식 → 출발지 되읽기
await page.locator('[data-testid="call-phase"]', { hasText: '듣는 중' }).waitFor({ timeout: 40_000 })
log('첫인사 후 자동 듣기 시작')
await page.locator('[data-testid="call-panel"][data-stage="confirmOrigin"]').waitFor({ timeout: 90_000 })
const callerTurns = await page.locator('[data-speaker="caller"]').evaluateAll((els) => els.map((e) => `${e.textContent} [${e.parentElement?.querySelector('p:last-child')?.textContent}]`))
log('STT로 들은 말', callerTurns)
log('TTS 기록', JSON.stringify(await page.evaluate(() => (window as unknown as { __tts: unknown[] }).__tts)))
await page.screenshot({ path: `${out}/v1-stt.png` })

// 2) 자동화 브라우저에서는 음성 인식 서버가 글자를 돌려주지 않아서, 나머지는 글로 진행한다
await page.getByTestId('voice-input').click()
const say = async (t: string, stage: string) => {
  await page.getByTestId('caller-input').fill(t)
  await page.getByTestId('caller-send').click()
  await page.locator(`[data-testid="call-panel"][data-stage="${stage}"]`).waitFor({ timeout: 20_000 })
}
await say('네', 'askDestination')
await say('세브란스 병원', 'chooseDestination')
await say('1번', 'confirmDestination')
await say('네', 'finalApproval')
await page.screenshot({ path: `${out}/v2-approval.png` })
await say('네 불러주세요', 'dispatching')
log('승인 → 호출')
await page.getByTestId('worker-frame').waitFor({ timeout: 40_000 })
log('Worker 화면 수신', await page.getByTestId('worker-badge').textContent())
await page.waitForTimeout(6000)
await page.screenshot({ path: `${out}/v3-worker.png` })
await page.getByTestId('dispatch-summary').waitFor({ timeout: 60_000 })
const status = await page.getByTestId('dispatch-summary').getAttribute('data-status')
log('배차 결과', status, (await page.getByTestId('dispatch-summary').innerText()).replace(/\n/g, ' '))
await page.waitForFunction(() => (window as unknown as { __tts: { text: string; ended: boolean }[] }).__tts.some((r) => /차 번호는|빈 택시/.test(r.text) && r.ended), null, { timeout: 60_000 })
await page.screenshot({ path: `${out}/v4-done.png` })
log('Worker 단계', (await page.getByTestId('worker-steps').innerText()).split('\n').length)

const tts = await page.evaluate(() => (window as unknown as { __tts: unknown[] }).__tts)
log('TTS 기록', JSON.stringify(tts, null, 0))
await browser.close()
