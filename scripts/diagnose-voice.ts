// 음성 진단 페이지를 Chrome·Edge에서 실행해 결과를 남긴다.
// 마이크 입력은 미리 만든 한국어 음성 파일로 대신한다(--use-file-for-fake-audio-capture).
//   BASE=... WAV=... npx tsx scripts/diagnose-voice.ts
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const base = process.env.BASE ?? 'https://ai-taxi-114-agent.vercel.app'
const results: Record<string, string> = {}
for (const channel of ['chrome', 'msedge'] as const) {
  for (const headless of [true, false]) {
    if (!headless && !process.env.HEADED) continue
    const browser = await chromium.launch({
      channel,
      headless,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.WAV}`],
    })
    const ctx = await browser.newContext({ permissions: ['microphone'] })
    const page = await ctx.newPage()
    await page.goto(`${base}/diagnostics`)
    await page.getByTestId('diag-run').click()
    await page.locator('[data-testid="diag-tts"]:not([data-status="idle"]):not([data-status="running"])').waitFor({ timeout: 60_000 })
    const text = await page.locator('main').innerText()
    const key = `${channel}${headless ? ' (headless)' : ''}`
    results[key] = text
    console.log(`===== ${key}\n${text}\n`)
    await browser.close()
  }
}
await writeFile(process.env.OUT ?? 'diagnose-voice.json', JSON.stringify({ at: new Date().toISOString(), base, results }, null, 2))
