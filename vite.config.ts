import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 로컬 개발·Playwright 테스트에서 Vercel Function과 같은 핸들러(api/*.ts)를 쓴다.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/(dispatch|worker)(\?.*)?$/)
        if (!m) return next()
        const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: { 'x-forwarded-for': req.socket.remoteAddress ?? 'local', host: req.headers.host ?? 'localhost' },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        })
        const handler = req.method === 'POST' ? mod.POST : mod.GET
        const response: Response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        if (!response.body) return res.end()
        const reader = response.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
  server: { watch: { ignored: ['**/test-results/**'] } },
})
