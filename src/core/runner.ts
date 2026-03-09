import { spawn, type ChildProcess } from 'node:child_process'

export interface RunnerOptions {
  command: string
  args?: string[]
  port: number
  cwd?: string
  env?: Record<string, string>
}

export function spawnDevServer(options: RunnerOptions): ChildProcess {
  const { command, args = [], port, cwd = process.cwd(), env = {} } = options

  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
    },
  })

  return child
}

export function detectDevCommand(args: string[]): { command: string; args: string[] } {
  if (args.length === 0) {
    return { command: 'npm', args: ['run', 'dev'] }
  }

  const [cmd, ...rest] = args

  // Common dev server commands
  const knownCommands = ['vite', 'next', 'nuxt', 'astro', 'remix', 'webpack', 'parcel']

  if (cmd === 'dev') {
    return { command: 'npm', args: ['run', 'dev'] }
  }

  if (knownCommands.includes(cmd)) {
    // If just the tool name, add 'dev' for ones that need it
    const needsDev = ['next', 'nuxt', 'astro', 'remix']
    if (needsDev.includes(cmd) && !rest.includes('dev')) {
      rest.unshift('dev')
    }

    // Next.js binds to ::1 (IPv6) by default — force IPv4 for proxy compatibility
    if (cmd === 'next' && !rest.includes('--hostname') && !rest.includes('-H')) {
      rest.push('--hostname', '0.0.0.0')
    }

    return { command: 'npx', args: [cmd, ...rest] }
  }

  return { command: cmd, args: rest }
}
