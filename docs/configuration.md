# Configuration

## Agent
The agent reads environment variables. Under launchd they come from `~/.config/minidash/agent.env` (mode 600), which `run-agent.sh` loads before starting the agent, so the token never sits in the plist.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MINIDASH_TOKEN` | **required** | Shared access token. The agent exits immediately if it is empty. The installer generates 192 random bits (48 hex characters). |
| `MINIDASH_ADDR` | `:8787` | Listen address. `:8787` means all interfaces. Use `127.0.0.1:8787` to restrict to the Mac itself. |
| `MINIDASH_ORIGINS` | none | Comma-separated host patterns allowed in the WebSocket `Origin` header. The UI is served from a different origin than the agent, so set this to where the UI lives. The installer writes `*:8080`, which accepts any host on port 8080; `deploy/tailscale-https.sh on` appends the tailnet host name (an HTTPS page has no port in its origin) and `off` removes it. Patterns use shell-style globbing against `host:port`. |
| `MINIDASH_MACMON` | `macmon` | Path or name of the macmon binary. |
| `MINIDASH_SOC_INTERVAL_MS` | `2000` | How often macmon samples GPU, power, temperatures and fans. Minimum 250. Lower is fresher and costs more CPU (about 0.7% extra at 1000). Invalid values stop the agent at startup. |

An unset origin list means only same-origin pages can connect, which is not what you want when the UI runs in its own container.

Collector refresh intervals (1 s for CPU, memory, disks and network; 2 s containers; 3 s processes; 10 s shares) are fixed in `agent/cmd/minidash-agent/main.go`. They are a deliberate CPU trade-off: see [ADR 0006](adr/0006-cpu-budget-and-throttling.md).

### Example env file
```sh
MINIDASH_TOKEN=<48 hex characters>
MINIDASH_ADDR=:8787
MINIDASH_ORIGINS=*:8080,frank.example.ts.net
MINIDASH_SOC_INTERVAL_MS=2000
```

### Applying changes
```sh
launchctl kickstart -k gui/$(id -u)/com.minidash.agent
```

### Rotating the token
1. Edit `MINIDASH_TOKEN` in `~/.config/minidash/agent.env` (for example `openssl rand -hex 24`).
2. Restart the agent with the command above.
3. Every browser shows the token form again and needs the new value.

## Web UI
| Setting | How | Meaning |
| --- | --- | --- |
| Agent URL | build-time `VITE_AGENT_URL` | Defaults to `ws://<page host>:8787/ws` for an HTTP page and `wss://<page host>:8787/ws` for an HTTPS page (browsers block `ws://` from HTTPS), which is right when the UI and agent are on the same machine. Set it, for example `ws://mini.example.lan:8787/ws`, when they differ. Rebuild the image after changing it. |
| Wall display | `?wall` in the URL, or the "Wall display" button | Larger type; hides the process table and shares card. Applied on top of your layout, never saved. |
| Layout | the **Customise** panel | Which cards and details show, their order and width. Saved in `localStorage` (`minidash.layout`). See [customising.md](customising.md). |
| Access token | entered once in the page | Stored in the browser's `localStorage`. If storage is blocked it lasts for the session only. |
| Theme | the System / Light / Dark switch in the header | System (default) follows `prefers-color-scheme` live. The choice is saved in `localStorage` (`minidash.theme`) and applied before first paint. Animations stop under `prefers-reduced-motion`. |

## Container
`deploy/compose.yaml` publishes the UI on host port **8080** and runs it read-only, with all capabilities dropped and `no-new-privileges`. Change the left side of `"8080:8080"` to move it, and keep `MINIDASH_ORIGINS` in step.

## launchd service
The installer writes `~/Library/LaunchAgents/com.minidash.agent.plist` with `RunAtLoad` and `KeepAlive`, a 10 second `ThrottleInterval`, and logs to `~/Library/Logs/minidash/agent.log`. See [operations.md](operations.md).
