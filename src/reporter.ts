import { Issue, ScanResult, Severity } from './types.js'

// Chalk is ESM-only in v5, so we lazy-import it
async function getChalk() {
  const { default: chalk } = await import('chalk')
  return chalk
}

const TYPE_LABELS: Record<Issue['type'], string> = {
  SECURITY: 'SECURITY',
  DUPLICATE: 'DUPLICATE',
  ERROR_HANDLING: 'ERRORS',
  AI_PATTERN: 'AI-PATTERN',
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export async function reportTerminal(result: ScanResult, cwd: string): Promise<void> {
  const chalk = await getChalk()

  const severityColor = {
    critical: chalk.red.bold,
    warning: chalk.yellow,
    info: chalk.cyan,
  }

  const typeColor: Record<Issue['type'], (s: string) => string> = {
    SECURITY: chalk.red.bold,
    DUPLICATE: chalk.magenta,
    ERROR_HANDLING: chalk.yellow,
    AI_PATTERN: chalk.cyan,
  }

  const critical = result.issues.filter(i => i.severity === 'critical').length
  const warning = result.issues.filter(i => i.severity === 'warning').length
  const info = result.issues.filter(i => i.severity === 'info').length

  // Header
  process.stdout.write('\n')
  process.stdout.write(
    chalk.bold.white('VibeScan') +
    chalk.dim(' v0.1.0') +
    '  ' +
    chalk.dim(`Scanned ${result.files} file${result.files !== 1 ? 's' : ''}`) +
    '\n\n'
  )

  if (result.issues.length === 0) {
    process.stdout.write(chalk.green.bold('  ✓ No issues found') + '\n\n')
    return
  }

  for (const issue of result.issues) {
    const relPath = issue.file.replace(cwd + '/', '')
    const location = chalk.dim(`${relPath}:${issue.line}`)
    const label = typeColor[issue.type](TYPE_LABELS[issue.type].padEnd(11))
    const sev = severityColor[issue.severity](issue.severity.toUpperCase().padEnd(8))

    process.stdout.write(`  ${sev}  ${label}  ${location}\n`)
    process.stdout.write(`            ${chalk.white(issue.message)}\n`)

    if (issue.code) {
      process.stdout.write(`            ${chalk.dim('›')} ${chalk.gray(issue.code)}\n`)
    }
    if (issue.suggestion) {
      process.stdout.write(`            ${chalk.dim('⚑')} ${chalk.dim(issue.suggestion)}\n`)
    }
    process.stdout.write('\n')
  }

  // Summary line
  const parts: string[] = []
  if (critical > 0) parts.push(chalk.red.bold(`${critical} critical`))
  if (warning > 0) parts.push(chalk.yellow(`${warning} warning${warning !== 1 ? 's' : ''}`))
  if (info > 0) parts.push(chalk.cyan(`${info} info`))

  const total = chalk.bold(`${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''}`)
  process.stdout.write(`  ${total}  ${parts.join(chalk.dim(' · '))}  ${chalk.dim(formatDuration(result.duration))}\n\n`)
}

export function reportJson(result: ScanResult): void {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}
