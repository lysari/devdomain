#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import devdomain from '../index.js'
import { detectDevCommand } from '../core/runner.js'
import { removeAllHosts, listHosts, flushDNS } from '../core/hosts.js'
import { setupMkcert } from '../core/cert.js'
import { detectBackend } from '../core/detect.js'

const program = new Command()

program
  .name('devdomain')
  .description('Give your dev server a clean .test domain')
  .version('1.0.0')

program
  .command('dev', { isDefault: true })
  .description('Start your dev server with a .test domain')
  .argument('[command...]', 'Dev server command (e.g. vite, next dev)')
  .option('-d, --domain <domain>', 'Custom domain (e.g. dashboard.test)')
  .option('--https', 'Enable trusted HTTPS with mkcert')
  .option('--clean', 'Hide port using reverse proxy (requires sudo)')
  .option('--port-range <range>', 'Custom port range (e.g. 5000-9000)')
  .option('--open', 'Auto-open browser')
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
        command,
        args,
        portRange,
        open: opts.open,
      })

      console.log()
      console.log(chalk.bold.green('  devdomain'))
      console.log()
      console.log(`  ${chalk.dim('Domain:')}   ${chalk.cyan(result.domain)}`)
      console.log(`  ${chalk.dim('Port:')}     ${chalk.yellow(String(result.port))}`)
      console.log(`  ${chalk.dim('URL:')}      ${chalk.bold.underline(result.url)}`)
      console.log(`  ${chalk.dim('Internal:')} ${result.internalUrl}`)
      if (opts.https) {
        console.log(`  ${chalk.dim('HTTPS:')}   ${chalk.green('trusted (mkcert)')}`)
      }
      if (opts.clean) {
        const backend = detectBackend()
        const via = backend === 'herd' ? 'Herd' : backend === 'valet' ? 'Valet' : 'reverse proxy'
        console.log(`  ${chalk.dim('Mode:')}    ${chalk.green(`clean (${via})`)}`)
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

program.parse()
