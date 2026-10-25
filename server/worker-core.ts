// Playwright Worker: AI가 확정한 호출 작업을 받아 택시 호출 콘솔(Mock)을 실제 브라우저로 조작한다.
// 로컬 녹화 스크립트와 서버 실시간 실행(api/worker.ts)이 이 코드를 같이 쓴다.
import type { Browser, BrowserContext, Page } from 'playwright-core'

export interface Job {
  action: 'dispatch' | 'cancel'
  originId?: string
  destinationId?: string
  approved: boolean
  requestId?: string
}

export type WorkerEvent =
  | { type: 'step'; t: number; action: string; detail?: string }
  | { type: 'frame'; t: number; data: string }
  | { type: 'result'; t: number; status: 'assigned' | 'no_taxi' | 'cancelled' | 'failed'; requestId?: string; plate?: string; etaMinutes?: number; color?: string; model?: string; driverName?: string; attempts: number }
  | { type: 'error'; t: number; code: string; message: string }

export class WorkerRefusal extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export interface RunOptions {
  baseUrl: string
  allowedHosts: string[]
  launch: () => Promise<Browser>
  onEvent: (e: WorkerEvent) => void
  /** 실행 화면을 JPEG 프레임으로 보낸다 */
  screencast?: boolean
  recordVideoDir?: string
  injectFailure?: boolean
  /** 사람이 따라볼 수 있게 동작 사이에 두는 간격(ms) */
  pace?: number
  timeoutMs?: number
}

// 정적 글꼴만 예외로 허용한다.
const ASSET_HOSTS = ['cdn.jsdelivr.net']
const MAX_ATTEMPTS = 2

let running = 0
export const MAX_CONCURRENT = 1
export const isBusy = () => running >= MAX_CONCURRENT

export function validateJob(job: Job, opts: Pick<RunOptions, 'baseUrl' | 'allowedHosts'>) {
  if (job.approved !== true) throw new WorkerRefusal('approval_required', '고객 최종 승인이 없는 작업은 실행하지 않아요.')
  const host = new URL(opts.baseUrl).hostname
  if (!opts.allowedHosts.includes(host)) throw new WorkerRefusal('host_not_allowed', `허용하지 않은 주소예요: ${host}`)
  if (job.action === 'dispatch' && (!job.originId || !job.destinationId)) throw new WorkerRefusal('invalid_job', '출발지와 목적지가 필요해요.')
  if (job.action === 'cancel' && !job.requestId) throw new WorkerRefusal('invalid_job', '취소할 호출 ID가 필요해요.')
}

export async function runJob(job: Job, opts: RunOptions): Promise<WorkerEvent & { type: 'result' }> {
  validateJob(job, opts)
  if (isBusy()) throw new WorkerRefusal('busy', '다른 작업을 처리하고 있어요. 동시에 1개만 실행해요.')
  running++
  const started = Date.now()
  const t = () => Date.now() - started
  const step = (action: string, detail?: string) => opts.onEvent({ type: 'step', t: t(), action, detail })
  const pace = opts.pace ?? 350
  const wait = (ms = pace) => new Promise((r) => setTimeout(r, ms))
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  const deadline = setTimeout(() => void context?.close().catch(() => {}), opts.timeoutMs ?? 45_000)

  try {
    step('브라우저 실행', 'Chromium')
    browser = await opts.launch()
    context = await browser.newContext({
      viewport: { width: 1100, height: 700 },
      deviceScaleFactor: 1,
      locale: 'ko-KR',
      ...(opts.recordVideoDir ? { recordVideo: { dir: opts.recordVideoDir, size: { width: 1100, height: 700 } } } : {}),
    })
    const allowed = new Set([...opts.allowedHosts, ...ASSET_HOSTS])
    await context.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname
      if (allowed.has(host)) return route.continue()
      step('차단', `허용 목록 밖 요청: ${host}`)
      return route.abort()
    })
    const page = await context.newPage()

    if (opts.screencast) {
      const cdp = await context.newCDPSession(page)
      cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
        opts.onEvent({ type: 'frame', t: t(), data: f.data })
        void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
      })
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1100, maxHeight: 700, everyNthFrame: 2 })
    }

    const url = new URL('/console', opts.baseUrl)
    url.searchParams.set('by', 'worker')
    if (job.action === 'cancel') url.searchParams.set('request', job.requestId!)
    if (opts.injectFailure) url.searchParams.set('fail', 'once')
    await page.goto(url.toString(), { waitUntil: 'networkidle' })
    step('호출 콘솔 열기', url.pathname)
    await wait()

    if (job.action === 'cancel') return await cancelFlow(page, step, wait, t)
    return await dispatchFlow(page, job, step, wait, t)
  } catch (e) {
    if (e instanceof WorkerRefusal) throw e
    step('실패', (e as Error).message.split('\n')[0])
    return { type: 'result', t: t(), status: 'failed', attempts: 0 }
  } finally {
    clearTimeout(deadline)
    await context?.close().catch(() => {})
    await browser?.close().catch(() => {})
    running--
  }
}

type Step = (action: string, detail?: string) => void

async function choosePlace(page: Page, kind: 'origin' | 'destination', placeId: string, name: string, step: Step, wait: (ms?: number) => Promise<unknown>) {
  const label = kind === 'origin' ? '출발지' : '목적지'
  const input = page.getByTestId(`console-${kind}-input`)
  await input.click()
  await input.pressSequentially(name, { delay: 90 })
  step(`${label} 검색`, name)
  const option = page.getByTestId(`suggest-${kind}-${placeId}`)
  await option.waitFor({ timeout: 5000 })
  await wait()
  await option.click()
  step(`${label} 선택`, name)
  await wait()
  await page.getByTestId(`console-${kind}-confirm`).click()
  await page.getByTestId(`console-${kind}-confirmed`).waitFor({ timeout: 3000 })
  step(`${label} 위치 확인`)
  await wait()
}

async function dispatchFlow(page: Page, job: Job, step: Step, wait: (ms?: number) => Promise<unknown>, t: () => number) {
  const { PLACES } = await import('../src/features/dialog/places.js')
  const o = PLACES.find((p) => p.id === job.originId)
  const d = PLACES.find((p) => p.id === job.destinationId)
  if (!o || !d) throw new WorkerRefusal('unknown_place', '목록에 없는 장소예요.')

  await choosePlace(page, 'origin', o.id, o.name, step, wait)
  await choosePlace(page, 'destination', d.id, d.name, step, wait)
  await page.getByTestId('console-approved').check()
  step('고객 최종 승인 체크', '대화에서 승인 받음')
  await wait()

  let attempts = 0
  while (attempts < MAX_ATTEMPTS) {
    attempts++
    await page.getByTestId('console-submit').click()
    step('택시 호출 버튼 클릭', `${attempts}번째 시도`)
    const outcome = await Promise.race([
      page.locator('[data-testid="console-status"][data-status="searching"]').waitFor({ timeout: 8000 }).then(() => 'searching' as const),
      page.getByTestId('console-error').waitFor({ timeout: 8000 }).then(() => 'error' as const),
    ])
    if (outcome === 'error') {
      step('오류 감지', (await page.getByTestId('console-error').textContent())?.trim())
      if (attempts < MAX_ATTEMPTS) {
        step('복구', '1초 기다린 뒤 다시 시도')
        await wait(1000)
      }
      continue
    }
    step('배차 대기', '주변 택시에 호출 중')
    const final = await Promise.race([
      page.getByTestId('console-result').waitFor({ timeout: 20_000 }).then(() => 'assigned' as const),
      page.locator('[data-testid="console-status"][data-status="no_taxi"]').waitFor({ timeout: 20_000 }).then(() => 'no_taxi' as const),
    ])
    if (final === 'no_taxi') {
      step('결과 읽기', '빈 차 없음')
      return { type: 'result' as const, t: t(), status: 'no_taxi' as const, attempts }
    }
    const read = async (id: string) => (await page.getByTestId(id).textContent())?.trim() ?? ''
    const plate = await read('console-plate')
    const eta = Number((await read('console-eta')).replace(/[^0-9]/g, ''))
    const driverName = await read('console-driver')
    const [color, ...modelParts] = (await read('console-car')).split(' ')
    const requestId = await page.evaluate(() => (window as unknown as { __lastRequestId?: string }).__lastRequestId)
    step('결과 읽기', `기사 ${driverName} · ${plate} · ${eta}분`)
    await wait(900)
    return { type: 'result' as const, t: t(), status: 'assigned' as const, requestId, plate, etaMinutes: eta, color, model: modelParts.join(' '), driverName, attempts }
  }
  step('실패', '최대 시도 횟수를 넘어서 상담원에게 넘김')
  return { type: 'result' as const, t: t(), status: 'failed' as const, attempts }
}

async function cancelFlow(page: Page, step: Step, wait: (ms?: number) => Promise<unknown>, t: () => number) {
  await page.getByTestId('console-cancel').waitFor({ timeout: 8000 })
  step('배정된 호출 확인')
  await wait()
  await page.getByTestId('console-cancel').click()
  step('호출 취소 버튼 클릭')
  await wait()
  await page.getByTestId('console-cancel-confirm').click()
  step('취소 확인')
  await page.getByTestId('console-cancelled').waitFor({ timeout: 8000 })
  step('결과 읽기', '취소 완료')
  await wait(700)
  return { type: 'result' as const, t: t(), status: 'cancelled' as const, attempts: 1 }
}
