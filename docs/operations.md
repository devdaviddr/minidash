# Operations

Commands assume you are on the Mac mini, or prefix them with `ssh macmini`. Over a non-interactive SSH session, `/opt/homebrew/bin` is not on `PATH`: add `export PATH=/opt/homebrew/bin:$PATH` first.

## Is it healthy?
```sh
curl -s http://127.0.0.1:8787/healthz                    # prints: ok
launchctl print gui/$(id -u)/com.minidash.agent | grep -E "state =|pid =|last exit"
pgrep -fl "macmon pipe"                                  # GPU/power sampler
docker ps --filter name=deploy-web-1                     # UI container
```
In the browser, the status pill at the top right reads `live · tick N` when the stream is healthy.

## Logs
| What | Where |
| --- | --- |
| Agent | `~/Library/Logs/minidash/agent.log` |
| Web UI access log | `docker logs deploy-web-1` |

The agent logs its listen address at startup and any fatal error. It never logs the token.

## Start, stop, restart
```sh
launchctl kickstart -k gui/$(id -u)/com.minidash.agent   # restart
launchctl bootout   gui/$(id -u)/com.minidash.agent      # stop (until next login or bootstrap)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.minidash.agent.plist   # start again
docker compose -f deploy/compose.yaml restart            # UI container
```
`KeepAlive` restarts the agent if it crashes or is killed, usually within a second. macmon is a child of the agent and is restarted with it.

The agent is a **LaunchAgent**, so it runs while your user is logged in (it starts at login). That is intentional: it needs your user's container sockets. If the Mac boots and nobody logs in, it does not run.

## Upgrading
From your development Mac, in the repo:

```sh
deploy/upgrade.sh --dry-run    # optional: show the plan
deploy/upgrade.sh              # build, copy, install, rebuild the UI, then verify
```
It checks the agent, the UI container, the UI page and the live stream, exits non-zero if any fails, and prints the URLs when all pass. Re-running is safe: your token is never overwritten. Hard-refresh the browser (Cmd+Shift+R) to pick up a new UI.

The manual steps it automates, if you ever need them:

```sh
cd agent && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -o ../bin/minidash-agent ./cmd/minidash-agent && cd ..
rsync -az --exclude node_modules --exclude dist bin deploy web macmini:minidash-staging/
ssh macmini 'export PATH=/opt/homebrew/bin:$PATH; cd ~/minidash-staging && deploy/install-agent.sh install && docker compose -f deploy/compose.yaml up -d --build'
```

## Uninstalling
```sh
deploy/install-agent.sh uninstall                        # removes the service and binaries, keeps agent.env and logs
docker compose -f deploy/compose.yaml down
rm -rf ~/.config/minidash ~/Library/Logs/minidash ~/minidash-staging   # optional: remove everything
```

## Resource use
Expect about 1.5% of one CPU core in total (agent plus macmon) and about 25 MB of memory for the agent, on an M4 Mac mini with several hundred processes and a dozen containers. See [ADR 0006](adr/0006-cpu-budget-and-throttling.md).

## Backups
There is no data to back up. The agent keeps nothing on disk except its logs and the env file; the browser keeps 5 minutes of history in memory. Keep a copy of your token somewhere safe.
