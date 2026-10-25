import { expect, test, type Page } from '@playwright/test'

const isLocal = !process.env.E2E_BASE_URL

async function say(page: Page, text: string) {
  await page.getByTestId('try-input').fill(text)
  await page.getByTestId('try-send').click()
}

async function toApproval(page: Page) {
  await page.getByTestId('try-start').click()
  await say(page, '네')
  await say(page, '서울역이요')
  await say(page, '네')
  await say(page, '세브란스병원')
  await say(page, '네')
  await expect(page.getByTestId('approval-box')).toBeVisible()
}

test('처음 방문자가 문제·대상·Mock 범위·체험 위치를 본다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('poc-banner')).toContainText('공식 서비스가 아니고')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('택시를 불러요')
  for (const cta of ['자동 시연 보기', '직접 체험하기', '기술 구조 보기', '비용 절감 분석 보기']) {
    await expect(page.locator('#top').getByText(cta, { exact: true })).toBeVisible()
  }
  await expect(page.getByLabel('구현 범위')).toContainText('실제 택시를 부르지 않아요')
})

test('자동 시연: 설정 없이 재생, 일시정지, 처음부터, 단계 이동', async ({ page }) => {
  await page.goto('/')
  const step = page.getByTestId('demo-step')
  await page.getByTestId('cta-demo').click()
  await expect(step).toHaveText('2', { timeout: 15_000 })
  await page.getByRole('button', { name: '일시정지' }).click()
  const paused = await step.textContent()
  await page.waitForTimeout(6000)
  await expect(step).toHaveText(paused!)
  await page.getByTestId('demo-restart').click()
  await expect(step).toHaveText('1')
  await page.getByRole('button', { name: '일시정지' }).click()
  await page.getByRole('button', { name: '다음 단계' }).click()
  await expect(step).toHaveText('2')
  await page.getByRole('button', { name: '7단계 업무 웹 자동 입력' }).click()
  await expect(step).toHaveText('7')
  await expect(page.getByTestId('demo-player')).toContainText('합성 재현')
})

test('직접 체험: 글로 입력해 확인 → 승인 → Mock 배차 → 결과 안내', async ({ page }) => {
  let calls = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/dispatch') && r.method() === 'POST') calls++
  })
  await page.goto('/#try')
  await toApproval(page)
  await expect(page.getByTestId('try-approved')).toHaveText('아직 안 함')
  expect(calls).toBe(0)
  await page.getByTestId('approve').click()
  await expect(page.getByTestId('try-panel')).toContainText(/택시가 잡혔어요|빈 택시가 없어요/, { timeout: 15_000 })
  await expect(page.getByTestId('try-approved')).toHaveText('승인함')
  expect(calls).toBe(1)
})

test('승인하지 않으면 배차 요청을 보내지 않는다', async ({ page }) => {
  let calls = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/dispatch')) calls++
  })
  await page.goto('/#try')
  await toApproval(page)
  await page.getByTestId('reject').click()
  await expect(page.getByTestId('try-stage')).toHaveText('취소됨')
  await page.waitForTimeout(1000)
  expect(calls).toBe(0)
})

test('승인 후 같은 말을 반복해도 요청은 한 번만 간다', async ({ page }) => {
  let calls = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/dispatch') && r.method() === 'POST') calls++
  })
  await page.route('**/api/dispatch', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await page.goto('/#try')
  await toApproval(page)
  await page.getByTestId('approve').click()
  await say(page, '네')
  await say(page, '네 빨리요')
  await expect(page.getByTestId('try-panel')).toContainText(/택시가 잡혔어요|빈 택시가 없어요/, { timeout: 15_000 })
  expect(calls).toBe(1)
})

test('음성 인식을 지원하지 않아도 글로 계속 체험한다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.webkitSpeechRecognition
    delete w.SpeechRecognition
  })
  await page.goto('/#try')
  await page.getByTestId('try-start').click()
  await expect(page.getByTestId('mic')).toBeDisabled()
  await say(page, '네')
  await say(page, '김포공항')
  await expect(page.getByTestId('try-panel')).toContainText('김포공항에서 타시는 거 맞으세요?')
})

test('마이크 권한이 거부되면 원인과 대체 방법을 안내한다', async ({ page }) => {
  await page.addInitScript(() => {
    class Denied {
      onerror: ((e: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      onresult = null
      start() {
        setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 50)
      }
      abort() {}
    }
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = Denied
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = Denied
  })
  await page.goto('/#try')
  await page.getByTestId('try-start').click()
  await page.getByTestId('mic').click()
  await expect(page.getByTestId('try-notice')).toContainText('마이크 권한이 없어서')
  await say(page, '네')
  await expect(page.getByTestId('try-stage')).toHaveText('출발지 묻는 중')
})

test('배차 서버가 죽어도 브라우저 내 Mock으로 계속하고 출처를 밝힌다', async ({ page }) => {
  await page.route('**/api/dispatch', (route) => route.fulfill({ status: 500, body: '{}' }))
  await page.goto('/#try')
  await toApproval(page)
  await page.getByTestId('approve').click()
  await expect(page.getByTestId('try-notice')).toContainText('브라우저 안의 Mock')
  await expect(page.getByTestId('try-panel')).toContainText('브라우저 내 Mock')
})

test('업무 자동화: 녹화와 실시간을 구분해 보여준다', async ({ page }) => {
  await page.goto('/#automation')
  await expect(page.getByRole('tab', { name: /Playwright 실행/ })).toContainText('녹화')
  await expect(page.getByTestId('evidence-log')).toContainText('오류 감지')
  await expect(page.getByTestId('evidence-log')).toContainText('결과 읽기')
  const video = await page.getByTestId('evidence-video').getAttribute('src')
  const res = await page.request.get(video!)
  expect(res.ok()).toBe(true)
  await page.getByRole('tab', { name: /내 체험 세션/ }).click()
  await expect(page.getByText('아직 체험 통화가 없어요')).toBeVisible()
})

test('ROI: 입력값을 바꾸면 결과가 정확히 갱신된다', async ({ page }) => {
  await page.goto('/#roi')
  await expect(page.getByTestId('roi-baseline')).toHaveText('1,000만 원')
  await expect(page.getByTestId('roi-saving')).toHaveText('310만 원')
  await expect(page.getByTestId('roi-breakeven')).toHaveText('46.2%')
  await page.getByTestId('roi-successRate').fill('90')
  // 1,000만 - (150만 + 1,000건 × 1,300원 + 150만) = 570만
  await expect(page.getByTestId('roi-saving')).toHaveText('570만 원')
  await page.getByTestId('roi-monthlyCalls').fill('20000')
  await expect(page.getByTestId('roi-baseline')).toHaveText('2,000만 원')
})

test('모바일·데스크톱에서 가로 넘침이 없고 주요 글자가 잘리지 않는다', async ({ page }) => {
  for (const path of ['/', '/console']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} 가로 넘침`).toBeLessThanOrEqual(0)
  }
  await page.goto('/')
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,button,a,dt,dd,[data-testid^="roi-"]')]
      .filter((el) => {
        const s = getComputedStyle(el)
        return s.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('truncate')
      })
      .map((el) => el.textContent?.slice(0, 30)),
  )
  expect(clipped).toEqual([])
})

test('API 키와 내부 실행 정보가 공개 번들에 없다', async ({ page }) => {
  await page.goto('/')
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean))
  for (const src of scripts) {
    const body = await (await page.request.get(src)).text()
    expect(body).not.toMatch(/sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|VERCEL_OIDC_TOKEN|VERCEL_TOKEN/)
  }
  const health = await page.request.get('/api/dispatch')
  expect(await health.json()).toEqual({ ok: true, mock: true, disabled: false })
})

test('서버 API는 승인 없는 요청과 목록 밖 장소를 거절한다', async ({ request }) => {
  const base = { sessionId: 'sess-e2e00001', idempotencyKey: `key-${Date.now()}`, originId: 'seoul-station', destinationId: 'severance' }
  expect((await request.post('/api/dispatch', { data: { ...base, approved: false } })).status()).toBe(403)
  expect((await request.post('/api/dispatch', { data: { ...base, approved: true, originId: 'https://example.com' } })).status()).toBe(400)
  const a = await request.post('/api/dispatch', { data: { ...base, approved: true } })
  const b = await request.post('/api/dispatch', { data: { ...base, approved: true } })
  expect(a.status()).toBe(200)
  expect((await b.json()).duplicate).toBe(true)
})

test('업무 웹: 승인 체크 전에는 호출 버튼이 잠겨 있다', async ({ page }) => {
  await page.goto('/console')
  await page.getByTestId('console-origin').selectOption({ index: 1 })
  await page.getByTestId('console-destination').selectOption({ index: 2 })
  await expect(page.getByTestId('console-submit')).toBeDisabled()
  await page.getByTestId('console-approved').check()
  await expect(page.getByTestId('console-submit')).toBeEnabled()
})

test.describe('Playwright Worker', () => {
  test.skip(!isLocal, 'Worker는 로컬 환경에서만 실행해요')
  test('승인 없는 작업은 거절하고, 승인된 작업은 오류를 복구해 배차 결과를 읽는다', async ({ baseURL }, info) => {
    test.skip(info.project.name !== 'desktop', '한 번만 실행')
    const { runJob, WorkerRefusal } = await import('../scripts/playwright-worker')
    await expect(runJob({ origin: '서울역', destination: '세브란스병원', approved: false }, { baseUrl: baseURL! })).rejects.toBeInstanceOf(WorkerRefusal)
    await expect(runJob({ origin: '서울역', destination: '세브란스병원', approved: true }, { baseUrl: 'https://example.com' })).rejects.toThrow('host_not_allowed')
    const r = await runJob({ origin: '김포공항', destination: '서울역', approved: true }, { baseUrl: baseURL!, injectFailure: true })
    expect(['assigned', 'no_taxi']).toContain(r.status)
    expect(r.attempts).toBe(2)
    expect(r.steps.map((s) => s.action)).toContain('복구')
  })
})
