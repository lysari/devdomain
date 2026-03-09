# devdomain - Agent Instructions

## Project Overview
npm package "devdomain" — gives local dev servers clean `.test` domains with HTTPS.
3 entry points: CLI (`devdomain`), programmatic API (`import devdomain from 'devdomain'`), Vite plugin (`import devdomain from 'devdomain/vite'`).

## After Every Fix / Update — Checklist

### 1. Update version
- Bump version in `package.json` using `npm version <patch|minor|major> --no-git-tag-version`
- **README.md line 52** has a hardcoded version string (e.g. `devdomain v1.1.2`) — UPDATE IT
- Version in CLI and Vite plugin is read dynamically from package.json via `createRequire` — no manual update needed

### 2. Build
```bash
npx tsup
```

### 3. Test before publishing
- Run `node dist/cli/index.js --version` to verify version
- Run `node dist/cli/index.js status` to check status command
- Test Vite plugin if plugin code changed
- Test `kill-all` cleans up proxies

### 4. Publish & push
```bash
npm publish
git add -A && git commit -m "message" && git push
```

## Key Architecture

### Herd/Valet Integration
- Use `herd proxy <site> http://127.0.0.1:<port> --secure` for HTTPS (single command)
- Do NOT use separate `herd secure` — it overwrites the proxy config
- Target URL is always `http://` (dev server runs HTTP internally)
- Symlink Herd config to `~/.config/valet/Nginx/` for root nginx
- Remove symlinks BEFORE `herd unproxy` to prevent broken symlinks blocking nginx
- Use `nginx -s reload` via osascript for root nginx reload

### Signal Handling
- SIGINT, SIGTERM, SIGHUP handlers in both Vite plugin and programmatic API
- Must clean up Herd proxy on process exit to prevent stale domains

### Defaults
- All boolean options default to `true`: https, clean, open
- CLI flags are negated: `--no-https`, `--no-clean`, `--no-open`

## File Structure
- `src/index.ts` — programmatic API entry
- `src/cli/index.ts` — CLI entry (commander)
- `src/vite-plugin/index.ts` — Vite plugin entry
- `src/core/proxy.ts` — proxy strategies (herd/valet/portforward)
- `src/core/process.ts` — process monitor (status/kill/kill-all)
- `src/core/hosts.ts` — /etc/hosts management
- `src/core/cert.ts` — mkcert integration
- `src/core/detect.ts` — Herd/Valet detection
- `src/core/domain.ts` — domain auto-detection
- `src/core/port-finder.ts` — random free port finder
- `src/core/runner.ts` — dev server spawner
- `src/types.ts` — shared TypeScript interfaces

## Common Pitfalls
- README version is hardcoded — always update it when bumping version
- `herd secure` + `herd proxy` = broken (secure overwrites proxy config)
- Broken symlinks in `~/.config/valet/Nginx/` block ALL nginx sites from reloading
- Root nginx (PID owned by root) needs `osascript` or `sudo` to reload on macOS
- `isDefault: true` on commander commands causes typos to start servers — removed
