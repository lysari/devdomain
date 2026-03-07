import net from 'node:net'

const DEFAULT_MIN = 4000
const DEFAULT_MAX = 8999

function randomPort(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

export async function findFreePort(
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  maxAttempts = 50
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = randomPort(min, max)
    if (await isPortFree(port)) {
      return port
    }
  }

  // Fallback: scan sequentially
  for (let port = min; port <= max; port++) {
    if (await isPortFree(port)) {
      return port
    }
  }

  throw new Error(`No free port found in range ${min}-${max}`)
}
