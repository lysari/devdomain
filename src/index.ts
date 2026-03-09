import { ensureSudo } from './core/sudo.js'
import { findFreePort } from './core/port-finder.js'
import { detectDomain, parseDomain } from './core/domain.js'
import { addHost, removeHost, flushDNS } from './core/hosts.js'
import { hasValetOrHerd, detectBackend } from './core/detect.js'
import { startProxy } from './core/proxy.js'
import { generateCert, isMkcertInstalled, setupMkcert } from './core/cert.js'
import { spawnDevServer } from './core/runner.js'
import { listBackendProxies, removeBackendProxy, findProcessOnPort, killProcess } from './core/process.js'
import type { BetterPortOptions, BetterPortResult, DomainConflict } from './types.js'

export type { BetterPortOptions, BetterPortResult, DomainConflict } from './types.js'

export default async function devdomain(options: BetterPortOptions = {}): Promise<BetterPortResult> {
  const {
    https: useHttps = true,
    clean = true,
    command,
    args = [],
    portRange,
    open: autoOpen = true,
    cwd = process.cwd(),
    onConflict,
  } = options

  // Resolve domain
  const domain = options.domain
    ? parseDomain(options.domain)
    : detectDomain(cwd)

  // Check for existing proxy on the same domain
  const backend = detectBackend()
  if (backend !== 'none') {
    const proxies = listBackendProxies(backend)
    const siteName = domain.replace(/\.test$/, '')
    const existing = proxies.find(p => p.site === siteName)

    if (existing) {
      const portMatch = existing.host.match(/:(\d+)$/)
      const existingPort = portMatch ? parseInt(portMatch[1], 10) : undefined
      const existingProcess = existingPort ? findProcessOnPort(existingPort) : undefined

      const conflict: DomainConflict = {
        domain,
        proxy: existing,
        process: existingProcess,
      }

      if (onConflict) {
        const decision = await onConflict(conflict)
        if (decision === 'cancel') {
          throw new Error(`Domain ${domain} is already in use. Cancelled by user.`)
        }
      }

      // Replace: kill old process and remove old proxy
      if (existingProcess) {
        killProcess(existingProcess.pid)
      }
      removeBackendProxy(backend, siteName)
    }
  }

  // Find a free port
  const [min, max] = portRange || [4000, 8999]
  const port = await findFreePort(min, max)

  // Register domain in hosts file (skip if Valet handles .test via dnsmasq)
  const valetDetected = hasValetOrHerd()
  if (!valetDetected) {
    // Only need sudo for hosts file editing (non-Herd/Valet systems)
    ensureSudo()
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

  // Start proxy if clean mode
  let stopProxy: (() => Promise<void>) | undefined
  if (clean) {
    const proxyInstance = await startProxy({ targetPort: port, domain, cert, key, https: useHttps })
    stopProxy = proxyInstance.stop
  }

  // Build URL
  const protocol = useHttps ? 'https' : 'http'
  const url = clean
    ? `${protocol}://${domain}`
    : `${protocol}://${domain}:${port}`
  const internalUrl = `http://127.0.0.1:${port}`

  // Spawn dev server if command provided
  let child: ReturnType<typeof spawnDevServer> | undefined
  if (command) {
    child = spawnDevServer({ command, args, port, cwd })
  }

  // Auto-open browser
  if (autoOpen) {
    const openModule = await import('open')
    // Small delay to let the dev server start
    setTimeout(() => openModule.default(url), 1500)
  }

  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    if (child && !child.killed) {
      child.kill('SIGTERM')
    }
    if (stopProxy) {
      await stopProxy()
    }
    if (!valetDetected) {
      await removeHost(domain)
      flushDNS()
    }
  }

  // Auto-cleanup on process exit (Ctrl+C, terminal close, kill)
  process.on('SIGINT', async () => { await stop(); process.exit(0) })
  process.on('SIGTERM', async () => { await stop(); process.exit(0) })
  process.on('SIGHUP', async () => { await stop(); process.exit(0) })

  return { domain, port, url, internalUrl, stop }
}
