import { FileContent, Issue } from '../types.js'

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length
}

export function detectPatterns(file: FileContent): Issue[] {
  const issues: Issue[] = []
  const { content, lines, path } = file

  let match: RegExpExecArray | null

  // Over-verbose AI-style comments (explains what the code literally does)
  const verboseCommentRegex = /\/\/\s*(?:This (?:function|method|component|hook|class) (?:takes?|accepts?|returns?|creates?|handles?|checks?|gets?|sets?|updates?|deletes?|fetches?|renders?)|The (?:above|below|following)|Note: this)/gi
  while ((match = verboseCommentRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    issues.push({
      type: 'AI_PATTERN',
      severity: 'info',
      file: path,
      line: lineNum,
      message: 'Over-verbose comment — describes what code does, not why',
      code: lines[lineNum - 1]?.trim().slice(0, 80),
      suggestion: 'Remove or rewrite to explain WHY, not WHAT',
    })
  }

  // AI TODO leftovers
  const todoRegex = /\/\/\s*TODO:\s*(?:implement|add error|handle|fix|complete|finish|update|create)/gi
  while ((match = todoRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    issues.push({
      type: 'AI_PATTERN',
      severity: 'info',
      file: path,
      line: lineNum,
      message: 'AI-generated TODO leftover — incomplete implementation',
      code: lines[lineNum - 1]?.trim().slice(0, 80),
      suggestion: 'Implement or remove this TODO before shipping',
    })
  }

  // Generic variable names (standalone, not as props or params)
  const genericVarRegex = /\b(?:const|let|var)\s+(data|result|response|temp|obj|arr|value|item|thing|stuff|foo|bar|baz|test)\b/g
  const seenGeneric = new Set<string>()
  while ((match = genericVarRegex.exec(content)) !== null) {
    const varName = match[1]
    const lineNum = getLineNumber(content, match.index)
    const key = `${varName}:${lineNum}`
    if (!seenGeneric.has(key)) {
      seenGeneric.add(key)
      issues.push({
        type: 'AI_PATTERN',
        severity: 'info',
        file: path,
        line: lineNum,
        message: `Generic variable name "${varName}" — AI placeholder naming`,
        code: lines[lineNum - 1]?.trim().slice(0, 80),
        suggestion: `Rename to describe what it holds: userResponse, parsedConfig, etc.`,
      })
    }
  }

  // Magic numbers (not in assignments to named consts, not 0/1/2/-1)
  const magicNumberRegex = /(?<![A-Z_])\b([3-9]\d{1,}|\d{3,})\b(?!\s*[):,\]])/g
  const seenMagic = new Set<number>()
  while ((match = magicNumberRegex.exec(content)) !== null) {
    const num = parseInt(match[1])
    const lineNum = getLineNumber(content, match.index)
    const lineContent = lines[lineNum - 1] ?? ''
    const trimmed = lineContent.trim()

    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      /const\s+[A-Z_]+\s*=/.test(trimmed) ||
      /^\s*\d+:/.test(trimmed) ||
      seenMagic.has(num)
    ) continue

    seenMagic.add(num)
    issues.push({
      type: 'AI_PATTERN',
      severity: 'info',
      file: path,
      line: lineNum,
      message: `Magic number ${num} — unexplained literal value`,
      code: trimmed.slice(0, 80),
      suggestion: `Extract to named constant: const MAX_RETRY_COUNT = ${num}`,
    })
  }

  // Naming inconsistency: snake_case mixed with camelCase in same file
  const camelCaseVars = (content.match(/\b(?:const|let|var)\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g) ?? []).length
  const snakeCaseVars = (content.match(/\b(?:const|let|var)\s+([a-z][a-z0-9]*_[a-z][a-z0-9_]*)\b/g) ?? []).length

  if (camelCaseVars > 2 && snakeCaseVars > 2) {
    issues.push({
      type: 'AI_PATTERN',
      severity: 'info',
      file: path,
      line: 1,
      message: `Mixed naming conventions — ${camelCaseVars} camelCase and ${snakeCaseVars} snake_case variables in same file`,
      suggestion: 'Standardize to one convention. JS/TS convention is camelCase.',
    })
  }

  // Placeholder/stub function bodies
  const stubRegex = /\{[\s\n]*(?:\/\/\s*)?(?:TODO|FIXME|stub|placeholder|not\s+implemented|to\s+be\s+implemented)[\s\S]{0,50}\}/gi
  while ((match = stubRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    issues.push({
      type: 'AI_PATTERN',
      severity: 'warning',
      file: path,
      line: lineNum,
      message: 'Stub/placeholder function body — AI left implementation incomplete',
      code: lines[lineNum - 1]?.trim().slice(0, 80),
      suggestion: 'Implement or remove before shipping',
    })
  }

  return issues
}
