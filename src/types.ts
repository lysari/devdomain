export interface BetterPortOptions {
  domain?: string
  https?: boolean
  clean?: boolean
  command?: string
  args?: string[]
  portRange?: [number, number]
  open?: boolean
  cwd?: string
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
}

export interface VitePluginOptions {
  domain?: string
  https?: boolean
  clean?: boolean
  open?: boolean
}
