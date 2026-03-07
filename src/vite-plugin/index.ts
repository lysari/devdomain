import type { Plugin, ViteDevServer } from 'vite'
import { findFreePort } from '../core/port-finder.js'
import { detectDomain, parseDomain } from '../core/domain.js'
import { addHost, removeHost, flushDNS } from '../core/hosts.js'
import { startProxy } from '../core/proxy.js'
import { generateCert, isMkcertInstalled, setupMkcert } from '../core/cert.js'
import type { VitePluginOptions } from '../types.js'

export default function betterportPlugin(options: VitePluginOptions = {}): Plugin {
  const {
    https: useHttps = false,
    clean = false,
    open: autoOpen = false,
  } = options

  let domain: string
  let stopProxy: (() => Promise<void>) | undefined
  let cleanupDone = false

  const cleanup = async () => {
    if (cleanupDone) return
    cleanupDone = true
    if (stopProxy) await stopProxy()
    await removeHost(domain).catch(() => {})
    flushDNS()
  }

  return {
    name: 'vite-plugin-betterport',
    enforce: 'pre',

    async config() {
      domain = options.domain
        ? parseDomain(options.domain)
        : detectDomain(process.cwd())

      const port = await findFreePort()

      // Register in hosts
      await addHost(domain)
      flushDNS()

      // Handle HTTPS
      let cert: string | undefined
      let key: string | undefined
      if (useHttps) {
        if (!isMkcertInstalled()) {
          setupMkcert()
        }
        const certs = generateCert(domain)
        cert = certs.cert
        key = certs.key
      }

      // Start proxy for clean mode
      if (clean) {
        const proxyInstance = await startProxy({ targetPort: port, domain, cert, key })
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

    configureServer(server: ViteDevServer) {
      const protocol = useHttps ? 'https' : 'http'
      const port = server.config.server.port
      const url = clean
        ? `${protocol}://${domain}`
        : `${protocol}://${domain}:${port}`

      server.printUrls = () => {
        console.log()
        console.log(`  \x1b[1m\x1b[32mbetterport\x1b[0m`)
        console.log(`  \x1b[2mDomain:\x1b[0m  \x1b[36m${domain}\x1b[0m`)
        console.log(`  \x1b[2mURL:\x1b[0m     \x1b[1m\x1b[4m${url}\x1b[0m`)
        console.log()
      }

      // Cleanup on server close
      server.httpServer?.on('close', cleanup)
    },

    async buildEnd() {
      await cleanup()
    },
  }
}
