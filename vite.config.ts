import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 로컬 개발·Playwright 테스트에서 Vercel Function과 같은 핸들러를 쓴다.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/dispatch', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/dispatch.ts')
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const request = new Request('http://localhost/api/dispatch', {
          method: req.method,
          headers: { 'x-forwarded-for': req.socket.remoteAddress ?? 'local' },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        })
        const handler = req.method === 'POST' ? mod.POST : mod.GET
        const response: Response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({ plugins: [react(), tailwindcss(), localApi()] })
