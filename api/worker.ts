// Vercel Function: POST /api/worker — Playwright Worker를 서버 Chromium으로 실시간 실행한다.
// 응답은 NDJSON 스트림이다: 단계(step), 화면(frame), 결과(result), 오류(error).
// 공개 페이지에는 브라우저를 직접 노출하지 않고, 실행 화면을 이미지로만 보낸다.
import { runJob, isBusy, validateJob, WorkerRefusal, type Job, type WorkerEvent } from '../server/worker-core.js'


const RATE_MAX = Number(process.env.WORKER_RATE_MAX ?? 8)
const WINDOW_MS = 10 * 60_000
const hits = new Map<string, number[]>()

function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  const over = recent.length >= RATE_MAX
  if (!over) recent.push(now)
  hits.set(ip, recent)
  return over
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

/** 이 배포의 자기 주소만 허용한다. */
function selfHosts(): string[] {
  return [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, 'localhost', '127.0.0.1']
    .filter(Boolean)
    .map((h) => String(h).replace(/^https?:\/\//, '').split(':')[0])
}

async function launch() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: pw } = await import('playwright-core')
    return pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true })
  }
  const { chromium: pw } = await import('playwright-core')
  return pw.launch({ headless: true })
}

export async function GET() {
  return json(200, { ok: !process.env.WORKER_DISABLED, busy: isBusy(), runtime: process.env.VERCEL ? 'vercel' : 'local' })
}

export async function POST(request: Request) {
  if (process.env.WORKER_DISABLED === '1') return json(503, { error: 'disabled', message: '실시간 Worker를 잠시 멈췄어요.', fallback: 'recording' })
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  let body: Partial<Job> = {}
  try {
    body = JSON.parse((await request.text()).slice(0, 2000))
  } catch {
    return json(400, { error: 'invalid_json', message: '요청 형식이 맞지 않아요.' })
  }
  const job: Job = {
    action: body.action === 'cancel' ? 'cancel' : 'dispatch',
    originId: typeof body.originId === 'string' ? body.originId : undefined,
    destinationId: typeof body.destinationId === 'string' ? body.destinationId : undefined,
    requestId: typeof body.requestId === 'string' ? body.requestId.slice(0, 400) : undefined,
    approved: body.approved === true,
  }

  const origin = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? origin.host
  const proto = request.headers.get('x-forwarded-proto') ?? origin.protocol.replace(':', '')
  const baseUrl = `${proto}://${host}`
  const allowedHosts = selfHosts()
  try {
    validateJob(job, { baseUrl, allowedHosts })
  } catch (e) {
    const err = e as WorkerRefusal
    return json(err.code === 'approval_required' ? 403 : 400, { error: err.code, message: err.message })
  }
  if (isBusy()) return json(429, { error: 'busy', message: '다른 방문자의 호출을 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.', fallback: 'recording' })
  if (limited(ip)) return json(429, { error: 'rate_limited', message: '실시간 실행 횟수를 넘었어요. 10분 뒤 다시 시도해 주세요.', fallback: 'recording' })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: WorkerEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
        } catch {
          /* 방문자가 연결을 끊었다 */
        }
      }
      try {
        const result = await runJob(job, { baseUrl, allowedHosts, launch, onEvent: send, screencast: true, pace: 320, timeoutMs: 50_000 })
        send(result)
        console.log(JSON.stringify({ event: 'worker', action: job.action, status: result.status, ms: result.t }))
      } catch (e) {
        const err = e as WorkerRefusal
        send({ type: 'error', t: 0, code: err.code ?? 'failed', message: err.message })
        console.log(JSON.stringify({ event: 'worker', action: job.action, error: err.code ?? 'failed' }))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } })
}
