import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import fg from 'fast-glob'
import { FileContent, Issue, ScanOptions, ScanResult } from './types.js'
import { detectSecurity, detectErrors, detectPatterns, detectDuplicates } from './detectors/index.js'

const JS_TS_EXTENSIONS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs']
const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/*.d.ts', '**/*.min.js']

function readFile(filePath: string): FileContent | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return {
      path: filePath,
      content,
      lines: content.split('\n'),
    }
  } catch {
    return null
  }
}

function getFilesFromPaths(paths: string[]): string[] {
  const files: string[] = []

  for (const p of paths) {
    const resolved = path.resolve(p)
    if (!fs.existsSync(resolved)) continue

    const stat = fs.statSync(resolved)
    if (stat.isFile()) {
      files.push(resolved)
    } else if (stat.isDirectory()) {
      const found = fg.sync(JS_TS_EXTENSIONS, {
        cwd: resolved,
        absolute: true,
        ignore: IGNORE_PATTERNS,
      })
      files.push(...found)
    }
  }

  return [...new Set(files)]
}

function getFilesFromDiff(ref?: string): string[] {
  try {
    const cmd = ref && ref !== 'true'
      ? `git diff --name-only ${ref}`
      : 'git diff --name-only HEAD'

    const output = execSync(cmd, { encoding: 'utf-8' }).trim()
    if (!output) return []

    return output
      .split('\n')
      .map(f => path.resolve(f))
      .filter(f => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) && fs.existsSync(f))
  } catch {
    // Fall back to staged diff
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim()
      return output
        .split('\n')
        .map(f => path.resolve(f))
        .filter(f => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) && fs.existsSync(f))
    } catch {
      return []
    }
  }
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const start = Date.now()

  let filePaths: string[]

  if (options.diff !== undefined) {
    filePaths = getFilesFromDiff(typeof options.diff === 'string' ? options.diff : undefined)
  } else {
    filePaths = getFilesFromPaths(options.paths.length > 0 ? options.paths : ['.'])
  }

  const fileContents = filePaths
    .map(readFile)
    .filter((f): f is FileContent => f !== null)

  const issues: Issue[] = []

  for (const file of fileContents) {
    if (options.security !== false) {
      issues.push(...detectSecurity(file))
    }
    if (options.errors !== false) {
      issues.push(...detectErrors(file))
    }
    if (options.patterns !== false) {
      issues.push(...detectPatterns(file))
    }
  }

  if (options.duplicates !== false) {
    issues.push(...detectDuplicates(fileContents))
  }

  // Apply severity filter
  const filtered = options.severity
    ? issues.filter(i => {
        const order = { critical: 3, warning: 2, info: 1 }
        return order[i.severity] >= order[options.severity!]
      })
    : issues

  // Sort: critical first, then by file, then by line
  filtered.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    if (a.file !== b.file) return a.file.localeCompare(b.file)
    return a.line - b.line
  })

  return {
    files: fileContents.length,
    issues: filtered,
    duration: Date.now() - start,
  }
}
