import { execSync, exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const HOSTS_TAG = '# betterport'
const IP = '127.0.0.1'

function getHostsPath(): string {
  return os.platform() === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts'
}

function readHosts(): string {
  return fs.readFileSync(getHostsPath(), 'utf-8')
}

function hasEntry(domain: string): boolean {
  const hosts = readHosts()
  return hosts.includes(`${IP} ${domain}`)
}

function buildEntry(domain: string): string {
  return `${IP} ${domain} ${HOSTS_TAG}`
}

function sudoWriteHosts(content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform()
    const hostsPath = getHostsPath()

    if (platform === 'win32') {
      // On Windows, try direct write (needs admin)
      try {
        fs.writeFileSync(hostsPath, content)
        resolve()
      } catch {
        reject(new Error('Run as Administrator to modify hosts file'))
      }
      return
    }

    // macOS/Linux: use sudo tee
    const tmpFile = `/tmp/betterport-hosts-${Date.now()}`
    fs.writeFileSync(tmpFile, content)

    const cmd = `sudo cp "${tmpFile}" "${hostsPath}" && rm "${tmpFile}"`
    exec(cmd, (error) => {
      // Clean up tmp file on failure too
      try { fs.unlinkSync(tmpFile) } catch {}
      if (error) {
        reject(new Error(`Failed to update hosts file: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

export async function addHost(domain: string): Promise<void> {
  if (hasEntry(domain)) return

  const hosts = readHosts()
  const newContent = hosts.trimEnd() + '\n' + buildEntry(domain) + '\n'
  await sudoWriteHosts(newContent)
}

export async function removeHost(domain: string): Promise<void> {
  const hosts = readHosts()
  const lines = hosts.split('\n').filter(
    (line) => !(line.includes(domain) && line.includes(HOSTS_TAG))
  )
  await sudoWriteHosts(lines.join('\n'))
}

export async function removeAllHosts(): Promise<void> {
  const hosts = readHosts()
  const lines = hosts.split('\n').filter(
    (line) => !line.includes(HOSTS_TAG)
  )
  await sudoWriteHosts(lines.join('\n'))
}

export function listHosts(): Array<{ domain: string; ip: string }> {
  const hosts = readHosts()
  const entries: Array<{ domain: string; ip: string }> = []
  for (const line of hosts.split('\n')) {
    if (line.includes(HOSTS_TAG)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) {
        entries.push({ ip: parts[0], domain: parts[1] })
      }
    }
  }
  return entries
}

export function flushDNS(): void {
  const platform = os.platform()
  try {
    if (platform === 'darwin') {
      execSync('sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder', { stdio: 'ignore' })
    } else if (platform === 'linux') {
      execSync('sudo systemd-resolve --flush-caches 2>/dev/null || sudo resolvectl flush-caches 2>/dev/null || true', { stdio: 'ignore' })
    } else if (platform === 'win32') {
      execSync('ipconfig /flushdns', { stdio: 'ignore' })
    }
  } catch {
    // DNS flush is best-effort
  }
}
