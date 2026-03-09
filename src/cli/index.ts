#!/usr/bin/env node

import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'
import { Command } from 'commander'
import chalk from 'chalk'
import devdomain from '../index.js'
import type { DomainConflict } from '../types.js'
import { detectDevCommand } from '../core/runner.js'
import { removeAllHosts, removeHost, listHosts, flushDNS } from '../core/hosts.js'
import { setupMkcert } from '../core/cert.js'
import { detectBackend, hasValetOrHerd } from '../core/detect.js'
import { findDevdomainProcesses, findProcessOnPort, killProcess, listBackendProxies, removeBackendProxy } from '../core/process.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json')

function promptConflict(conflict: DomainConflict): Promise<'replace' | 'cancel'> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const port = conflict.proxy?.host.match(/:(\d+)$/)?.[1] || '?'
    const pid = conflict.process ? ` (PID ${conflict.process.pid})` : ''

    console.log()
    console.log(chalk.yellow(`  ⚠ Domain ${chalk.bold(conflict.domain)} is already in use`))
    console.log(chalk.dim(`    Proxying to port ${port}${pid}`))
    console.log()

    rl.question(`  ${chalk.bold('Replace')} the existing proxy? ${chalk.dim('(Y/n)')} `, (answer) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      if (normalized === '' || normalized === 'y' || normalized === 'yes') {
        resolve('replace')
      } else {
        resolve('cancel')
      }
    })
  })
}

const program = new Command()

program
  .name('devdomain')
  .description('Give your dev server a clean .test domain')
  .version(version)

program
  .command('dev')
  .description('Start your dev server with a .test domain')
  .argument('[command...]', 'Dev server command (e.g. vite, next dev)')
  .option('-d, --domain <domain>', 'Custom domain (e.g. dashboard.test)')
  .option('--no-https', 'Disable HTTPS')
  .option('--no-clean', 'Show port in URL (no reverse proxy)')
  .option('--port-range <range>', 'Custom port range (e.g. 5000-9000)')
  .option('--no-open', 'Do not auto-open browser')
  .action(async (commandArgs: string[], opts) => {
    try {
      const { command, args } = detectDevCommand(commandArgs)

      const portRange = opts.portRange
        ? (opts.portRange.split('-').map(Number) as [number, number])
        : undefined

      const result = await devdomain({
        domain: opts.domain,
        https: opts.https,
        clean: opts.clean,
        onConflict: promptConflict,
        command,
        args,
        portRange,
        open: opts.open,
      })

      console.log()
      console.log(chalk.bold.green('  devdomain') + chalk.dim(` v${version}`))
      console.log()
      console.log(`  ${chalk.dim('Domain:')}    ${chalk.cyan(result.domain)}`)
      console.log(`  ${chalk.dim('Port:')}      ${chalk.yellow(String(result.port))}`)
      console.log(`  ${chalk.dim('URL:')}       ${chalk.bold.underline(result.url)}`)
      console.log(`  ${chalk.dim('Internal:')}  ${result.internalUrl}`)
      if (opts.https) {
        console.log(`  ${chalk.dim('HTTPS:')}    ${chalk.green('trusted (mkcert)')}`)
      }
      if (opts.clean) {
        const backend = detectBackend()
        const via = backend === 'herd' ? 'Herd' : backend === 'valet' ? 'Valet' : 'reverse proxy'
        console.log(`  ${chalk.dim('Mode:')}     ${chalk.green(`clean (${via})`)}`)
      }
      console.log()
      console.log(chalk.dim('  Press Ctrl+C to stop'))
      console.log()

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log()
        console.log(chalk.dim('  Shutting down...'))
        await result.stop()
        console.log(chalk.dim('  Cleaned up hosts entry. Goodbye!'))
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`))
      process.exit(1)
    }
  })

program
  .command('setup')
  .description('Install mkcert and set up trusted certificates')
  .action(() => {
    try {
      console.log(chalk.dim('Setting up mkcert...'))
      setupMkcert()
      console.log(chalk.green('mkcert installed and CA set up!'))
    } catch (error) {
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

program
  .command('list')
  .description('Show all active devdomain domains')
  .action(() => {
    const entries = listHosts()
    if (entries.length === 0) {
      console.log(chalk.dim('No active devdomain domains.'))
      return
    }
    console.log(chalk.bold('\nActive devdomain domains:\n'))
    for (const entry of entries) {
      console.log(`  ${chalk.cyan(entry.domain)} ${chalk.dim('->')} ${entry.ip}`)
    }
    console.log()
  })

program
  .command('status')
  .description('Show all active devdomain processes, domains, and proxies')
  .action(() => {
    const processes = findDevdomainProcesses()
    const hosts = listHosts()
    const backend = detectBackend()
    const proxies = listBackendProxies(backend)

    if (processes.length === 0 && hosts.length === 0 && proxies.length === 0) {
      console.log(chalk.dim('No active devdomain processes or domains.'))
      return
    }

    if (processes.length > 0) {
      console.log(chalk.bold('\n  Active processes:\n'))
      for (const proc of processes) {
        console.log(`  ${chalk.yellow(`PID ${proc.pid}`)}  ${chalk.dim('port')} ${chalk.cyan(String(proc.port))}  ${chalk.dim(proc.command)}`)
      }
    }

    if (proxies.length > 0) {
      const backendName = backend === 'herd' ? 'Herd' : 'Valet'
      console.log(chalk.bold(`\n  ${backendName} proxies:\n`))
      for (const proxy of proxies) {
        const ssl = proxy.ssl ? chalk.green('SSL') : chalk.dim('HTTP')
        console.log(`  ${chalk.cyan(proxy.domain)}  ${ssl}  ${chalk.dim('->')} ${proxy.host}`)
      }
    }

    if (hosts.length > 0) {
      console.log(chalk.bold('\n  Hosts entries:\n'))
      for (const entry of hosts) {
        console.log(`  ${chalk.cyan(entry.domain)} ${chalk.dim('->')} ${entry.ip}`)
      }
    }

    console.log()
    console.log(chalk.dim(`  Use ${chalk.white('devdomain kill <port|pid>')} to stop a process`))
    console.log(chalk.dim(`  Use ${chalk.white('devdomain kill-all')} to stop all\n`))
  })

program
  .command('kill')
  .description('Kill a process by port number or PID and clean up its proxy')
  .argument('<target>', 'Port number, PID, or domain (e.g. my-app.test)')
  .action(async (target: string) => {
    const backend = detectBackend()

    // If target looks like a domain, find and kill its proxy
    if (target.includes('.')) {
      const domain = target.endsWith('.test') ? target : `${target}.test`
      const siteName = domain.replace(/\.test$/, '')
      const proxies = listBackendProxies(backend)
      const proxy = proxies.find(p => p.site === siteName)

      if (proxy) {
        // Try to kill the process on the proxy target port
        const portMatch = proxy.host.match(/:(\d+)$/)
        if (portMatch) {
          const port = parseInt(portMatch[1], 10)
          const proc = findProcessOnPort(port)
          if (proc) {
            killProcess(proc.pid)
            console.log(chalk.green(`Killed process on port ${port} (PID ${proc.pid})`))
          }
        }
        removeBackendProxy(backend, siteName)
        console.log(chalk.green(`Removed proxy for ${domain}`))
      } else {
        // Try removing hosts entry
        if (!hasValetOrHerd()) {
          await removeHost(domain)
          flushDNS()
          console.log(chalk.green(`Removed hosts entry for ${domain}`))
        } else {
          console.error(chalk.red(`No proxy found for ${domain}`))
          process.exit(1)
        }
      }
      return
    }

    const num = parseInt(target, 10)
    if (isNaN(num)) {
      console.error(chalk.red('Please provide a port number, PID, or domain.'))
      process.exit(1)
    }

    // Check if it's a port first
    const proc = findProcessOnPort(num)
    if (proc) {
      killProcess(proc.pid)
      console.log(chalk.green(`Killed process on port ${num} (PID ${proc.pid})`))
    } else {
      // Try as PID directly
      const success = killProcess(num)
      if (success) {
        console.log(chalk.green(`Killed process (PID ${num})`))
      } else {
        console.error(chalk.red(`No process found on port ${num} or with PID ${num}`))
        process.exit(1)
      }
    }

    // Clean up any proxy pointing to this port
    const proxies = listBackendProxies(backend)
    const matchingProxy = proxies.find(p => p.host.includes(`:${num}`))
    if (matchingProxy) {
      removeBackendProxy(backend, matchingProxy.site)
      console.log(chalk.dim(`  Removed proxy for ${matchingProxy.domain}`))
    }

    // Clean up hosts if not using Herd/Valet
    if (!hasValetOrHerd()) {
      const hosts = listHosts()
      if (hosts.length > 0) {
        await removeAllHosts()
        flushDNS()
        console.log(chalk.dim('  Cleaned up hosts entries'))
      }
    }
  })

program
  .command('kill-all')
  .description('Kill all devdomain processes and clean up all proxies/domains')
  .action(async () => {
    const processes = findDevdomainProcesses()
    const backend = detectBackend()
    const proxies = listBackendProxies(backend)
    const hosts = listHosts()

    if (processes.length === 0 && proxies.length === 0 && hosts.length === 0) {
      console.log(chalk.dim('No active devdomain processes or domains.'))
      return
    }

    // Kill processes
    let killed = 0
    for (const proc of processes) {
      if (killProcess(proc.pid)) {
        console.log(chalk.green(`Killed PID ${proc.pid} on port ${proc.port}`))
        killed++
      } else {
        console.error(chalk.red(`Failed to kill PID ${proc.pid} on port ${proc.port}`))
      }
    }

    // Remove all Herd/Valet proxies
    for (const proxy of proxies) {
      removeBackendProxy(backend, proxy.site)
      console.log(chalk.dim(`  Removed proxy ${proxy.domain}`))
    }

    // Remove all hosts entries
    if (!hasValetOrHerd() && hosts.length > 0) {
      await removeAllHosts()
      flushDNS()
      for (const entry of hosts) {
        console.log(chalk.dim(`  Removed ${entry.domain}`))
      }
    }

    console.log()
    console.log(chalk.dim(`${killed} processes killed, ${proxies.length + hosts.length} domains cleaned up.`))
  })

program
  .command('cleanup')
  .description('Remove all devdomain entries from hosts file')
  .action(async () => {
    try {
      await removeAllHosts()
      flushDNS()
      console.log(chalk.green('All devdomain hosts entries removed.'))
    } catch (error) {
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Treat unknown commands as implicit "dev" — e.g. `devdomain next dev` → `devdomain dev next dev`
const knownSubcommands = program.commands.map(c => c.name())
const userArgs = process.argv.slice(2)
if (userArgs.length > 0 && !knownSubcommands.includes(userArgs[0]) && !userArgs[0].startsWith('-')) {
  process.argv.splice(2, 0, 'dev')
}

program.parse()
