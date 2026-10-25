// 디자인 점검용 전체 페이지 스크린샷
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:5173'
const out = process.argv[2] ?? 'shots'
const browser = await chromium.launch()
for (const [name, vp] of [['desktop', { width: 1280, height: 860 }], ['mobile', { width: 375, height: 812 }]] as const) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 })
  await page.goto(base + (process.env.PATH_ ?? '/'), { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(name, 'overflow px:', overflow)
  await page.close()
}
await browser.close()
