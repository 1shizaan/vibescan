# VibeScan

Audit AI-generated code before it ships. Catches security issues, duplicate logic, missing error handling, and AI vibe-coding patterns.

```
VibeScan v0.1.0  Scanned 23 files

  CRITICAL  SECURITY     src/api/users.ts:45      SQL injection — string concat in query
  CRITICAL  SECURITY     src/utils/auth.ts:12     Hardcoded secret — password = "admin123"
  WARNING   ERRORS       src/hooks/useData.ts:15  async function missing try/catch
  WARNING   DUPLICATE    src/api/posts.ts:23      Exact duplicate of src/api/comments.ts:67
  INFO      AI-PATTERN   src/components/Card.tsx  Over-verbose comment pattern detected

  5 issues  2 critical · 1 warning · 2 info  in 340ms
```

## Install

```bash
npm install -g vibescan
# or use without installing:
npx vibescan .
```

## Usage

```bash
vibescan .                    # scan current directory
vibescan src/                 # scan specific folder
vibescan --diff               # scan git diff (staged + unstaged)
vibescan --diff HEAD~1        # scan last commit's changes
vibescan --json               # JSON output for CI pipelines
vibescan --severity critical  # only show critical issues
vibescan --no-patterns        # disable AI pattern detector
vibescan --no-duplicates      # disable duplicate detector
vibescan --no-security        # disable security checks
vibescan --no-errors          # disable error handling checks
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No issues found |
| 1 | Issues found (warnings/info only) |
| 2 | Critical issues found |

## Detectors

### SECURITY — OWASP Top 10
- SQL injection via string concatenation or template literals
- Hardcoded passwords, API keys, tokens, secrets
- XSS via `innerHTML` assignment or `dangerouslySetInnerHTML`
- Command injection via `exec`/`spawn` with string concat
- NoSQL injection from raw request body in queries
- Path traversal via user input in file paths
- HTTP instead of HTTPS in fetch/axios calls
- Route handlers without auth middleware

### ERROR_HANDLING
- `async` functions without `try/catch`
- `.then()` without `.catch()`
- `fetch()` without error handling
- `fs` sync operations outside try/catch
- `JSON.parse()` outside try/catch

### DUPLICATE
- Exact duplicate function bodies (hash-based)
- Near-duplicate functions >80% similar (Jaccard token similarity)

### AI_PATTERN
- Over-verbose comments that restate what code does
- Generic variable names (`data`, `result`, `temp`, `response`)
- AI-generated TODO leftovers
- Mixed camelCase + snake_case naming
- Unexplained magic numbers

## CI Integration

Add to your CI pipeline:

```yaml
# GitHub Actions
- name: VibeScan
  run: npx vibescan --diff ${{ github.event.before }} --severity warning --json > vibescan.json
```

```bash
# Pre-push hook
npx vibescan --diff HEAD~1 --severity critical
```

## Roadmap

- [ ] GitHub Action wrapper
- [ ] VS Code extension
- [ ] AST-based detection (v2, fewer false positives)
- [ ] Custom rule configuration (`.vibescanrc`)
- [ ] Baseline mode (ignore existing issues, only flag new ones)
- [ ] Python + Go support

## License

MIT
