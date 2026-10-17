import { describe, expect, it } from 'vitest'
import { bytes, rate } from './format'

describe('format', () => {
  it('formats bytes', () => {
    expect(bytes(0)).toBe('0 B')
    expect(bytes(512)).toBe('512 B')
    expect(bytes(1536)).toBe('1.5 KB')
    expect(bytes(25769803776)).toBe('24.0 GB')
    expect(bytes(-5)).toBe('0 B')
    expect(bytes(NaN)).toBe('0 B')
  })
  it('formats rates', () => expect(rate(2 * 1024 * 1024)).toBe('2.0 MB/s'))
})
