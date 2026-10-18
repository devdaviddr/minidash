# 12. HTTPS through Tailscale Serve

Status: accepted

## Context
The dashboard speaks plain HTTP and `ws://` on the network, so the access token and every metric cross it unencrypted ([security.md](../security.md)). The Mac mini is already on a Tailscale tailnet, which can terminate HTTPS for tailnet devices with certificates it issues and renews itself. A page served over HTTPS cannot open a plain `ws://` connection: browsers block it as mixed content.

## Decision
- **Publish through `tailscale serve`.** HTTPS 443 goes to the web UI (`127.0.0.1:8080`) and HTTPS 8787 to the agent (`127.0.0.1:8787`). `deploy/tailscale-https.sh on|off|status` manages it: idempotent, reversible, with a dry run.
- **The UI picks the WebSocket scheme from the page.** `agentUrl()` returns `wss://` for an HTTPS page and `ws://` for HTTP, on the same host and port 8787, unless a build-time override is set.
- **The agent allows the HTTPS origin.** The script adds the tailnet host name to `MINIDASH_ORIGINS`, keeps the env file private, and restarts the agent.
- **Tailnet only.** Funnel (the public internet) is never enabled; the script refuses it and stops if it finds it on.
- **Plain HTTP on the LAN stays** as a fallback.

## Consequences
- The token and metrics are encrypted end to end between a tailnet device and the mini, with no certificates for us to manage or renew.
- It needs Tailscale Serve (and HTTPS certificates) enabled once for the tailnet. That is an account setting only the owner can change; the script prints the link and changes nothing until it is on.
- Two more services are published by Tailscale (443 and 8787), reachable only on the tailnet.
- The Content-Security-Policy already allows `wss:`, so no container change is needed.

## Rejected alternatives
- **TLS in the agent:** key and certificate management inside a process meant to stay small and read-only.
- **Our own reverse proxy with Let's Encrypt:** certificates to renew, and port 443 on the mini is already used by Traefik.
- **Tailscale Funnel:** exposes the dashboard to the public internet, which it is not designed for.
- **Leaving it as plain HTTP and documenting the risk:** the risk was real and a safe fix was available.
