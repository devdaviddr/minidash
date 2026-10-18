# 16. Serve the stream on the page's origin over HTTPS

Status: accepted. Supersedes the agent-port part of [ADR 0012](0012-https-through-tailscale-serve.md); Tailscale Serve, tailnet only, still stands.

## Context
ADR 0012 served the UI on HTTPS 443 and the agent on HTTPS 8787, and the page connected with `wss://<host>:8787/ws`. The first live run on the Mac mini (2026-10-18) showed that this cannot work: `tailscale serve --https=8787` listens on the machine's tailnet address at port 8787, the agent listens on port 8787 on every address, and the script restarts the agent to load the new origin. The restarted agent could not bind (`address already in use`) and launchd kept restarting it, so the dashboard went down for LAN users too until the serve was removed. No automated test could see it, because the script's tests stub `tailscale`.

## Decision
- Over HTTPS the page opens its stream on its own origin: `wss://<host>/ws`. Tailscale Serve routes `/` to the UI (127.0.0.1:8080) and `/ws` to the agent (127.0.0.1:8787/ws), both on 443.
- Nothing is served on the agent's port. `deploy/tailscale-https.sh on` also removes a serve on 8787 left by an older version.
- Over plain HTTP (the LAN) nothing changes: `ws://<host>:8787/ws`.
- A build-time `VITE_AGENT_URL` still overrides both.

Checked live: a client on the tailnet received snapshots over `wss://<host>/ws` while the agent kept port 8787.

## Consequences
- One port and one certificate for HTTPS. The stream is same-origin, so the agent's origin check sees the page's own host.
- The agent stays free to listen on all interfaces, which the LAN needs.
- This changes the HTTPS stream URL in spec FR-22/AC-22 (0.4.0 onwards). The change ships as hotfix 0.6.2 because the feature as specified could not work; the next spec carries the amended FR-22.

## Rejected alternatives
- **Bind the agent to the LAN address and loopback only:** the LAN address comes from DHCP and can change, and the agent takes one listen address.
- **Serve the agent on another HTTPS port (for example 8443):** works, but adds a second port and certificate use for no benefit over a path on 443.
