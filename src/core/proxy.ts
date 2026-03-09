import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import { exec, spawnSync } from 'node:child_process'
import os from 'node:os'
import httpProxy from 'http-proxy'
import type { ProxyOptions } from '../types.js'
import { detectBackend } from './detect.js'

interface ProxyInstance {
  httpServer?: http.Server
  httpsServer?: https.Server
  proxy?: httpProxy
  stop: () => Promise<void>
}

type ProxyStrategy = 'herd' | 'valet' | 'portforward'

function detectStrategy(): ProxyStrategy {
  const backend = detectBackend()
  if (backend === 'herd') return 'herd'
  if (backend === 'valet') return 'valet'
  return 'portforward'
}

// --- Herd/Valet strategy ---
// Herd writes nginx configs to its own dir, but root nginx includes ~/.config/valet/Nginx/*.
// We copy (not symlink) the config so root nginx picks it up, and delete on cleanup.

function getConfigPaths(domain: string) {
  const homedir = os.homedir()
  return {
    herdConfig: `${homedir}/Library/Application Support/Herd/config/valet/Nginx/${domain}`,
    valetConfig: `${homedir}/.config/valet/Nginx/${domain}`,
  }
}

function copyNginxConfig(domain: string): void {
  const { herdConfig, valetConfig } = getConfigPaths(domain)
  try {
    if (fs.existsSync(herdConfig)) {
      fs.copyFileSync(herdConfig, valetConfig)
    }
  } catch {}
}

function removeNginxConfig(domain: string): void {
  const { herdConfig, valetConfig } = getConfigPaths(domain)
  try {
    // Only remove if it's a copy we created (source no longer exists after unproxy)
    if (fs.existsSync(valetConfig) && !fs.existsSync(herdConfig)) {
      fs.unlinkSync(valetConfig)
    }
  } catch {}
}

function reloadNginx(): void {
  // Try non-interactive sudo first (works if credentials are cached)
  try {
    const result = spawnSync('sudo', ['-n', 'nginx', '-s', 'reload'], { stdio: 'pipe' })
    if (result.status === 0) return
  } catch {}

  // macOS: prompt in terminal (standard sudo experience)
  if (os.platform() === 'darwin' || os.platform() === 'linux') {
    try {
      spawnSync('sudo', ['nginx', '-s', 'reload'], { stdio: 'inherit' })
    } catch {}
  }
}

function runBackendProxy(backend: 'herd' | 'valet', domain: string, targetPort: number, useHttps: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const siteName = domain.replace(/\.test$/, '')
    const secureFlag = useHttps ? ' --secure' : ''
    const cmd = `${backend} proxy ${siteName} http://127.0.0.1:${targetPort}${secureFlag}`
    exec(cmd, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`${backend} proxy failed: ${stderr || error.message}`))
        return
      }
      if (backend === 'herd') {
        copyNginxConfig(domain)
        reloadNginx()
      }
      resolve()
    })
  })
}

function runBackendUnproxy(backend: 'herd' | 'valet', domain: string): Promise<void> {
  return new Promise((resolve) => {
    const siteName = domain.replace(/\.test$/, '')
    exec(`${backend} unproxy ${siteName}`, () => {
      if (backend === 'herd') {
        removeNginxConfig(domain)
        reloadNginx()
      }
      resolve()
    })
  })
}

// --- Port forward strategy (no Valet/Herd) ---

function addPortForward(fromPort: number, toPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform()

    if (platform === 'darwin') {
      const rule = `rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port ${fromPort} -> 127.0.0.1 port ${toPort}`
      const cmd = `echo "${rule}" | sudo pfctl -a "com.apple/devdomain" -f - && sudo pfctl -e 2>/dev/null; true`
      exec(cmd, (error) => {
        if (error) reject(new Error(`Failed to set up port forwarding: ${error.message}`))
        else resolve()
      })
    } else if (platform === 'linux') {
      const cmd = `sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport ${fromPort} -j REDIRECT --to-port ${toPort}`
      exec(cmd, (error) => {
        if (error) reject(new Error(`Failed to set up port forwarding: ${error.message}`))
        else resolve()
      })
    } else {
      reject(new Error('Clean mode is not supported on Windows yet. Use simple mode instead.'))
    }
  })
}

function removePortForward(fromPort: number, toPort: number): Promise<void> {
  return new Promise((resolve) => {
    const platform = os.platform()

    if (platform === 'darwin') {
      exec('sudo pfctl -a "com.apple/devdomain" -F all 2>/dev/null; true', () => resolve())
    } else if (platform === 'linux') {
      const cmd = `sudo iptables -t nat -D OUTPUT -p tcp -d 127.0.0.1 --dport ${fromPort} -j REDIRECT --to-port ${toPort} 2>/dev/null; true`
      exec(cmd, () => resolve())
    } else {
      resolve()
    }
  })
}

// --- Main entry ---

export function startProxy(options: ProxyOptions): Promise<ProxyInstance> {
  const strategy = detectStrategy()

  if (strategy === 'herd' || strategy === 'valet') {
    return startBackendProxy(strategy, options)
  }

  return startPortForwardProxy(options)
}

async function startBackendProxy(backend: 'herd' | 'valet', options: ProxyOptions): Promise<ProxyInstance> {
  const { targetPort, domain, cert, key } = options
  const useHttps = options.https ?? !!(cert && key)

  await runBackendProxy(backend, domain, targetPort, useHttps)

  return {
    stop: async () => {
      await runBackendUnproxy(backend, domain)
    },
  }
}

function startPortForwardProxy(options: ProxyOptions): Promise<ProxyInstance> {
  return new Promise((resolve, reject) => {
    const { targetPort, domain, cert, key } = options

    const httpProxyPort = targetPort + 1000
    const httpsProxyPort = targetPort + 1001

    const proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${targetPort}`,
      ws: true,
      changeOrigin: true,
    })

    proxy.on('error', (err, _req, res) => {
      if (res && 'writeHead' in res) {
        ;(res as http.ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' })
        ;(res as http.ServerResponse).end('devdomain: waiting for dev server...')
      }
    })

    const httpServer = http.createServer((req, res) => {
      if (cert && key) {
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

    const stop = async (): Promise<void> => {
      await removePortForward(80, httpProxyPort)
      if (cert && key) {
        await removePortForward(443, httpsProxyPort)
      }

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

    httpServer.listen(httpProxyPort, '127.0.0.1', async () => {
      try {
        await addPortForward(80, httpProxyPort)

        if (httpsServer) {
          httpsServer.listen(httpsProxyPort, '127.0.0.1', async () => {
            try {
              await addPortForward(443, httpsProxyPort)
              resolve({ httpServer, httpsServer, proxy, stop })
            } catch (err) {
              httpServer.close()
              httpsServer!.close()
              reject(err)
            }
          })
          httpsServer.on('error', (err) => {
            httpServer.close()
            reject(err)
          })
        } else {
          resolve({ httpServer, proxy, stop })
        }
      } catch (err) {
        httpServer.close()
        reject(err)
      }
    })

    httpServer.on('error', reject)
  })
}
