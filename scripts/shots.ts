// 공개 첫 페이지 점검용 스크린샷 (headless)
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'https://ai-taxi-114-agent.vercel.app'
const out = process.argv[2] ?? '.'
const b = await chromium.launch()
for (const [name, vp] of [['desktop', { width: 1280, height: 860 }], ['mobile', { width: 390, height: 844 }]] as const) {
  const p = await b.newPage({ viewport: vp })
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.screenshot({ path: `${out}/home-${name}.png`, fullPage: true })
  console.log(name, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))
}
await b.close()
