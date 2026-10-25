// 공개 URL에서 전체 상담 흐름을 실행하며 녹화와 단계별 스크린샷을 남긴다 (headless).
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const base = process.env.BASE ?? 'https://ai-taxi-114-agent.vercel.app'
const out = process.env.OUT ?? 'C:/dev/showcase'
const t0 = Date.now()
const notes: string[] = []
const log = (s: string) => {
  const line = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`
  notes.push(line)
  console.log(line)
}
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'], recordVideo: { dir: out, size: { width: 1440, height: 900 } } })
const page = await ctx.newPage()
// headless 브라우저는 음성 인식 서버에 접근할 수 없어서 글 입력으로 진행한다
await page.addInitScript(() => {
  const w = window as unknown as Record<string, unknown>
  delete w.webkitSpeechRecognition
  delete w.SpeechRecognition
})
let n = 0
const shot = async (name: string) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` })
const stageIs = (s: string, timeout = 20_000) => page.locator(`[data-testid="call-panel"][data-stage="${s}"]`).waitFor({ timeout })
const say = async (t: string, next: string) => {
  await page.getByTestId('caller-input').fill(t)
  await page.waitForTimeout(500)
  await page.getByTestId('caller-send').click()
  await stageIs(next)
  log(`고객: "${t}" → 단계 ${next} · AI: "${(await page.locator('[data-speaker="agent"]').last().textContent())?.trim()}"`)
  await page.waitForTimeout(900)
}

await page.goto(base, { waitUntil: 'networkidle' })
await shot('첫화면')
await page.getByTestId('call-start').click()
await stageIs('soundCheck')
log('통화 시작 · AI: 첫인사와 소리 확인')
await page.waitForTimeout(1200)
await shot('소리확인')
await say('네, 잘 들려요', 'askOrigin')
await say('서울역이요', 'confirmOrigin')
await shot('출발지되읽기')
await say('네', 'askDestination')
await say('세브란스 병원이요', 'chooseDestination')
await shot('후보제시')
await say('2번이요', 'confirmDestination')
await say('네', 'finalApproval')
await shot('최종확인')
await say('아니 김포공항으로 가 주세요', 'confirmDestination')
await say('네', 'finalApproval')
await shot('목적지수정후확인')
log(`승인 전 작업 지시서: ${(await page.getByTestId('work-order').innerText()).replace(/\n/g, ' ')}`)
await say('네, 불러주세요', 'dispatching')
await page.getByTestId('worker-frame').waitFor({ timeout: 40_000 })
log(`오른쪽 패널: ${await page.getByTestId('worker-badge').textContent()}`)
await page.waitForTimeout(3500)
await shot('Worker검색입력')
await page.getByTestId('worker-steps').getByText('택시 호출 버튼 클릭').waitFor({ timeout: 40_000 })
await page.waitForTimeout(1200)
await shot('Worker호출클릭')
await page.getByTestId('dispatch-summary').waitFor({ timeout: 60_000 })
const status = await page.getByTestId('dispatch-summary').getAttribute('data-status')
log(`배차 결과(${status}): ${(await page.getByTestId('dispatch-summary').innerText()).replace(/\n/g, ' ')}`)
await page.waitForTimeout(2500)
await shot('배차결과안내')
const steps1 = await page.getByTestId('worker-steps').innerText()
let steps2 = ''
if (status === 'assigned') {
  await say('아니요', 'closing')
  await say('취소해 주세요', 'cancelling')
  await page.getByTestId('worker-steps').getByText('취소 확인').waitFor({ timeout: 40_000 })
  await page.waitForTimeout(800)
  await shot('Worker취소')
  await stageIs('cancelled', 40_000)
  log(`취소 후 AI: "${(await page.locator('[data-speaker="agent"]').nth(-2).textContent())?.trim()} ${(await page.locator('[data-speaker="agent"]').last().textContent())?.trim()}"`)
  steps2 = await page.getByTestId('worker-steps').innerText()
  await page.waitForTimeout(1500)
  await shot('취소완료')
}
const transcript = await page.locator('[data-speaker]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-speaker') === 'agent' ? 'AI ' : '고객'}: ${e.textContent}`))

// 자동 시연
await page.getByTestId('mode-demo').click()
await page.getByTestId('demo-start').click()
await page.getByTestId('worker-badge').getByText('녹화').waitFor({ timeout: 60_000 })
await page.waitForTimeout(4000)
await shot('자동시연녹화')
log('자동 시연: 녹화 재생 확인')
await ctx.close()
await browser.close()
await writeFile(`${out}/log.txt`, [...notes, '', '--- 대화 전체 ---', ...transcript, '', '--- Worker 호출 단계 ---', steps1, '', '--- Worker 취소 단계 ---', steps2].join('\n'))
