import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CERT_DIR = path.join(os.homedir(), '.devdomain', 'certs')

function ensureCertDir(): void {
  fs.mkdirSync(CERT_DIR, { recursive: true })
}

export function isMkcertInstalled(): boolean {
  try {
    execSync('mkcert -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function installMkcertCA(): void {
  execSync('mkcert -install', { stdio: 'inherit' })
}

export function generateCert(domain: string): { cert: string; key: string } {
  ensureCertDir()

  const certPath = path.join(CERT_DIR, `${domain}.pem`)
  const keyPath = path.join(CERT_DIR, `${domain}-key.pem`)

  // Return existing certs if they exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath, 'utf-8'),
      key: fs.readFileSync(keyPath, 'utf-8'),
    }
  }

  const result = spawnSync('mkcert', [
    '-cert-file', certPath,
    '-key-file', keyPath,
    domain,
    `*.${domain}`,
  ], { stdio: 'inherit' })

  if (result.status !== 0) {
    throw new Error('Failed to generate certificate with mkcert')
  }

  return {
    cert: fs.readFileSync(certPath, 'utf-8'),
    key: fs.readFileSync(keyPath, 'utf-8'),
  }
}

export function setupMkcert(): void {
  if (!isMkcertInstalled()) {
    const platform = os.platform()
    console.log('mkcert not found. Install it:')
    if (platform === 'darwin') {
      console.log('  brew install mkcert')
    } else if (platform === 'linux') {
      console.log('  sudo apt install mkcert  (or see https://github.com/FiloSottile/mkcert)')
    } else {
      console.log('  choco install mkcert  (or scoop install mkcert)')
    }
    throw new Error('mkcert is required for HTTPS support')
  }

  installMkcertCA()
}
