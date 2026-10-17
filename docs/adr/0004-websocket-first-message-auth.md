# 4. WebSocket with first-message token auth

Status: accepted

## Context
The dashboard is reachable on the LAN and shows process names, shares and accounts, so every stream needs authentication. Browsers cannot set custom headers on a WebSocket, and the UI is served from a different origin than the agent.

## Decision
Stream snapshots over WebSocket. The client must send `{"type":"auth","token":"..."}` as its **first message** within 5 seconds. The agent compares the token in constant time, closes with code 1008 on failure, and only then subscribes the client. The upgrade also checks `Origin` against an allow-list.

## Consequences
- The token never appears in a URL, so it stays out of access logs, browser history and referrers.
- An unauthenticated client receives no data, ever.
- The browser treats 1008 as "unauthorized" and stops retrying.
- The origin check blocks other websites from opening the socket from a visitor's browser. The token is still required either way.
- The token crosses the LAN in clear text over `ws://`. This is a known limit: use Tailscale (encrypted) or terminate TLS in front of the agent. See [security.md](../security.md).

## Rejected alternatives
- **Token in the query string:** leaks into logs and history.
- **Token in `Sec-WebSocket-Protocol`:** works, but is a header misuse that proxies may log.
- **Server-Sent Events:** one-way and fine for streaming, but cannot carry the auth message and needs a header or cookie scheme.
- **Cookie sessions:** adds login state and CSRF concerns for a single shared secret.
