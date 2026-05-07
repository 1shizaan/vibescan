#!/usr/bin/env node
import { Command } from 'commander'
import * as path from 'path'
import { scan } from './scanner.js'
import { reportTerminal, reportJson } from './reporter.js'
import { ScanOptions, Severity } from './types.js'

const program = new Command()

program
  .name('vibescan')
  .description('Audit AI-generated code for security issues, duplicates, and vibe coding patterns')
  .version('0.1.0')
  .argument('[paths...]', 'Files or directories to scan (default: current directory)')
  .option('--diff [ref]', 'Scan git diff instead of files (optionally specify git ref like HEAD~1)')
  .option('--json', 'Output results as JSON')
  .option('--severity <level>', 'Minimum severity to report: critical | warning | info', 'info')
  .option('--no-security', 'Disable security detector')
  .option('--no-duplicates', 'Disable duplicate detector')
  .option('--no-errors', 'Disable error handling detector')
  .option('--no-patterns', 'Disable AI pattern detector')
  .action(async (paths: string[], opts) => {
    const validSeverities: Severity[] = ['critical', 'warning', 'info']
    if (!validSeverities.includes(opts.severity)) {
      process.stderr.write(`Error: --severity must be one of: critical, warning, info\n`)
      process.exit(2)
    }

    const options: ScanOptions = {
      paths: paths.map(p => path.resolve(p)),
      diff: opts.diff,
      json: opts.json ?? false,
      severity: opts.severity as Severity,
      security: opts.security,
      duplicates: opts.duplicates,
      errors: opts.errors,
      patterns: opts.patterns,
    }

    try {
      const result = await scan(options)

      if (options.json) {
        reportJson(result)
      } else {
        await reportTerminal(result, process.cwd())
      }

      const hasCritical = result.issues.some(i => i.severity === 'critical')
      const hasIssues = result.issues.length > 0
      process.exit(hasCritical ? 2 : hasIssues ? 1 : 0)
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(2)
    }
  })

program.parse()
