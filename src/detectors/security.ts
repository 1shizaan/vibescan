import { FileContent, Issue } from '../types.js'

function isInsideStringLiteral(line: string, matchIndex: number): boolean {
  let inString = false
  let stringChar = ''
  for (let i = 0; i < matchIndex && i < line.length; i++) {
    const ch = line[i]
    if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
      inString = true
      stringChar = ch
    } else if (inString && ch === stringChar && line[i - 1] !== '\\') {
      inString = false
    }
  }
  return inString
}

interface SecurityPattern {
  name: string
  regex: RegExp
  message: string
  suggestion: string
  severity: Issue['severity']
}

const PATTERNS: SecurityPattern[] = [
  {
    name: 'sql-injection-concat',
    regex: /["'`]\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\s[^"'`]*["'`]\s*\+/gi,
    message: 'SQL injection risk — string concatenation in query',
    suggestion: 'Use parameterized queries or prepared statements',
    severity: 'critical',
  },
  {
    name: 'sql-injection-template',
    regex: /`\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s[^`]*\$\{[^}]+\}/gi,
    message: 'SQL injection risk — template literal interpolation in query',
    suggestion: 'Use parameterized queries: db.query("SELECT ... WHERE id = $1", [id])',
    severity: 'critical',
  },
  {
    name: 'hardcoded-secret',
    regex: /(?:password|passwd|secret|api_key|apikey|access_token|auth_token|private_key|client_secret)\s*[:=]\s*["'][^"']{4,}["']/gi,
    message: 'Hardcoded secret — credential value in source code',
    suggestion: 'Move to environment variables: process.env.SECRET_KEY',
    severity: 'critical',
  },
  {
    name: 'xss-innerhtml',
    regex: /\.innerHTML\s*=\s*(?!["'`]|["'`])/g,
    message: 'XSS risk — innerHTML assigned from variable',
    suggestion: 'Use textContent for plain text, or sanitize with DOMPurify before innerHTML',
    severity: 'critical',
  },
  {
    name: 'xss-dangerouslysetinnerhtml',
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html\s*:/g,
    message: 'XSS risk — dangerouslySetInnerHTML without apparent sanitization',
    suggestion: 'Wrap value with DOMPurify.sanitize() before passing to __html',
    severity: 'critical',
  },
  {
    name: 'command-injection',
    regex: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:[^"'`\)]*\+|`[^`]*\$\{)/g,
    message: 'Command injection risk — user input in shell command',
    suggestion: 'Pass args as array to spawn(), never concatenate user input into shell strings',
    severity: 'critical',
  },
  {
    name: 'eval-usage',
    regex: /\beval\s*\(/g,
    message: 'eval() usage detected — arbitrary code execution risk',
    suggestion: 'Replace eval() with safer alternatives like JSON.parse() or Function constructors',
    severity: 'critical',
  },
  {
    name: 'nosql-injection',
    regex: /\$where\s*:|(?:find|findOne|findMany)\s*\(\s*req\.(?:body|query|params)/g,
    message: 'NoSQL injection risk — raw request data used in query',
    suggestion: 'Validate and sanitize input before passing to database queries',
    severity: 'critical',
  },
  {
    name: 'path-traversal',
    regex: /(?:readFile|writeFile|readdir|createReadStream)\s*\([^)]*req\.(?:body|query|params)/g,
    message: 'Path traversal risk — user input used in file path',
    suggestion: 'Use path.resolve() and validate the result stays within allowed directory',
    severity: 'critical',
  },
  {
    name: 'missing-auth-route',
    regex: /app\.(?:get|post|put|delete|patch)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(?:async\s*)?\(?(?:req|request)\b/g,
    message: 'Route handler without visible auth middleware',
    suggestion: 'Add auth middleware: app.get("/route", authMiddleware, handler)',
    severity: 'warning',
  },
  {
    name: 'http-not-https',
    regex: /(?:axios|fetch|http\.get|http\.post|request)\s*\(\s*["'`]http:\/\//g,
    message: 'HTTP used instead of HTTPS — data sent unencrypted',
    suggestion: 'Use HTTPS for all external requests',
    severity: 'warning',
  },
]

export function detectSecurity(file: FileContent): Issue[] {
  const issues: Issue[] = []

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(file.content)) !== null) {
      const lineNumber = file.content.substring(0, match.index).split('\n').length
      const lineContent = file.lines[lineNumber - 1]?.trim() ?? ''
      const rawLine = file.lines[lineNumber - 1] ?? ''
      const colInLine = match.index - file.content.lastIndexOf('\n', match.index - 1) - 1

      if (lineContent.startsWith('//') || lineContent.startsWith('*')) continue
      if (isInsideStringLiteral(rawLine, colInLine)) continue

      issues.push({
        type: 'SECURITY',
        severity: pattern.severity,
        file: file.path,
        line: lineNumber,
        message: pattern.message,
        code: lineContent.length > 80 ? lineContent.slice(0, 80) + '…' : lineContent,
        suggestion: pattern.suggestion,
      })
    }
  }

  return issues
}
