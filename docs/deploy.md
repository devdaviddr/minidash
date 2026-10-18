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

## 3. HTTPS over Tailscale (optional, recommended)
Plain HTTP on the LAN sends the token and metrics unencrypted. If the mini is on your Tailscale tailnet, publish the dashboard over HTTPS to the tailnet only:

```sh
# once, in your Tailscale admin console: enable Serve and HTTPS certificates
# (the script prints the exact link if they are off)
deploy/tailscale-https.sh on --dry-run   # show what it will do
deploy/tailscale-https.sh on             # run on the Mac mini
deploy/tailscale-https.sh status
```
Then open `https://<mini>.<tailnet>.ts.net/` from any device on the tailnet. The page connects with `wss://<mini>.<tailnet>.ts.net:8787/ws`. The script serves the UI on HTTPS 443 and the agent on HTTPS 8787 with `tailscale serve`, adds the name to the agent's allowed origins, and restarts the agent. It is safe to run twice, and `deploy/tailscale-https.sh off` undoes it. The LAN HTTP addresses keep working.

It never uses Funnel, so nothing is exposed to the public internet; the script refuses it. See [ADR 0012](adr/0012-https-through-tailscale-serve.md) and, if something fails, [troubleshooting.md](troubleshooting.md#https-over-tailscale).

## Upgrading
From your development machine, in the repo:

```sh
deploy/upgrade.sh --dry-run       # show the plan
deploy/upgrade.sh                 # build, copy, install, rebuild the UI, then check everything
```
It builds the agent for Apple Silicon, copies the files over SSH, installs the agent (your token is kept), rebuilds the UI container, and then checks the agent's `/healthz`, the UI container, the UI page and the live stream. If any check fails it exits non-zero and does not say it succeeded. On success it prints the URLs. Use `--host <ssh-name>` for a host other than `macmini`.

## Verification status
Deployed to the Mac mini (M4, macOS 26.4, 693 processes, 14 Podman containers) and tested over the LAN from another Mac:
- All eight collectors report `ok`. The external Media drive shows as external; Podman shows its containers; Colima and Docker read "not-running" (Docker's socket resolves to Podman's and is counted once).
- A wrong token is closed with 1008. WebSocket origins from the UI's host are accepted; other origins are refused at the handshake.
- The container is read-only, unprivileged (uid 101), drops capabilities, and every response carries the CSP and related headers.
- Killing the agent: launchd restarts it in about a second and the stream resumes.
- CPU on the mini: agent about 1.3% plus `macmon` about 0.35%, total about 1.65% of one core (budget: 2%).

UI 0.2.0 (themes, restyle, customisable layout) was also deployed to the mini and checked over the LAN: the page and `theme-init.js` are served (as JavaScript, with the CSP and related headers), the bundle contains the new features, the container is still read-only and unprivileged, and the stream is accepted for the UI's origin. The gzipped bundle grew 19.9 kB against the 0.1.0 build (budget 40 kB).

UI 0.3.0 (click to select, drag to resize, responsive cards) was deployed and checked the same way: the served CSS contains the container-query rules, the served bundle contains the resize slider and selection code, the container is unchanged (read-only, unprivileged, security headers), and the stream is accepted. The gzipped bundle is 21.7 kB above the 0.1.0 build (0.3.0 itself added 1.8 kB and no dependencies).

Spec 0.4.0 tooling was also run for real against the mini: `deploy/upgrade.sh` built, copied, installed and rebuilt, and all four of its checks passed (agent health, UI container, UI page, live stream). `deploy/tailscale-https.sh` was run live: `status` and `--dry-run` work, `--funnel` is refused, and `on` stopped cleanly with the enable link because Tailscale Serve was not yet enabled on the tailnet, leaving the origins and serve config untouched. Both scripts have stub-based test suites that run in CI (37 and 35 checks).

Still needs a human: the GPU-load check (AC-2) and a visual review of the UI in a browser. That includes real pointer and touch dragging and resizing, and how each card looks at one-column and full width, which automated tests cannot judge.

## Manual acceptance checks (need the real mini)
1. Open the UI from another device on the LAN: values update every second (AC-1, AC-4).
2. Stop the agent (`launchctl bootout gui/$(id -u)/com.minidash.agent`): the UI shows "disconnected" within 5 s; start it again (`launchctl bootstrap ...`): it recovers without a reload (AC-8).
3. Run a GPU-heavy app: GPU % and power rise (AC-2).
4. Eject the external drive: it disappears; plug it in: it returns (AC-3).
5. Start Colima: it lists its containers (AC-6).
6. Mount a share on the mini: it is listed with its server and mount point (AC-7).
7. After enabling Serve for your tailnet, run `deploy/tailscale-https.sh on` and open `https://<mini>.<tailnet>.ts.net/` from another tailnet device: the page loads over HTTPS and the stream connects over `wss://` (AC-23).
