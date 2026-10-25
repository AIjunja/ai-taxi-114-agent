// Vercel Function: POST /api/dispatch — Mock 배차. 실제 택시를 부르지 않는다.
import { createDispatchService } from '../server/dispatch-core'

const service = createDispatchService({ disabled: process.env.DISPATCH_DISABLED === '1' })

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const text = await request.text()
  if (text.length > 2_000) return json(413, { error: 'too_large', message: '요청이 너무 커요.' })
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'invalid_json', message: '요청 형식이 맞지 않아요.' })
  }
  const reply = service.handle(body, ip)
  // 개인정보 최소화: 장소 이름·세션·IP는 남기지 않고 결과 종류만 남긴다.
  console.log(JSON.stringify({ event: 'dispatch', status: reply.status, result: reply.body.status ?? reply.body.error }))
  return json(reply.status, reply.body)
}

export async function GET() {
  return json(200, { ok: true, mock: true, disabled: process.env.DISPATCH_DISABLED === '1' })
}
