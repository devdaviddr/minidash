# Troubleshooting

Find the symptom, then the cause.

## The page will not load
| You see | Likely cause | Fix |
| --- | --- | --- |
| `ERR_ADDRESS_UNREACHABLE` in Chrome, but `curl` works from the same Mac | macOS blocks browsers from local-network addresses until allowed | System Settings → Privacy & Security → Local Network → enable your browser, then restart it. Over Tailscale the problem usually does not occur. |
| `ERR_ADDRESS_UNREACHABLE` using `name.local` | The `.local` name also resolves to an IPv6 link-local address (`fe80::`) that some browsers cannot use | Use the IPv4 address (`http://<mini-ip>:8080`) or the Tailscale address |
| Nothing loads from a phone or other device | Different Wi-Fi or VLAN, guest or IoT network, client isolation, or a VPN on that device | Join the mini's network, disable the VPN, or use Tailscale |
| Connection refused on `:8080` | The UI container is not running | `docker ps`, then `docker compose -f deploy/compose.yaml up -d` |

To tell whether a request ever reached the mini, look at the UI container's access log (`docker logs deploy-web-1`). If your browser's requests are absent, the block is between your device and the mini.

## The page loads but shows no data
| You see | Cause | Fix |
| --- | --- | --- |
| A box and **Connect**, pill says "token required" | No token saved in this browser | Enter the token from `~/.config/minidash/agent.env` |
| Pill says **unauthorized** | Wrong token, or it was rotated | Enter the current token |
| Pill says **disconnected** and keeps retrying | The agent is down, or the browser cannot reach `:8787` | `curl http://<mini>:8787/healthz`; check `launchctl print` and the agent log |
| Disconnected, and the agent is up | The page's origin is not allowed | Add it to `MINIDASH_ORIGINS` (for example `*:8080`) and restart. A refused origin fails at the WebSocket handshake. |
| Page is on one host but the agent is on another | The UI defaults to the page's own host | Build with `VITE_AGENT_URL=ws://agent-host:8787/ws` |

## A card says "Unavailable"
Each card reports its own collector. One failing collector never affects the others.

| Card | Message | Fix |
| --- | --- | --- |
| GPU & power | `macmon unavailable (install with: brew install macmon)` | `brew install macmon`, then restart the agent. Also appears if macmon stops sampling for more than 5 seconds. |
| Containers | a runtime says "not running" | Normal when that runtime is stopped or absent. It is not an error. |
| Containers | a runtime says "error" | The runtime's API answered badly; the card shows the message. Restart that runtime. |
| Shares | a share says "unreachable" | The server did not answer within 2 seconds. Check the server and your connection. |

## Data looks different from what you expect
- **A connected SMB client shows "unknown account".** macOS can serve SMB sessions as root, and the real user is not visible without privileges.
- **No GPU column in the process table.** macOS does not expose per-process GPU use without root.
- **A mounted share shows an Apple ID instead of a user name.** Shares authenticated with an Apple ID are shown as "Apple ID" on purpose.
- **A volume you expect is missing from Storage.** Only the internal Data volume and local filesystems mounted under `/Volumes` are listed. Network shares appear under Shares.
- **Podman containers appear under Podman, not Docker, though `docker` works.** The Docker socket resolves to Podman's, and each socket is counted once (Colima and Podman are checked first).
- **Process list lags the CPU graph.** Processes refresh every 3 s; the CPU graph every second.

## Customising and themes
| You see | Cause | Fix |
| --- | --- | --- |
| The panel says the browser would not let minidash save the layout | Storage is blocked (private window, or site data disabled) | Allow site data for this page. Until then the layout lasts for the session. |
| My layout is gone | Site data was cleared, or you opened it in a different browser or on a different address (storage is per origin) | Re-import your exported `minidash-layout.json`, or set it up again. |
| An import was refused | The file is not valid JSON, is not a minidash layout, or is from a newer minidash | Read the message under the buttons. Your layout was not changed. Export from the same or an older version. |
| A card I never saw appeared after an import | The file predates that card, so it was added with its defaults | Hide it in the panel if you do not want it. |
| Everything is hidden | All cards and the summary strip are switched off | Click **Show all cards**, or open Customise and tick them. |
| The page briefly shows the wrong theme on load | `theme-init.js` is blocked or not served | Check `/theme-init.js` returns JavaScript (not the page) and your CSP allows same-origin scripts. |
| Drag does nothing | The handle only appears while the Customise panel is open | Open Customise, or use the move buttons in the panel. |
| There is no resize grip on the cards | Grips appear only while Customise is open and the grid has four columns (screen 1024 px or wider) | Open Customise on a wider screen or window, or set the width in the card view (select a card). |
| Clicking a card does nothing | Cards are selectable only while Customise is open | Open Customise first. You can also pick a card from the overview list. |
| A width of 3 became 2 after an import | The file has width 3 but this build is 1.1.0, which only knows 1, 2 and 4 | Update minidash; widths 1 to 4 are supported from 1.2.0. |
| A card looks cramped or has overflowing content | The card is narrower than the layout inside it expects | Widen the card, and report it with the card, its width and your screen size. |

## HTTPS over Tailscale
| You see | Cause | Fix |
| --- | --- | --- |
| `deploy/tailscale-https.sh on` says Serve is not enabled (exit 3) | Tailscale Serve is off for your tailnet, an account setting | Open the link the script prints, enable it, and run the script again. Nothing was changed. |
| It says HTTPS certificates are not enabled | The tailnet's "HTTPS Certificates" setting is off | Enable it in the Tailscale admin console (DNS page), then run again. |
| The HTTPS page loads but stays "disconnected" | The agent does not allow the page's origin, or the agent's HTTPS port is not served | `deploy/tailscale-https.sh status` should say the agent allows the origin and show 443 and 8787. Run `on` again to repair both. |
| The browser blocks the connection as mixed content | An old UI build that always used `ws://` | Upgrade (`deploy/upgrade.sh`) and hard-refresh. From 1.3.0 the UI uses `wss://` on HTTPS pages. |
| The script stops with exit 4 | Funnel (public internet) is on for this machine | Turn it off with `tailscale funnel reset`. This dashboard is tailnet-only. |
| The HTTPS address does not resolve | The device is not on the tailnet, or MagicDNS is off | Connect Tailscale on that device and check the machine name in `deploy/tailscale-https.sh status`. |

## Upgrading
| You see | Cause | Fix |
| --- | --- | --- |
| `deploy/upgrade.sh` stops with "cannot reach macmini over SSH" | SSH is not set up without a password | Set up key login (see the macmini-ssh notes), or pass `--host <ssh-name>`. |
| It builds and copies, then a check fails (exit 1) | The agent or UI did not come up | The failing check is named. See `~/Library/Logs/minidash/agent.log` and `docker logs deploy-web-1`. |

## The agent will not start
| Log or exit | Cause |
| --- | --- |
| `MINIDASH_TOKEN is required` | Empty token. Set it in `agent.env`. |
| `MINIDASH_SOC_INTERVAL_MS must be an integer >= 250` | Bad interval value. |
| `missing ~/.config/minidash/agent.env` (exit 78) | The env file is absent. Re-run `deploy/install-agent.sh install`. |
| `address already in use` | Something else holds port 8787. `lsof -nP -iTCP:8787 -sTCP:LISTEN`. |
| Starts, then nothing listens | Check `~/Library/Logs/minidash/agent.log`. |

## It is using too much CPU
Expect about 1.5% in total. If it is higher, check whether you lowered `MINIDASH_SOC_INTERVAL_MS`, have thousands of processes, or many containers (statistics are requested per container every 2 seconds, up to 100 per runtime).

## Still stuck
Open an issue with: macOS version, how you deployed, the relevant lines from `agent.log`, and what the status pill says. Do not paste your token.
