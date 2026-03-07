import http from 'node:http'
import https from 'node:https'
import httpProxy from 'http-proxy'
import type { ProxyOptions } from '../types.js'

interface ProxyInstance {
  httpServer: http.Server
  httpsServer?: https.Server
  proxy: httpProxy
  stop: () => Promise<void>
}

export function startProxy(options: ProxyOptions): Promise<ProxyInstance> {
  return new Promise((resolve, reject) => {
    const { targetPort, domain, cert, key } = options

    const proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${targetPort}`,
      ws: true,
      changeOrigin: true,
    })

    proxy.on('error', (err, _req, res) => {
      if (res && 'writeHead' in res) {
        ;(res as http.ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' })
        ;(res as http.ServerResponse).end('betterport: waiting for dev server...')
      }
    })

    const httpServer = http.createServer((req, res) => {
      if (cert && key) {
        // Redirect HTTP to HTTPS
        const location = `https://${domain}${req.url || '/'}`
        res.writeHead(301, { Location: location })
        res.end()
      } else {
        proxy.web(req, res)
      }
    })

    httpServer.on('upgrade', (req, socket, head) => {
      if (!cert || !key) {
        proxy.ws(req, socket, head)
      }
    })

    let httpsServer: https.Server | undefined

    if (cert && key) {
      httpsServer = https.createServer({ cert, key }, (req, res) => {
        proxy.web(req, res)
      })

      httpsServer.on('upgrade', (req, socket, head) => {
        proxy.ws(req, socket, head)
      })
    }

    const stop = (): Promise<void> => {
      return new Promise<void>((res) => {
        proxy.close()
        httpServer.close(() => {
          if (httpsServer) {
            httpsServer.close(() => res())
          } else {
            res()
          }
        })
      })
    }

    httpServer.listen(80, '127.0.0.1', () => {
      if (httpsServer) {
        httpsServer.listen(443, '127.0.0.1', () => {
          resolve({ httpServer, httpsServer, proxy, stop })
        })
        httpsServer.on('error', reject)
      } else {
        resolve({ httpServer, proxy, stop })
      }
    })

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EACCES') {
        reject(new Error(
          'Port 80/443 requires elevated privileges. Run with sudo or use simple mode (without --clean).'
        ))
      } else {
        reject(err)
      }
    })
  })
}
