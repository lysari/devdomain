<br/>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=rect&color=0:0d1117,100:161b22&height=1&section=header" />
    <source media="(prefers-color-scheme: light)" srcset="https://capsule-render.vercel.app/api?type=rect&color=0:ffffff,100:f6f8fa&height=1&section=header" />
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=40&pause=1000000&color=58A6FF&center=true&vCenter=true&width=500&height=60&lines=devdomain" />
    <source media="(prefers-color-scheme: light)" srcset="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=40&pause=1000000&color=0969DA&center=true&vCenter=true&width=500&height=60&lines=devdomain" />
    <img alt="devdomain" src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=40&pause=1000000&color=0969DA&center=true&vCenter=true&width=500&height=60&lines=devdomain" />
  </picture>
</p>

<p align="center">
  <code>localhost:5173</code>&nbsp;&nbsp;&#8594;&nbsp;&nbsp;<code>my-project.test</code>
</p>

<p align="center">
  <strong>Stop memorizing port numbers.</strong><br/>
  Give your dev server a clean <code>.test</code> domain with zero config.
</p>

<br/>

<p align="center">
  <a href="https://www.npmjs.com/package/devdomain"><img src="https://img.shields.io/npm/v/devdomain?style=flat-square&logo=npm&logoColor=white&label=npm&color=CB3837" alt="npm version" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license" />
  &nbsp;
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="node version" />
  &nbsp;
  <img src="https://img.shields.io/badge/macOS%20%7C%20Linux%20%7C%20Windows-grey?style=flat-square" alt="platform" />
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<br/>

<p align="center">
  <a href="#quick-start">Quick Start</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="#cli-reference">CLI</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="#vite-plugin-options">Vite Plugin</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="#programmatic-api">API</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="#how-it-works">How It Works</a>
</p>

<br/>

```bash
$ npx devdomain vite

devdomain v1.0.3

Domain:    my-project.test
Port:      7421
URL:       http://my-project.test:7421
Internal:  http://127.0.0.1:7421

Press Ctrl+C to stop
```

<br/>

<table align="center">
<tr>
<td align="center"><strong>Before</strong></td>
<td align="center"></td>
<td align="center"><strong>After</strong></td>
</tr>
<tr>
<td align="center"><code>http://localhost:5173</code></td>
<td align="center">&rarr;</td>
<td align="center"><code>http://my-project.test</code></td>
</tr>
<tr>
<td align="center"><code>http://localhost:3000</code></td>
<td align="center">&rarr;</td>
<td align="center"><code>https://dashboard.test</code></td>
</tr>
<tr>
<td align="center"><code>http://localhost:8080</code></td>
<td align="center">&rarr;</td>
<td align="center"><code>https://api.test</code></td>
</tr>
</table>

<br/>

---

## Why devdomain?

| | Problem | Solution |
|---|---|---|
| **Memorable** | `localhost:5173` is forgettable | `dashboard.test` is not |
| **Realistic** | Cookies, CORS, OAuth break on localhost | `.test` domains behave like production |
| **No conflicts** | Port 3000 is already in use... | devdomain picks a free port automatically |
| **Team-friendly** | "What port are you on?" | Same domain for everyone |
| **Clean URLs** | `http://localhost:8080/api/v2` | `http://api.test/v2` |
| **Trusted HTTPS** | Self-signed cert warnings | One flag for a green lock via mkcert |

## Install

```bash
npm install -D devdomain
```

## Quick Start

### CLI (works with any dev server)

```bash
# Auto-detects your dev server
npx devdomain dev

# Or specify it explicitly
npx devdomain vite
npx devdomain next dev
npx devdomain nuxt dev

# Custom domain
npx devdomain dev --domain dashboard.test

# Full experience: clean URL + trusted HTTPS
npx devdomain dev --clean --https
```

### Vite Plugin (zero config)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import devdomain from 'devdomain/vite'

export default defineConfig({
  plugins: [
    devdomain()
  ]
})
```

Then just run `npm run dev` as usual. devdomain handles everything.

### Programmatic API

```ts
import devdomain from 'devdomain'

const server = await devdomain({
  command: 'vite',
  https: true,
  clean: true,
})

console.log(server.url)    // https://my-project.test
console.log(server.port)   // 7421

// When you're done
await server.stop()
```

## Modes

<table>
<tr>
<td width="50%">

### Simple Mode <sup>default</sup>

```bash
npx devdomain dev
```

```
http://my-project.test:7421
```

Maps to a `.test` domain with the port visible.
No extra privileges beyond the hosts file edit.

</td>
<td width="50%">

### Clean Mode

```bash
npx devdomain dev --clean --https
```

```
https://my-project.test
```

Reverse proxy on port 80/443 - no port in the URL.
Trusted green lock with `--https`.

</td>
</tr>
</table>

## CLI Reference

### `devdomain dev [command...]`

Start your dev server with a `.test` domain.

| Flag | Description |
|------|-------------|
| `-d, --domain <name>` | Custom domain (e.g. `dashboard.test`) |
| `--https` | Trusted HTTPS via mkcert |
| `--clean` | Hide port with reverse proxy |
| `--port-range <range>` | Custom range (e.g. `5000-9000`, default `4000-8999`) |
| `--open` | Auto-open browser |

### `devdomain setup`

Install mkcert's local CA. Run this once before using `--https`.

### `devdomain list`

Show all active devdomain domains in your hosts file.

### `devdomain cleanup`

Remove all devdomain entries from your hosts file.

## Vite Plugin Options

```ts
devdomain({
  domain: 'my-app.test',  // auto-detected from package.json if omitted
  https: true,             // trusted HTTPS with mkcert
  clean: true,             // reverse proxy on port 80/443
  open: true,              // open browser on start
})
```

## Programmatic API

```ts
const result = await devdomain(options)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | `string` | auto-detected | Domain name (e.g. `my-app.test`) |
| `https` | `boolean` | `false` | Enable trusted HTTPS |
| `clean` | `boolean` | `false` | Reverse proxy mode |
| `command` | `string` | - | Dev server command to spawn |
| `args` | `string[]` | `[]` | Arguments for the command |
| `portRange` | `[number, number]` | `[4000, 8999]` | Port range |
| `open` | `boolean` | `false` | Auto-open browser |
| `cwd` | `string` | `process.cwd()` | Working directory |

**Returns:**

```ts
{
  domain: string       // 'my-project.test'
  port: number         // 7421
  url: string          // 'https://my-project.test'
  internalUrl: string  // 'http://127.0.0.1:7421'
  stop: () => Promise<void>
}
```

## How It Works

1. **Detects your project name** from `package.json` or the folder name
2. **Finds a free port** randomly in the 4000-8999 range
3. **Adds a hosts entry** (`127.0.0.1 my-project.test # devdomain`) - prompts for sudo once
4. **(Optional)** Generates a trusted TLS certificate with mkcert
5. **(Optional)** Starts a reverse proxy on port 80/443 for clean URLs
6. **Spawns your dev server** on the chosen port
7. **Cleans up** the hosts entry on exit

All hosts entries are tagged with `# devdomain` so they're easy to identify and clean up.

## Requirements

- **Node.js** >= 18
- **mkcert** (only for `--https`) - install via `brew install mkcert` / `apt install mkcert` / `choco install mkcert`
- **sudo access** for editing `/etc/hosts` (one-time prompt)

## `.test` Domain

devdomain uses `.test` domains as defined in [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761). These are officially reserved for local development and testing - they will never conflict with real websites.

---

<br/>

<p align="center">
  <strong>devdomain</strong> &mdash; because your dev server deserves a real name.
</p>

<p align="center">
  MIT License
</p>
