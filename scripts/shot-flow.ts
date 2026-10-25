import { chromium } from '@playwright/test'
const out = process.argv[2]
const b = await chromium.launch()
for (const [n, vp] of [['d', { width: 1280, height: 900 }], ['m', { width: 375, height: 812 }]] as const) {
  const p = await b.newPage({ viewport: vp })
  await p.goto('http://localhost:5173/#try')
  await p.getByTestId('try-start').click()
  for (const t of ['네', '서울역이요', '네', '세브란스병원', '네']) {
    await p.getByTestId('try-input').fill(t)
    await p.getByTestId('try-send').click()
  }
  await p.locator('#try').screenshot({ path: `${out}/${n}-try-approval.png` })
  await p.getByTestId('approve').click()
  await p.waitForTimeout(1500)
  await p.locator('#try').screenshot({ path: `${out}/${n}-try-done.png` })
  await p.goto('http://localhost:5173/')
  await p.getByTestId('cta-demo').click()
  await p.waitForTimeout(9000)
  await p.locator('#demo').screenshot({ path: `${out}/${n}-demo-playing.png` })
  await p.close()
}
await b.close()
