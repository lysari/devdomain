export interface DomainConflict {
  domain: string
  proxy?: { site: string; host: string; ssl: boolean }
  process?: { pid: number; port: number; command: string }
}

export interface BetterPortOptions {
  domain?: string
  https?: boolean
  clean?: boolean
  command?: string
  args?: string[]
  portRange?: [number, number]
  open?: boolean
  cwd?: string
  /** Called when domain is already in use. Return 'replace' to kill old and continue, 'cancel' to abort. */
  onConflict?: (conflict: DomainConflict) => Promise<'replace' | 'cancel'> | 'replace' | 'cancel'
}

export interface BetterPortResult {
  domain: string
  port: number
  url: string
  internalUrl: string
  stop: () => Promise<void>
}

export interface ProxyOptions {
  targetPort: number
  domain: string
  cert?: string
  key?: string
  https?: boolean
}

export interface VitePluginOptions {
  domain?: string
  https?: boolean
  clean?: boolean
  open?: boolean
}
