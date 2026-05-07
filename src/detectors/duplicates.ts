import { FileContent, Issue } from '../types.js'

interface FunctionEntry {
  file: string
  line: number
  name: string
  normalizedBody: string
  tokens: Set<string>
  rawSnippet: string
}

function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0
}

function normalizeBody(body: string): string {
  return body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/["'`][^"'`]*["'`]/g, '"STR"')
    .replace(/\b\d+\b/g, 'NUM')
    .replace(/\b(?:const|let|var)\s+\w+/g, 'VAR')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function tokenize(normalized: string): Set<string> {
  return new Set(normalized.split(/\W+/).filter(t => t.length > 2))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function extractFunctions(file: FileContent): FunctionEntry[] {
  const entries: FunctionEntry[] = []
  const { content, lines, path } = file

  // Match named functions and arrow functions assigned to variables
  const fnRegex = /(?:(?:async\s+)?function\s+(\w+)\s*\([^)]*\)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)\s*\{/g
  let match: RegExpExecArray | null

  while ((match = fnRegex.exec(content)) !== null) {
    const name = match[1] ?? match[2] ?? 'anonymous'
    const lineNum = content.substring(0, match.index).split('\n').length

    // Extract function body
    let depth = 0
    let bodyStart = content.indexOf('{', match.index + match[0].length - 1)
    if (bodyStart === -1) continue

    let bodyEnd = bodyStart
    for (let i = bodyStart; i < Math.min(content.length, bodyStart + 5000); i++) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') {
        depth--
        if (depth === 0) { bodyEnd = i; break }
      }
    }

    const body = content.slice(bodyStart + 1, bodyEnd)
    if (body.length < 30) continue  // Skip trivial one-liners

    const normalized = normalizeBody(body)
    if (normalized.length < 20) continue

    entries.push({
      file: path,
      line: lineNum,
      name,
      normalizedBody: normalized,
      tokens: tokenize(normalized),
      rawSnippet: lines[lineNum - 1]?.trim().slice(0, 80) ?? '',
    })
  }

  return entries
}

function relativePath(filePath: string): string {
  return filePath.replace(process.cwd() + '/', '')
}

export function detectDuplicates(files: FileContent[]): Issue[] {
  const issues: Issue[] = []
  const allFunctions: FunctionEntry[] = []

  for (const file of files) {
    allFunctions.push(...extractFunctions(file))
  }

  if (allFunctions.length < 2) return issues

  // Group by hash first (exact duplicates)
  const hashGroups = new Map<number, FunctionEntry[]>()
  for (const fn of allFunctions) {
    const hash = djb2Hash(fn.normalizedBody)
    if (!hashGroups.has(hash)) hashGroups.set(hash, [])
    hashGroups.get(hash)!.push(fn)
  }

  const reported = new Set<string>()

  for (const [, group] of hashGroups) {
    if (group.length < 2) continue
    const primary = group[0]
    for (let i = 1; i < group.length; i++) {
      const dup = group[i]
      const key = `${primary.file}:${primary.line}:${dup.file}:${dup.line}`
      if (reported.has(key)) continue
      reported.add(key)

      issues.push({
        type: 'DUPLICATE',
        severity: 'warning',
        file: dup.file,
        line: dup.line,
        message: `Exact duplicate of \`${relativePath(primary.file)}:${primary.line}\` (${primary.name})`,
        code: dup.rawSnippet,
        suggestion: 'Extract to shared utility function',
      })
    }
  }

  // Near-duplicate detection with Jaccard similarity (>80%)
  for (let i = 0; i < allFunctions.length; i++) {
    for (let j = i + 1; j < allFunctions.length; j++) {
      const a = allFunctions[i]
      const b = allFunctions[j]

      // Skip if already exact duplicates or same file same function
      if (a.file === b.file && a.line === b.line) continue
      if (djb2Hash(a.normalizedBody) === djb2Hash(b.normalizedBody)) continue

      const similarity = jaccardSimilarity(a.tokens, b.tokens)
      if (similarity < 0.8) continue

      const key = `${a.file}:${a.line}:${b.file}:${b.line}`
      const reverseKey = `${b.file}:${b.line}:${a.file}:${a.line}`
      if (reported.has(key) || reported.has(reverseKey)) continue
      reported.add(key)

      const pct = Math.round(similarity * 100)
      issues.push({
        type: 'DUPLICATE',
        severity: 'warning',
        file: b.file,
        line: b.line,
        message: `${pct}% similar to \`${relativePath(a.file)}:${a.line}\` (${a.name})`,
        code: b.rawSnippet,
        suggestion: 'Consider merging into a shared parameterized function',
      })
    }
  }

  return issues
}
