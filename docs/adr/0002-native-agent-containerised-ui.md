# 2. Native agent, containerised UI

Status: accepted

## Context
The owner wanted minidash deployed as a container. On macOS, containers (Docker Desktop, Colima, Podman) run inside a Linux virtual machine. A process in that VM sees the VM's CPU, memory and disks, not the Mac's. It cannot see Apple Silicon GPU data, the Mac's volumes, its network shares, or its host processes.

## Decision
Run the **agent natively** as a per-user launchd LaunchAgent and ship only the **web UI** as a container (static files behind unprivileged nginx). The browser connects to the agent directly over WebSocket.

## Consequences
- Full host visibility, including GPU, power, external drives and shares.
- The agent runs as the logged-in user, not root, so it reaches that user's Docker, Colima and Podman sockets without privileges.
- Two things to deploy, but the container holds no secrets and no metrics.
- The UI origin differs from the agent origin, so the agent must allow it (`MINIDASH_ORIGINS`).

## Rejected alternatives
- **Everything in one container:** metrics would describe the VM, not the Mac. Defeats the purpose.
- **Agent served the UI itself:** simpler, but the owner asked for a container, and a static container keeps the UI replaceable without touching the agent.
- **Privileged root LaunchDaemon:** unnecessary power, and it could not reach per-user container sockets.
