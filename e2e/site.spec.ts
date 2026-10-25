import { expect, test, type Page } from '@playwright/test'

const isLocal = !process.env.E2E_BASE_URL

/** 음성 합성을 기록용 대역으로 바꾼다 (읽은 문장·속도·크기를 남긴다). */
async function stubTts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: { text: string; rate: number; volume: number }[] }
    w.__spoken = []
    const synth = window.speechSynthesis
    synth.speak = (u: SpeechSynthesisUtterance) => {
      w.__spoken.push({ text: u.text, rate: u.rate, volume: u.volume })
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 30)
    }
    synth.cancel = () => {}
  })
}

/** 음성 인식을 대역으로 바꾼다. __sttQueue에 넣은 문장을 차례로 '들은 것'으로 돌려준다. */
async function stubStt(page: Page, queue: string[]) {
  await page.addInitScript((q) => {
    const w = window as unknown as Record<string, unknown> & { __sttQueue: string[]; __listens: number }
    w.__sttQueue = q
    w.__listens = 0
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      start() {
        w.__listens++
        const t = w.__sttQueue.shift()
        setTimeout(() => {
          if (t === undefined) {
            this.onerror?.({ error: 'no-speech' })
            this.onend?.()
            return
          }
          const alt = Object.assign([{ transcript: t }], { isFinal: true })
          this.onresult?.({ resultIndex: 0, results: [alt] })
          this.onend?.()
        }, 150)
      }
      stop() {}
      abort() {
        this.onerror?.({ error: 'aborted' })
      }
    }
    w.SpeechRecognition = FakeRecognition
    w.webkitSpeechRecognition = FakeRecognition
  }, queue)
}

async function noStt(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.webkitSpeechRecognition
    delete w.SpeechRecognition
  })
}

async function say(page: Page, text: string) {
  await page.getByTestId('caller-input').fill(text)
  await page.getByTestId('caller-send').click()
}

const stage = (page: Page) => page.getByTestId('call-panel')

function countRequests(page: Page, path: string) {
  const counter = { n: 0 }
  page.on('request', (r) => {
    if (r.url().includes(path) && r.method() === 'POST') counter.n++
  })
  return counter
}

test('첫 화면에서 바로 통화를 시작할 수 있고 PoC임을 밝힌다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('poc-banner')).toContainText('공식 서비스가 아니고')
  await expect(page.getByTestId('call-start')).toBeVisible()
  await expect(page.getByTestId('operator-panel')).toContainText('승인 대기')
})

test('음성 통화: 말하면 알아듣고 대답하고, 승인 전에는 호출하지 않는다', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '서버 Worker 실행 횟수를 아끼려고 데스크톱에서만')
  await stubTts(page)
  await stubStt(page, ['네 잘 들려요', '서울역이요', '네', '세브란스 병원이요', '2번이요', '네'])
  const worker = countRequests(page, '/api/worker')
  await page.goto('/')
  await page.getByTestId('call-start').click()

  // 버튼을 누르지 않아도 TTS가 끝나면 자동으로 듣고, 들은 말로 대화가 진행된다
  await expect(stage(page)).toHaveAttribute('data-stage', 'finalApproval', { timeout: 30_000 })
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { text: string }[] }).__spoken.map((s) => s.text))
  expect(spoken).toContain("제 목소리가 잘 들리시면 '네'라고 말씀해 주세요.")
  expect(spoken).toContain('서울역에서 타시는 거 맞으세요?')
  expect(spoken).toContain('2번, 강남세브란스병원.')
  expect(spoken).toContain('강남세브란스병원으로 가시는 거 맞으세요?')
  await expect(page.getByTestId('work-order')).toContainText('강남세브란스병원')
  await expect(page.getByTestId('work-order')).toContainText('고객 답변 기다리는 중')
  expect(worker.n).toBe(0)

  // 승인 → 서버 Playwright Worker가 콘솔을 조작하고 실제 화면을 보낸다
  await page.evaluate(() => (window as unknown as { __sttQueue: string[] }).__sttQueue.push('네 불러주세요'))
  await page.getByTestId('mic').click()
  await expect(page.getByTestId('worker-badge')).toContainText('실시간', { timeout: 15_000 })
  await expect(page.getByTestId('worker-frame')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('worker-steps')).toContainText('택시 호출 버튼 클릭', { timeout: 40_000 })
  await expect(page.getByTestId('dispatch-summary')).toBeVisible({ timeout: 45_000 })
  const status = await page.getByTestId('dispatch-summary').getAttribute('data-status')
  expect(worker.n).toBe(1)
  if (status === 'assigned') {
    await expect(page.getByTestId('transcript')).toContainText('택시가 잡혔어요.')
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spoken: { text: string }[] }).__spoken.some((s) => /^차 번호는 .+이에요\.$/.test(s.text))))
      .toBe(true)

    // 배차 뒤 취소 → Worker가 콘솔에서 취소 버튼을 누른다
    await say(page, '아니요')
    await say(page, '취소해 주세요')
    await expect(page.getByTestId('worker-steps')).toContainText('호출 취소 버튼 클릭', { timeout: 40_000 })
    await expect(page.getByTestId('transcript')).toContainText('택시 호출을 취소했어요.', { timeout: 40_000 })
    expect(worker.n).toBe(2)
  } else {
    await expect(page.getByTestId('transcript')).toContainText('빈 택시가 없어요')
  }
})

test('다시 듣기와 천천히 말하기: 직전 안내를 느린 속도로 다시 읽는다', async ({ page }) => {
  await stubTts(page)
  await noStt(page)
  await page.goto('/')
  await page.getByTestId('call-start').click()
  await say(page, '네')
  await expect(page.getByTestId('transcript')).toContainText('타실 곳을 알려주세요')
  await page.waitForTimeout(400)
  await page.evaluate(() => ((window as unknown as { __spoken: unknown[] }).__spoken.length = 0))
  await page.getByTestId('replay').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: { text: string; rate: number }[] }).__spoken.map((s) => `${s.text}|${s.rate.toFixed(2)}`))).toEqual([
    expect.stringMatching(/타실 곳을 알려주세요.*\|0\.78$/),
  ])
  await say(page, '천천히 말해 주세요')
  await expect(page.getByTestId('slow')).toHaveAttribute('data-state', 'checked')
})

test('소리가 안 들린다고 하면 크고 천천히 다시 말한다', async ({ page }) => {
  await stubTts(page)
  await noStt(page)
  await page.goto('/')
  await page.getByTestId('call-start').click()
  await say(page, '잘 안 들려요')
  await expect(page.getByTestId('transcript')).toContainText('이제 잘 들리세요?')
  await expect(page.getByTestId('slow')).toHaveAttribute('data-state', 'checked')
})

test('최종 확인에서 아니요 → 바꿀 내용 묻기, 목적지 수정 후 다시 확인, 호출 없음', async ({ page }) => {
  await noStt(page)
  await stubTts(page)
  const worker = countRequests(page, '/api/worker')
  const dispatch = countRequests(page, '/api/dispatch')
  await page.goto('/')
  await page.getByTestId('call-start').click()
  for (const t of ['네', '서울역', '네', '신촌세브란스', '네']) await say(page, t)
  await expect(stage(page)).toHaveAttribute('data-stage', 'finalApproval')
  await say(page, '아니요')
  await expect(stage(page)).toHaveAttribute('data-stage', 'askChange')
  await say(page, '가는 곳')
  await say(page, '김포공항')
  await say(page, '네')
  await expect(stage(page)).toHaveAttribute('data-stage', 'finalApproval')
  await expect(page.getByTestId('work-order')).toContainText('김포공항')
  await say(page, '취소')
  await expect(stage(page)).toHaveAttribute('data-stage', 'cancelled')
  expect(worker.n + dispatch.n).toBe(0)
})

test('마이크 권한이 없으면 원인을 알리고 글로 계속한다', async ({ page }) => {
  await stubTts(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await page.goto('/')
  await page.getByTestId('call-start').click()
  await expect(page.getByTestId('call-notice')).toContainText('마이크 권한이 없어서')
  await say(page, '네')
  await expect(stage(page)).toHaveAttribute('data-stage', 'askOrigin')
})

test('실시간 Worker를 못 쓰면 API로 호출하고 그 사실을 밝힌다', async ({ page }) => {
  await noStt(page)
  await stubTts(page)
  await page.route('**/api/worker', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'busy', message: '다른 방문자의 호출을 처리하고 있어요.' }) }))
  await page.goto('/')
  await page.getByTestId('call-start').click()
  for (const t of ['네', '서울역', '네', '서울아산병원', '네', '네 불러주세요']) await say(page, t)
  await expect(page.getByTestId('fallback-notice')).toContainText('Playwright 브라우저 조작 없이')
  await expect(page.getByTestId('worker-badge')).toContainText('Worker 없이 API 호출')
  await expect(page.getByTestId('dispatch-summary')).toBeVisible({ timeout: 20_000 })
})

test('승인 뒤 같은 말을 반복해도 Worker 실행은 한 번이다', async ({ page }) => {
  await noStt(page)
  await stubTts(page)
  const worker = countRequests(page, '/api/worker')
  await page.route('**/api/worker', async (r) => {
    await new Promise((x) => setTimeout(x, 1500))
    await r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"busy","message":"busy"}' })
  })
  await page.goto('/')
  await page.getByTestId('call-start').click()
  for (const t of ['네', '서울역', '네', '강남역', '네', '네 불러주세요', '네', '빨리요']) await say(page, t)
  await expect(page.getByTestId('dispatch-summary')).toBeVisible({ timeout: 20_000 })
  expect(worker.n).toBe(1)
})

test('자동 시연: 입력 없이 끝까지 진행하고, 녹화임을 표시한다', async ({ page }) => {
  await stubTts(page)
  await page.goto('/')
  await page.getByTestId('mode-demo').click()
  await page.getByTestId('demo-start').click()
  await expect(page.getByTestId('transcript')).toContainText('합성 고객 음성')
  await page.getByTestId('demo-pause').click()
  const before = await page.getByTestId('transcript').textContent()
  await page.waitForTimeout(2500)
  expect(await page.getByTestId('transcript').textContent()).toBe(before)
  await page.getByTestId('demo-pause').click()
  await expect(page.getByTestId('worker-badge')).toContainText('녹화', { timeout: 30_000 })
  await expect(page.getByTestId('worker-video')).toBeVisible()
  await expect(page.getByTestId('transcript')).toContainText('택시가 잡혔어요.', { timeout: 40_000 })
  await expect(page.getByTestId('transcript')).toContainText('조심히 다녀오세요', { timeout: 30_000 })
})

test('호출 콘솔: 검색 → 위치 확인 → 승인 → 호출 → 배정 → 취소', async ({ page }) => {
  await page.goto('/console')
  await expect(page.getByTestId('console-submit')).toBeDisabled()
  await page.getByTestId('console-origin-input').fill('서울')
  await page.getByTestId('suggest-origin-seoul-station').click()
  await page.getByTestId('console-origin-confirm').click()
  await page.getByTestId('console-destination-input').fill('아산')
  await page.getByTestId('suggest-destination-asan').click()
  await page.getByTestId('console-destination-confirm').click()
  await expect(page.getByTestId('console-submit')).toBeDisabled()
  await page.getByTestId('console-approved').check()
  await page.getByTestId('console-submit').click()
  await expect(page.getByTestId('console-status')).toHaveAttribute('data-status', 'searching')
  await expect(page.getByTestId('console-status')).toHaveAttribute('data-status', /assigned|no_taxi/, { timeout: 15_000 })
  if ((await page.getByTestId('console-status').getAttribute('data-status')) === 'assigned') {
    await expect(page.getByTestId('console-plate')).toHaveText(/^\d{2}[가-힣] \d{4}$/)
    await page.getByTestId('console-cancel').click()
    await page.getByTestId('console-cancel-confirm').click()
    await expect(page.getByTestId('console-cancelled')).toBeVisible()
  }
})

test('비용 계산: 입력값을 바꾸면 결과가 정확히 갱신된다', async ({ page }) => {
  await page.goto('/#roi')
  await expect(page.getByTestId('roi-baseline')).toHaveText('1,000만 원')
  await expect(page.getByTestId('roi-saving')).toHaveText('310만 원')
  await expect(page.getByTestId('roi-breakeven')).toHaveText('46.2%')
  await page.getByTestId('roi-successRate').fill('90')
  await expect(page.getByTestId('roi-saving')).toHaveText('570만 원')
  await page.getByTestId('roi-monthlyCalls').fill('20000')
  await expect(page.getByTestId('roi-baseline')).toHaveText('2,000만 원')
})

test('모바일·데스크톱에서 가로 넘침이 없다', async ({ page }) => {
  for (const path of ['/', '/console']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} 가로 넘침`).toBeLessThanOrEqual(0)
  }
})

test('API 키와 내부 정보가 공개 번들에 없다', async ({ page }) => {
  await page.goto('/')
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean))
  for (const src of scripts) {
    const body = await (await page.request.get(src)).text()
    expect(body).not.toMatch(/sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|VERCEL_OIDC_TOKEN|DISPATCH_SECRET/)
  }
})

test('서버 API는 승인 없는 요청을 거절한다', async ({ request }) => {
  const base = { sessionId: 'sess-e2e00001', idempotencyKey: `key-${Date.now()}`, originId: 'seoul-station', destinationId: 'severance' }
  expect((await request.post('/api/dispatch', { data: { ...base, approved: false } })).status()).toBe(403)
  expect((await request.post('/api/dispatch', { data: { ...base, approved: true, originId: 'https://example.com' } })).status()).toBe(400)
  expect((await request.post('/api/worker', { data: { action: 'dispatch', originId: 'seoul-station', destinationId: 'severance', approved: false } })).status()).toBe(403)
  const a = await request.post('/api/dispatch', { data: { ...base, approved: true } })
  const b = await request.post('/api/dispatch', { data: { ...base, approved: true } })
  expect((await a.json()).status).toBe('searching')
  expect((await b.json()).duplicate).toBe(true)
})

test.describe('Worker 단독', () => {
  test.skip(!isLocal, '로컬에서만')
  test('승인 없는 작업과 허용 밖 주소를 거절한다', async ({}, info) => {
    test.skip(info.project.name !== 'desktop', '한 번만')
    const { runJob, WorkerRefusal } = await import('../server/worker-core')
    const launch = () => Promise.reject(new Error('브라우저를 띄우면 안 돼요'))
    await expect(runJob({ action: 'dispatch', originId: 'seoul-station', destinationId: 'severance', approved: false }, { baseUrl: 'http://localhost:5173', allowedHosts: ['localhost'], launch, onEvent: () => {} })).rejects.toBeInstanceOf(WorkerRefusal)
    await expect(runJob({ action: 'dispatch', originId: 'seoul-station', destinationId: 'severance', approved: true }, { baseUrl: 'https://example.com', allowedHosts: ['localhost'], launch, onEvent: () => {} })).rejects.toThrow('허용하지 않은 주소')
  })
})
