import fs from 'node:fs'
import path from 'node:path'

function sanitize(name: string): string {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, '') // strip npm scope
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function detectDomain(cwd: string = process.cwd()): string {
  // Try package.json name first
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.name) {
        return `${sanitize(pkg.name)}.test`
      }
    } catch {}
  }

  // Fallback to folder name
  const folderName = path.basename(cwd)
  return `${sanitize(folderName)}.test`
}

export function parseDomain(domain: string): string {
  if (!domain.endsWith('.test')) {
    domain = `${domain}.test`
  }
  return sanitize(domain.replace(/\.test$/, '')) + '.test'
}
