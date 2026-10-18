/** Port the agent listens on. */
export const AGENT_PORT = 8787

/**
 * Where the browser should open the agent's stream.
 * Browsers refuse a plain `ws://` connection from an HTTPS page (mixed content), so a page served over HTTPS
 * (for example through Tailscale Serve) must use `wss://`. A build-time override, when set, is used as given.
 */
export function agentUrl(loc: Pick<Location, 'protocol' | 'hostname'>, override?: string): string {
  if (override) return override
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${loc.hostname}:${AGENT_PORT}/ws`
}
