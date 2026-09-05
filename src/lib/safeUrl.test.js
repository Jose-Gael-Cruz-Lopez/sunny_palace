import { describe, it, expect } from 'vitest'
import { safeHttpUrl } from './safeUrl'

// Smoke tests for the HIGH-2 URL sanitizer (issue #81): safeHttpUrl gates every
// user-submitted link rendered as an href across the app, so a regression here
// is a stored-XSS risk, not just a broken link.
describe('safeHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(safeHttpUrl('https://example.com')).toBe('https://example.com')
    expect(safeHttpUrl('http://example.com/path?x=1')).toBe('http://example.com/path?x=1')
  })

  it('trims surrounding whitespace on an otherwise valid URL', () => {
    expect(safeHttpUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('rejects dangerous schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHttpUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeHttpUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects relative and protocol-relative URLs', () => {
    expect(safeHttpUrl('/some/path')).toBeNull()
    expect(safeHttpUrl('//example.com')).toBeNull()
    expect(safeHttpUrl('example.com')).toBeNull()
  })

  it('rejects empty, non-string, and unparseable input', () => {
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl('   ')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
    expect(safeHttpUrl(42)).toBeNull()
    expect(safeHttpUrl('not a url at all')).toBeNull()
  })
})
