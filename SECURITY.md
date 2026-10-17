# Security policy

## Supported versions
Only the latest commit on `main` is supported.

## Reporting a vulnerability
Please **do not open a public issue** for a security problem.

Report it privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting). Include what you found, how to reproduce it, and the impact you see. Do not include real tokens or private network details.

You can expect an acknowledgement within a few days. Fixes are developed in private and released with credit to you, if you want it.

## Scope
In scope: the agent, the web UI and container, the install scripts and the wire protocol.

Known limitations that are documented rather than vulnerabilities (plain HTTP/`ws://` on the LAN, one shared token, no authentication rate limit, unauthenticated `/healthz`) are listed in [docs/security.md](docs/security.md#known-limitations). Reports that go beyond them are welcome.

## Design summary
Read-only agent, token required before any data, origin-checked WebSocket, unprivileged read-only container with a strict Content-Security-Policy. See [docs/security.md](docs/security.md).
