**✅ Done!**  
We’re building **betterPort** with **`.test`** exactly as you chose (clean, professional, and officially reserved for local dev per RFC 6761).

Here is the **complete architecture + full API design** — ready for implementation.

### 1. Architecture Overview

**betterPort** = One npm package with 3 entry points:
- `betterport` → CLI (main way to use)
- `betterport` → Core library (programmatic)
- `vite-plugin-betterport` → Vite plugin (super easy for Vite users)

**Internal Flow (when you run it)**  
1. Detect project name → `my-project.test` (from `package.json#name` or folder name, sanitized)  
2. Find best free random port (smart random in 4000–8999 range)  
3. Register domain → safely add `127.0.0.1 my-project.test` to `/etc/hosts` (or Windows equivalent)  
4. (Optional) Generate trusted HTTPS certificate with **mkcert** for `*.test`  
5. (Optional Clean Mode) Start lightweight reverse proxy on port 80 + 443  
6. Spawn your dev server (Vite, Next.js, etc.) on the random port  
7. Show beautiful output + open browser

**Two Operating Modes** (you choose with flag or in config)
- **Simple mode** (default, zero extra privileges after hosts) → `http://my-project.test:7421`
- **Clean mode** (`--clean`) → `http://my-project.test` (no port visible — uses reverse proxy)

**Cross-platform Hosts & Sudo Handling**
- Uses `hostile` + `sudo-prompt` → one-time password prompt only when needed
- All entries are tagged with `# betterport` → super easy to clean up
- Works on macOS, Linux, Windows

**Key Modules** (folder structure)
```
betterport/
├── src/
│   ├── core/
│   │   ├── port-finder.ts      (random + free check)
│   │   ├── domain.ts           (name.test generator)
│   │   ├── hosts.ts            (add/remove with sudo)
│   │   ├── proxy.ts            (http-proxy for Clean mode)
│   │   ├── cert.ts             (mkcert integration)
│   │   └── runner.ts           (spawn vite/next/etc)
│   ├── cli/
│   └── vite-plugin/
└── package.json
```

**Dependencies** (kept very light)
- `hostile` (hosts file)
- `http-proxy` + `http` (proxy)
- `mkcert` (via child_process)
- `portfinder` or custom TCP checker
- `commander`, `chalk`, `open`, `sudo-prompt`, `fs-extra`

### 2. Full API Design

#### A. CLI API (most common usage)

```bash
# Basic (auto-detects vite, next, etc.)
npx betterport dev
npx betterport vite
npx betterport next dev

# Clean URL + HTTPS (recommended)
npx betterport dev --clean --https

# Custom domain
npx betterport dev --domain dashboard.test

# Management commands
npx betterport setup          # installs mkcert globally (one time)
npx betterport list           # shows all active domains & ports
npx betterport stop           # stops proxy
npx betterport cleanup        # removes all betterPort hosts entries
```

**All flags**
- `--domain, -d <name.test>`     → custom domain
- `--https`                      → trusted green lock (mkcert)
- `--clean`                      → hide port completely (`http://my-project.test`)
- `--port-range 5000-9000`       → custom range
- `--open`                       → auto open browser

#### B. Programmatic / Core API (for scripts or other tools)

```ts
import betterport from 'betterport'

const result = await betterport({
  domain: 'my-project.test',   // or auto-detect
  https: true,
  clean: true,                 // true = proxy mode (no port)
  command: 'vite',             // or 'next dev', 'react-scripts start', etc.
  args: ['--mode', 'development'],
})

console.log(result)
// {
//   domain: 'my-project.test',
//   port: 7421,
//   url: 'https://my-project.test',
//   internalUrl: 'http://localhost:7421',
//   stop: () => Promise<void>
// }
```

#### C. Vite Plugin API (easiest for Vite users)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import betterport from 'vite-plugin-betterport'

export default defineConfig({
  plugins: [
    betterport({
      domain: 'my-project.test',   // auto-detect if omitted
      https: true,
      clean: true,                 // recommended
      open: true
    })
  ]
})
```

Just run `npm run dev` normally → betterPort does everything automatically.