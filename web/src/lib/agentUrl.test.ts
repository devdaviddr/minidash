import { describe, expect, it } from 'vitest'
import { agentUrl } from './agentUrl'

const at = (protocol: string, hostname: string) => ({ protocol, hostname })

// AC-22
describe('agentUrl', () => {
  it('uses ws:// when the page is served over HTTP', () => {
    expect(agentUrl(at('http:', '192.168.0.108'))).toBe('ws://192.168.0.108:8787/ws')
    expect(agentUrl(at('http:', 'mini.local'))).toBe('ws://mini.local:8787/ws')
  })
  it('uses wss:// when the page is served over HTTPS (browsers block ws:// there)', () => {
    expect(agentUrl(at('https:', 'frank.tail7c4fd8.ts.net'))).toBe('wss://frank.tail7c4fd8.ts.net:8787/ws')
  })
  it('uses the same host as the page, so the stream and the page agree', () => {
    expect(agentUrl(at('https:', 'a.example'))).toContain('//a.example:')
  })
  it('handles IPv6 literals, which the browser reports with brackets', () => {
    expect(agentUrl(at('http:', '[fd7a::1]'))).toBe('ws://[fd7a::1]:8787/ws')
  })
  it('uses a build-time override exactly as given, whatever the page scheme', () => {
    expect(agentUrl(at('https:', 'x'), 'ws://agent.lan:9000/ws')).toBe('ws://agent.lan:9000/ws')
    expect(agentUrl(at('http:', 'x'), 'wss://agent.example/stream')).toBe('wss://agent.example/stream')
  })
  it('ignores an empty override', () => expect(agentUrl(at('http:', 'x'), '')).toBe('ws://x:8787/ws'))
  it('treats anything but https: as plain', () => expect(agentUrl(at('file:', 'x'))).toBe('ws://x:8787/ws'))
})
