import { createRequire } from 'node:module'
import { findFreePort } from '../core/port-finder.js'
import { detectDomain, parseDomain } from '../core/domain.js'
import { addHost, removeHost, flushDNS } from '../core/hosts.js'
import { startProxy } from '../core/proxy.js'
import { generateCert, isMkcertInstalled, setupMkcert } from '../core/cert.js'
import { hasValetOrHerd } from '../core/detect.js'
import type { VitePluginOptions } from '../types.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json')

export default function devdomainPlugin(options: VitePluginOptions = {}): any {
  const {
    https: useHttps = true,
    clean = true,
    open: autoOpen = true,
  } = options

  let domain: string
  let stopProxy: (() => Promise<void>) | undefined
  let cleanupDone = false
  const valetDetected = hasValetOrHerd()

  const cleanup = async () => {
    if (cleanupDone) return
    cleanupDone = true
    if (stopProxy) await stopProxy()
    if (!valetDetected) {
      await removeHost(domain).catch(() => {})
      flushDNS()
    }
  }

  return {
    name: 'vite-plugin-devdomain',
    enforce: 'pre' as const,

    async config() {
      domain = options.domain
        ? parseDomain(options.domain)
        : detectDomain(process.cwd())

      const port = await findFreePort()

      // Register in hosts (skip if Valet handles .test via dnsmasq)
      if (!valetDetected) {
        await addHost(domain)
        flushDNS()
      }

      // Handle HTTPS (skip mkcert if Herd/Valet handles certs)
      let cert: string | undefined
      let key: string | undefined
      if (useHttps && !valetDetected) {
        if (!isMkcertInstalled()) {
          setupMkcert()
        }
        const certs = generateCert(domain)
        cert = certs.cert
        key = certs.key
      }

      // Start proxy for clean mode
      if (clean) {
        const proxyInstance = await startProxy({ targetPort: port, domain, cert, key, https: useHttps })
        stopProxy = proxyInstance.stop
      }

      const protocol = useHttps ? 'https' : 'http'
      const url = clean
        ? `${protocol}://${domain}`
        : `${protocol}://${domain}:${port}`

      return {
        server: {
          port,
          host: '127.0.0.1',
          strictPort: true,
          ...(useHttps && !clean ? { https: { cert, key } } : {}),
          open: autoOpen ? url : false,
          hmr: clean
            ? { host: domain, protocol: useHttps ? 'wss' : 'ws' }
            : { host: domain },
        },
      }
    },

    configureServer(server: any) {
      const protocol = useHttps ? 'https' : 'http'
      const port = server.config.server.port
      const url = clean
        ? `${protocol}://${domain}`
        : `${protocol}://${domain}:${port}`

      server.printUrls = () => {
        console.log()
        console.log(`  \x1b[1m\x1b[32mdevdomain\x1b[0m \x1b[2mv${version}\x1b[0m`)
        console.log()
        console.log(`  \x1b[2mDomain:\x1b[0m    \x1b[36m${domain}\x1b[0m`)
        console.log(`  \x1b[2mURL:\x1b[0m       \x1b[1m\x1b[4m${url}\x1b[0m`)
        console.log()
      }

      // Cleanup on server close
      server.httpServer?.on('close', cleanup)

      // Cleanup on process exit (Ctrl+C, terminal close, kill)
      process.on('SIGINT', async () => { await cleanup(); process.exit(0) })
      process.on('SIGTERM', async () => { await cleanup(); process.exit(0) })
      process.on('SIGHUP', async () => { await cleanup(); process.exit(0) })
      process.on('exit', () => {
        // Synchronous last-resort cleanup — can't await but try anyway
        if (!cleanupDone && stopProxy) {
          cleanupDone = true
          try { stopProxy() } catch {}
        }
      })
    },

    async buildEnd() {
      await cleanup()
    },
  }
}
