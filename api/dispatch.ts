// Vercel Function: /api/dispatch — Mock 배차. 실제 택시를 부르지 않는다.
//   POST                 호출 접수 (승인 필수)
//   GET ?requestId=      진행 상태 (배차 대기 → 기사 배정)
//   POST ?action=cancel  호출 취소
import { createHmac } from 'node:crypto'
import { createDispatchService } from '../server/dispatch-core.js'

const secret = process.env.DISPATCH_SECRET ?? 'poc-mock-dispatch'
const service = createDispatchService({
  disabled: process.env.DISPATCH_DISABLED === '1',
  sign: (data) => createHmac('sha256', secret).update(data).digest('base64url').slice(0, 22),
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const text = await request.text()
  if (text.length > 2_000) return json(413, { error: 'too_large', message: '요청이 너무 커요.' })
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'invalid_json', message: '요청 형식이 맞지 않아요.' })
  }
  const reply = url.searchParams.get('action') === 'cancel' ? service.cancel(body) : service.create(body, ip)
  // 개인정보 최소화: 장소·세션·IP는 남기지 않고 결과 종류만 남긴다.
  console.log(JSON.stringify({ event: 'dispatch', action: url.searchParams.get('action') ?? 'create', status: reply.status, result: reply.body.status ?? reply.body.error }))
  return json(reply.status, reply.body)
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('requestId')
  if (!id) return json(200, { ok: true, mock: true, disabled: process.env.DISPATCH_DISABLED === '1' })
  const reply = service.status(id)
  return json(reply.status, reply.body)
}
