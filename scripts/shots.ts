// 디자인·흐름 점검용 스크린샷
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:5173'
const out = process.argv[2] ?? 'shots'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript(() => {
  const w = window as unknown as Record<string, unknown>
  delete w.webkitSpeechRecognition
  delete w.SpeechRecognition
})
await p.goto(base, { waitUntil: 'networkidle' })
await p.screenshot({ path: `${out}/a-first.png` })
await p.getByTestId('call-start').click()
const say = async (t: string) => {
  await p.getByTestId('caller-input').fill(t)
  await p.getByTestId('caller-send').click()
  await p.waitForTimeout(400)
}
for (const t of ['네', '서울역이요', '네', '세브란스 병원이요']) await say(t)
await p.screenshot({ path: `${out}/b-candidates.png` })
for (const t of ['2번이요', '네']) await say(t)
await p.screenshot({ path: `${out}/c-approval.png` })
await say('네, 불러주세요')
await p.waitForTimeout(5000)
await p.screenshot({ path: `${out}/d-worker.png` })
await p.locator('[data-testid="dispatch-summary"]').waitFor({ timeout: 40000 })
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/e-done.png` })
const m = await b.newPage({ viewport: { width: 390, height: 844 } })
await m.goto(base, { waitUntil: 'networkidle' })
await m.screenshot({ path: `${out}/f-mobile.png`, fullPage: false })
console.log('mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth))
await b.close()
