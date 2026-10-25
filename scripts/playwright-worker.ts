// Playwright Worker: AI가 확정한 호출 작업을 받아 상담원 업무 웹(Mock Console)을 조작한다.
// 실행: npm run record:worker  (로컬 개발 서버가 떠 있어야 한다)
import { chromium, type Page } from '@playwright/test'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Job {
  origin: string
  destination: string
  approved: boolean
}

export interface RunStep {
  t: number
  action: string
  detail?: string
}

export interface RunResult {
  status: 'assigned' | 'no_taxi' | 'failed'
  plate?: string
  attempts: number
  steps: RunStep[]
  durationMs: number
}

// 업무 웹 주소 허용 목록. 다른 곳으로는 이동하지 않는다.
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1'])
// 정적 글꼴만 예외로 허용한다.
const ALLOWED_ASSET_HOSTS = new Set(['cdn.jsdelivr.net'])
const MAX_ATTEMPTS = 2
const JOB_TIMEOUT_MS = 30_000

let running = 0
const MAX_CONCURRENT = 1

export class WorkerRefusal extends Error {}

export async function runJob(
  job: Job,
  opts: { baseUrl: string; videoDir?: string; injectFailure?: boolean; headless?: boolean; slowMo?: number },
): Promise<RunResult> {
  if (job.approved !== true) throw new WorkerRefusal('approval_required: 고객 최종 승인이 없는 작업은 실행하지 않아요.')
  const url = new URL('/console', opts.baseUrl)
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new WorkerRefusal(`host_not_allowed: ${url.hostname}`)
  if (running >= MAX_CONCURRENT) throw new WorkerRefusal('busy: 동시에 1개 작업만 실행해요.')
  if (opts.injectFailure) url.searchParams.set('fail', 'once')

  running++
  const started = Date.now()
  const steps: RunStep[] = []
  const log = (action: string, detail?: string) => steps.push({ t: Date.now() - started, action, detail })
  const browser = await chromium.launch({ headless: opts.headless ?? true, slowMo: opts.slowMo })
  const context = await browser.newContext({
    viewport: { width: 1100, height: 720 },
    ...(opts.videoDir ? { recordVideo: { dir: opts.videoDir, size: { width: 1100, height: 720 } } } : {}),
  })
  const timer = setTimeout(() => void context.close(), JOB_TIMEOUT_MS)
  try {
    await context.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname
      if (ALLOWED_HOSTS.has(host) || ALLOWED_ASSET_HOSTS.has(host)) return route.continue()
      log('차단', `허용 목록 밖 요청: ${host}`)
      return route.abort()
    })
    const page = await context.newPage()
    log('작업 받음', `${job.origin} → ${job.destination} · 승인 true`)
    await page.goto(url.toString(), { waitUntil: 'networkidle' })
    log('업무 웹 열기', url.pathname + url.search)

    await page.getByTestId('console-origin').selectOption({ label: await optionLabel(page, 'console-origin', job.origin) })
    log('출발지 입력', job.origin)
    await page.getByTestId('console-destination').selectOption({ label: await optionLabel(page, 'console-destination', job.destination) })
    log('목적지 입력', job.destination)
    await page.getByTestId('console-approved').check()
    log('최종 승인 체크')

    let attempts = 0
    while (attempts < MAX_ATTEMPTS) {
      attempts++
      await page.getByTestId('console-submit').click()
      log('호출 버튼 클릭', `${attempts}번째 시도`)
      const outcome = await Promise.race([
        page.getByTestId('console-result').waitFor({ timeout: 10_000 }).then(() => 'result' as const),
        page.getByTestId('console-error').waitFor({ timeout: 10_000 }).then(() => 'error' as const),
      ])
      if (outcome === 'result') {
        const status = (await page.getByTestId('console-result').getAttribute('data-status')) as 'assigned' | 'no_taxi'
        const plate = status === 'assigned' ? (await page.getByTestId('console-plate').textContent())?.trim() : undefined
        log('결과 읽기', status === 'assigned' ? `배차됨 ${plate}` : '빈 차 없음')
        if (opts.videoDir) await page.screenshot({ path: path.join(opts.videoDir, 'poster.png') })
        await page.waitForTimeout(1500)
        return { status, plate, attempts, steps, durationMs: Date.now() - started }
      }
      const message = (await page.getByTestId('console-error').textContent())?.trim()
      log('오류 감지', message)
      if (attempts < MAX_ATTEMPTS) {
        log('복구', '1초 기다린 뒤 다시 시도')
        await page.waitForTimeout(1000)
      }
    }
    log('실패', '최대 시도 횟수를 넘어서 상담원에게 넘김')
    return { status: 'failed', attempts, steps, durationMs: Date.now() - started }
  } finally {
    clearTimeout(timer)
    await context.close().catch(() => {})
    await browser.close()
    running--
  }
}

async function optionLabel(page: Page, testId: string, name: string): Promise<string> {
  const labels = await page.getByTestId(testId).locator('option').allTextContents()
  const hit = labels.find((l) => l.startsWith(`${name} (`))
  if (!hit) throw new WorkerRefusal(`unknown_place: ${name}`)
  return hit
}

// 직접 실행하면 증빙 녹화를 남긴다.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseUrl = process.env.WORKER_BASE_URL ?? 'http://localhost:5173'
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const evidence = path.join(root, 'public', 'evidence')
  const tmp = path.join(evidence, '.tmp-video')
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })
  const job: Job = { origin: '서울역', destination: '세브란스병원', approved: true }

  // 1) 승인 없는 작업은 거절되는지 먼저 확인한다.
  try {
    await runJob({ ...job, approved: false }, { baseUrl })
    throw new Error('승인 없는 작업이 실행됐어요')
  } catch (e) {
    if (!(e instanceof WorkerRefusal)) throw e
    console.log('미승인 작업 거절 확인:', e.message)
  }

  // 2) 실제 실행 + 녹화. 첫 호출에 일시 오류를 넣어 복구 과정을 남긴다.
  const result = await runJob(job, { baseUrl, videoDir: tmp, injectFailure: true, slowMo: 250 })
  const [video] = (await readdir(tmp)).filter((f) => f.endsWith('.webm'))
  await rename(path.join(tmp, video), path.join(evidence, 'playwright-run.webm'))
  await rename(path.join(tmp, 'poster.png'), path.join(evidence, 'playwright-run.png'))
  await rm(tmp, { recursive: true, force: true })
  const record = {
    recordedAt: new Date().toISOString(),
    environment: `로컬 개발 서버 (${process.platform}, Playwright ${(await import('@playwright/test/package.json', { with: { type: 'json' } })).default.version})`,
    baseUrl,
    job,
    steps: result.steps,
    result: { status: result.status, plate: result.plate, attempts: result.attempts },
    durationMs: result.durationMs,
    video: '/evidence/playwright-run.webm',
    poster: '/evidence/playwright-run.png',
  }
  await writeFile(path.join(evidence, 'playwright-run.json'), JSON.stringify(record, null, 2) + '\n')
  console.log(JSON.stringify(record.result), `${result.durationMs}ms`)
}
