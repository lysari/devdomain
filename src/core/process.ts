import { execSync } from 'node:child_process'
import os from 'node:os'

export interface PortProcess {
  pid: number
  port: number
  command: string
}

export interface HerdProxy {
  site: string
  domain: string
  ssl: boolean
  host: string
}

/**
 * Find all node processes listening on ports in the devdomain range (4000-8999)
 */
export function findDevdomainProcesses(): PortProcess[] {
  const platform = os.platform()

  if (platform === 'win32') {
    return findProcessesWindows()
  }

  return findProcessesUnix()
}

function findProcessesUnix(): PortProcess[] {
  try {
    const output = execSync('lsof -iTCP -sTCP:LISTEN -P -n', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const processes: PortProcess[] = []
    const seen = new Set<number>()

    for (const line of output.split('\n')) {
      if (!line.includes('LISTEN')) continue

      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue

      const command = parts[0]
      const pid = parseInt(parts[1], 10)
      const nameField = parts[8] // e.g. "127.0.0.1:5226" or "*:3000"

      const portMatch = nameField.match(/:(\d+)$/)
      if (!portMatch) continue

      const port = parseInt(portMatch[1], 10)

      // Only include node processes on ports in the devdomain range
      if (command !== 'node') continue
      if (port < 4000 || port > 8999) continue
      if (seen.has(pid)) continue
      seen.add(pid)

      // Try to get the full command line
      let fullCommand = command
      try {
        fullCommand = execSync(`ps -p ${pid} -o args=`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch {}

      processes.push({ pid, port, command: fullCommand })
    }

    return processes
  } catch {
    return []
  }
}

function findProcessesWindows(): PortProcess[] {
  try {
    const output = execSync('netstat -ano -p TCP', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const processes: PortProcess[] = []
    const seen = new Set<number>()

    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) continue

      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue

      const localAddr = parts[1]
      const pid = parseInt(parts[4], 10)

      const portMatch = localAddr.match(/:(\d+)$/)
      if (!portMatch) continue

      const port = parseInt(portMatch[1], 10)
      if (port < 4000 || port > 8999) continue
      if (seen.has(pid)) continue
      seen.add(pid)

      let command = `PID ${pid}`
      try {
        command = execSync(`wmic process where ProcessId=${pid} get CommandLine /format:list`, {
          encoding: 'utf-8',
        }).trim().replace('CommandLine=', '') || command
      } catch {}

      processes.push({ pid, port, command })
    }

    return processes
  } catch {
    return []
  }
}

/**
 * Kill a process by PID
 */
export function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM')
    return true
  } catch {
    // Try force kill
    try {
      process.kill(pid, 'SIGKILL')
      return true
    } catch {
      return false
    }
  }
}

/**
 * Find process listening on a specific port
 */
export function findProcessOnPort(port: number): PortProcess | undefined {
  const platform = os.platform()

  try {
    if (platform === 'win32') {
      const output = execSync(`netstat -ano -p TCP | findstr :${port}.*LISTENING`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const parts = output.trim().split(/\s+/)
      if (parts.length >= 5) {
        const pid = parseInt(parts[4], 10)
        return { pid, port, command: `PID ${pid}` }
      }
    } else {
      const output = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -P -n`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      for (const line of output.split('\n')) {
        if (!line.includes('LISTEN')) continue
        const parts = line.trim().split(/\s+/)
        const pid = parseInt(parts[1], 10)
        let command = parts[0]
        try {
          command = execSync(`ps -p ${pid} -o args=`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim()
        } catch {}
        return { pid, port, command }
      }
    }
  } catch {}

  return undefined
}

/**
 * List all active Herd/Valet proxies
 */
export function listBackendProxies(backend: string): HerdProxy[] {
  if (backend === 'none') return []

  try {
    const output = execSync(`${backend} proxies`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const proxies: HerdProxy[] = []
    for (const line of output.split('\n')) {
      // Parse table rows: | site-name | X | https://... | http://... |
      const match = line.match(/\|\s*(\S+)\s*\|\s*(X?)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|/)
      if (!match) continue
      if (match[1] === 'Site') continue // header row

      proxies.push({
        site: match[1],
        domain: `${match[1]}.test`,
        ssl: match[2] === 'X',
        host: match[4],
      })
    }

    return proxies
  } catch {
    return []
  }
}

/**
 * Remove a Herd/Valet proxy by site name
 */
export function removeBackendProxy(backend: string, site: string): void {
  try {
    execSync(`${backend} unproxy ${site}`, { stdio: 'ignore' })
  } catch {}
}
