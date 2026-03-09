import { spawnSync } from 'node:child_process'
import os from 'node:os'

/**
 * Run a command with sudo.
 * Uses sudo -n (non-interactive) first, falls back to interactive sudo in terminal.
 * No GUI dialogs — keeps it simple and non-scary for users.
 */
export function sudoExec(command: string): boolean {
  // Try non-interactive first (works if cached or passwordless)
  try {
    const result = spawnSync('sudo', ['-n', 'sh', '-c', command], { stdio: 'pipe' })
    if (result.status === 0) return true
  } catch {}

  // Fall back to interactive sudo in terminal
  try {
    const result = spawnSync('sudo', ['sh', '-c', command], { stdio: 'inherit' })
    return result.status === 0
  } catch {
    return false
  }
}

/**
 * Cache sudo credentials by prompting once in the terminal.
 * Only needed for non-Herd/Valet setups that edit /etc/hosts.
 */
export function ensureSudo(): void {
  // Check if already cached
  const check = spawnSync('sudo', ['-n', 'true'], { stdio: 'pipe' })
  if (check.status === 0) return

  // Prompt in terminal (standard sudo behavior)
  if (os.platform() !== 'win32') {
    spawnSync('sudo', ['-v'], { stdio: 'inherit' })
  }
}
