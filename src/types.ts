export type Severity = 'critical' | 'warning' | 'info'

export type IssueType = 'SECURITY' | 'DUPLICATE' | 'ERROR_HANDLING' | 'AI_PATTERN'

export interface Issue {
  type: IssueType
  severity: Severity
  file: string
  line: number
  column?: number
  message: string
  code?: string
  suggestion?: string
}

export interface DetectorResult {
  issues: Issue[]
}

export interface FileContent {
  path: string
  content: string
  lines: string[]
}

export interface ScanResult {
  files: number
  issues: Issue[]
  duration: number
}

export interface ScanOptions {
  paths: string[]
  diff?: string | boolean
  json?: boolean
  severity?: Severity
  security?: boolean
  duplicates?: boolean
  errors?: boolean
  patterns?: boolean
}
