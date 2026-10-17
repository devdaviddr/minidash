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
- Agent scripts: dry run, plist lint and a real `run-agent.sh` start were tested on a development Mac (not the mini).
- **Not yet tested:** the container image build and a real launchd install on the Mac mini. Those are the manual check for task T-11.

## Manual acceptance checks (need the real mini)
1. Install the agent, open the UI from another device on the LAN: values update every second (AC-1, AC-4, AC-8).
2. Stop the agent (`launchctl bootout gui/$(id -u)/com.minidash.agent`): the UI shows "disconnected" within 5 s; start it again: it recovers without a reload (AC-8).
3. Run a GPU-heavy app: GPU % and power rise (AC-2).
4. Plug in and eject the external drive: it appears, then disappears (AC-3).
5. Start only Colima: it lists containers; Docker and Podman read "not running" (AC-6).
6. Connect to a share from another Mac: a connected client appears (AC-7; the account may show as unknown if macOS serves it as root).
