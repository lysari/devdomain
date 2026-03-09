import { findFreePort } from './core/port-finder.js'
import { detectDomain, parseDomain } from './core/domain.js'
import { addHost, removeHost, flushDNS } from './core/hosts.js'
import { hasValetOrHerd } from './core/detect.js'
import { startProxy } from './core/proxy.js'
import { generateCert, isMkcertInstalled, setupMkcert } from './core/cert.js'
import { spawnDevServer } from './core/runner.js'
import type { BetterPortOptions, BetterPortResult } from './types.js'

export type { BetterPortOptions, BetterPortResult } from './types.js'

export default async function devdomain(options: BetterPortOptions = {}): Promise<BetterPortResult> {
  const {
    https: useHttps = true,
    clean = true,
    command,
    args = [],
    portRange,
    open: autoOpen = true,
    cwd = process.cwd(),
  } = options

  // Resolve domain
  const domain = options.domain
    ? parseDomain(options.domain)
    : detectDomain(cwd)

  // Find a free port
  const [min, max] = portRange || [4000, 8999]
  const port = await findFreePort(min, max)

  // Register domain in hosts file (skip if Valet handles .test via dnsmasq)
  const valetDetected = hasValetOrHerd()
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

  const stop = async () => {
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

  return { domain, port, url, internalUrl, stop }
}
