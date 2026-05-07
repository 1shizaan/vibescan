import { FileContent, Issue } from '../types.js'

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length
}

function getLineAt(lines: string[], lineNum: number): string {
  return lines[lineNum - 1]?.trim() ?? ''
}

export function detectErrors(file: FileContent): Issue[] {
  const issues: Issue[] = []
  const { content, lines, path } = file

  // Async function without try/catch
  const asyncFnRegex = /async\s+(?:function\s+\w+|\w+\s*=\s*async|\(\s*[^)]*\)\s*=>)\s*\{/g
  let match: RegExpExecArray | null

  while ((match = asyncFnRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    const lineContent = getLineAt(lines, lineNum)
    if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue

    // Find function body extent (simple brace counting)
    let depth = 0
    let bodyStart = content.indexOf('{', match.index + match[0].length - 1)
    if (bodyStart === -1) continue

    let bodyEnd = bodyStart
    for (let i = bodyStart; i < Math.min(content.length, bodyStart + 3000); i++) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') {
        depth--
        if (depth === 0) { bodyEnd = i; break }
      }
    }

    const body = content.slice(bodyStart, bodyEnd)

    if (!body.includes('try {') && !body.includes('try{')) {
      issues.push({
        type: 'ERROR_HANDLING',
        severity: 'warning',
        file: path,
        line: lineNum,
        message: 'async function missing try/catch — unhandled rejection will crash',
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: 'Wrap async body in try/catch or add .catch() to awaited promises',
      })
    }
  }

  // .then() without .catch()
  const thenRegex = /\.then\s*\(/g
  while ((match = thenRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    const lineContent = getLineAt(lines, lineNum)
    if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue

    // Look ahead 200 chars for .catch
    const lookahead = content.slice(match.index, match.index + 300)
    if (!lookahead.includes('.catch(') && !lookahead.includes('.catch (')) {
      issues.push({
        type: 'ERROR_HANDLING',
        severity: 'warning',
        file: path,
        line: lineNum,
        message: '.then() without .catch() — rejected promise silently swallowed',
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: 'Chain .catch(err => ...) or use async/await with try/catch',
      })
    }
  }

  // fetch() without error handling
  const fetchRegex = /\bfetch\s*\(/g
  while ((match = fetchRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    const lineContent = getLineAt(lines, lineNum)
    if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue

    const context = content.slice(Math.max(0, match.index - 200), match.index + 400)
    const hasTry = /try\s*\{/.test(context)
    const hasCatch = /\.catch\s*\(/.test(context.slice(200))

    if (!hasTry && !hasCatch) {
      issues.push({
        type: 'ERROR_HANDLING',
        severity: 'warning',
        file: path,
        line: lineNum,
        message: 'fetch() without error handling — network failures not caught',
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: 'Check response.ok and wrap in try/catch for network errors',
      })
    }
  }

  // Synchronous fs operations outside try/catch
  const fsRegex = /\bfs\.(?:readFileSync|writeFileSync|unlinkSync|mkdirSync|readdirSync)\s*\(/g
  while ((match = fsRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    const lineContent = getLineAt(lines, lineNum)
    if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue

    const context = content.slice(Math.max(0, match.index - 300), match.index)
    if (!/try\s*\{[^}]*$/.test(context)) {
      issues.push({
        type: 'ERROR_HANDLING',
        severity: 'warning',
        file: path,
        line: lineNum,
        message: 'Synchronous fs operation outside try/catch — throws on missing file/permission error',
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: 'Wrap fs sync calls in try/catch or use async alternatives with error handling',
      })
    }
  }

  // JSON.parse without try/catch
  const jsonParseRegex = /\bJSON\.parse\s*\(/g
  while ((match = jsonParseRegex.exec(content)) !== null) {
    const lineNum = getLineNumber(content, match.index)
    const lineContent = getLineAt(lines, lineNum)
    if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue

    const context = content.slice(Math.max(0, match.index - 300), match.index)
    if (!/try\s*\{[^}]*$/.test(context)) {
      issues.push({
        type: 'ERROR_HANDLING',
        severity: 'warning',
        file: path,
        line: lineNum,
        message: 'JSON.parse() outside try/catch — throws SyntaxError on malformed input',
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: 'Wrap in try/catch or use a safe parse helper',
      })
    }
  }

  return issues
}
