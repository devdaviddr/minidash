/** Port the agent listens on. */
export const AGENT_PORT = 8787

/**
 * The agent's HTTP base (for /history and /healthz), derived the same way as the stream URL:
 * over HTTPS the agent is on the page origin; over plain HTTP it is on its own port.
 */
export function agentHttpBase(loc: Pick<Location, 'protocol' | 'hostname'>, override?: string): string {
  if (override) return override.replace(/^wss?:\/\//, 'http://').replace(/^ws:/, 'http:')
  if (loc.protocol === 'https:') return `https://${loc.hostname}`
  return `http://${loc.hostname}:${AGENT_PORT}`
}

/**
 * Where the browser should open the agent's stream.
 * Over plain HTTP (the LAN) the page talks to the agent's own port. Over HTTPS (Tailscale Serve) the stream is
 * on the page's own origin at `/ws`: browsers refuse `ws://` from an HTTPS page, and serving the agent on its
 * own port over HTTPS would collide with the agent's listener on that port (ADR 0016).
 * A build-time override, when set, is used as given.
 */
export function agentUrl(loc: Pick<Location, 'protocol' | 'hostname'>, override?: string): string {
  if (override) return override
  if (loc.protocol === 'https:') return `wss://${loc.hostname}/ws`
  return `ws://${loc.hostname}:${AGENT_PORT}/ws`
}
