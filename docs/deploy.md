# Deploying on the Mac mini

Two parts, because a container on macOS runs in a Linux VM and cannot see the Mac's real CPU, GPU, disks or shares (plan DD-4):

| Part | Runs as | Why |
| --- | --- | --- |
| **Agent** (`minidash-agent`) | native, per-user launchd service | reads host metrics and your Docker/Colima/Podman sockets |
| **Web UI** | container, port 8080 | static files behind nginx |

## 1. Agent
Prerequisites: `brew install macmon go` (Go only to build; a prebuilt `bin/minidash-agent` also works).

```sh
deploy/install-agent.sh install --dry-run   # show what it will do
deploy/install-agent.sh install
grep MINIDASH_TOKEN ~/.config/minidash/agent.env   # the access token
```

The installer builds the agent into `~/.local/share/minidash/`, writes `~/.config/minidash/agent.env` (mode 600, random token, kept on re-runs), installs `~/Library/LaunchAgents/com.minidash.agent.plist` and starts it. It runs as you, not root, so no privileged access is involved. Logs: `~/Library/Logs/minidash/agent.log`.

Settings live in the env file; see [stream-protocol.md](stream-protocol.md#agent-configuration). After editing it: `launchctl kickstart -k gui/$(id -u)/com.minidash.agent`.

Remove with `deploy/install-agent.sh uninstall` (your token file is kept).

The agent listens on all interfaces (`:8787`) because the dashboard is meant for the LAN. Every WebSocket must authenticate with the token, and the agent will not start without one. Do not port-forward it to the internet.

## 2. Web UI container
```sh
docker compose -f deploy/compose.yaml up -d --build     # works with Docker, Colima or Podman
```
Open `http://<mini>:8080`, enter the token once. The page connects to `ws://<same host>:8787/ws`. If the UI is served from a different host than the agent, build with `VITE_AGENT_URL=ws://host:8787/ws` and add that origin to `MINIDASH_ORIGINS`.

The container is read-only, drops all capabilities and runs unprivileged (`nginx-unprivileged`). It holds no secrets: the token stays in your browser.

## Verification status
Deployed to the Mac mini (M4, macOS 26.4, 693 processes, 14 Podman containers) and tested over the LAN from another Mac:
- All eight collectors report `ok`. The external Media drive shows as external; Podman shows its containers; Colima and Docker read "not-running" (Docker's socket resolves to Podman's and is counted once).
- A wrong token is closed with 1008. WebSocket origins from the UI's host are accepted; other origins are refused at the handshake.
- The container is read-only, unprivileged (uid 101), drops capabilities, and every response carries the CSP and related headers.
- Killing the agent: launchd restarts it in about a second and the stream resumes.
- CPU on the mini: agent about 1.3% plus `macmon` about 0.35%, total about 1.65% of one core (budget: 2%).

Still needs a human: the GPU-load check (AC-2) and the visual review of the UI in a browser.

## Manual acceptance checks (need the real mini)
1. Open the UI from another device on the LAN: values update every second (AC-1, AC-4).
2. Stop the agent (`launchctl bootout gui/$(id -u)/com.minidash.agent`): the UI shows "disconnected" within 5 s; start it again (`launchctl bootstrap ...`): it recovers without a reload (AC-8).
3. Run a GPU-heavy app: GPU % and power rise (AC-2).
4. Eject the external drive: it disappears; plug it in: it returns (AC-3).
5. Start Colima: it lists its containers (AC-6).
6. Mount a share on the mini: it is listed with its server and mount point (AC-7).
