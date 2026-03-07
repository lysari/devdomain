import { execSync } from 'node:child_process'

export type ProxyBackend = 'herd' | 'valet' | 'none'

export function detectBackend(): ProxyBackend {
  // Check Herd first (it also installs a `valet` shim)
  try {
    execSync('which herd', { stdio: 'ignore' })
    return 'herd'
  } catch {}

  try {
    execSync('which valet', { stdio: 'ignore' })
    return 'valet'
  } catch {}

  return 'none'
}

export function hasValetOrHerd(): boolean {
  return detectBackend() !== 'none'
}
