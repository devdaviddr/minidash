# Stream protocol

The agent pushes one JSON snapshot per tick (default 1 s) over WebSocket at `/ws`. The wire shape is [`contracts/snapshot.schema.json`](../contracts/snapshot.schema.json); the web types in `web/src/contract/snapshot.ts` are generated from it (`npm run gen:types` in `web/`). Do not edit the generated file.

## Handshake
1. Client opens `ws://<agent>:8787/ws`.
2. Within 5 s the client sends `{"type":"auth","token":"<token>"}`.
3. A wrong or missing token closes the socket with code 1008. The client treats 1008 as "unauthorized" and stops retrying.
4. After auth the agent sends the latest snapshot at once, then one per tick.

The token is compared in constant time. It travels in a WebSocket message, not the URL, so it stays out of access logs.

## Client behaviour (spec AC-8)
- No snapshot for 3 intervals (max 4.5 s): status becomes `disconnected` and the client reconnects.
- Reconnect backoff doubles from 1 s to 10 s and resets on the first snapshot.
- A slow client only ever holds the newest snapshot; older ones are dropped. `seq` gaps show drops.

## Agent configuration
| Variable | Default | Meaning |
| --- | --- | --- |
| `MINIDASH_TOKEN` | required | Shared access token. The agent refuses to start without it. |
| `MINIDASH_ADDR` | `:8787` | Listen address. |
| `MINIDASH_ORIGINS` | none | Comma-separated allowed `Origin` host patterns. Set this to the host serving the web UI, since it is a different origin than the agent. |
| `MINIDASH_MACMON` | `macmon` | macmon binary path. |
| `MINIDASH_SOC_INTERVAL_MS` | `2000` | macmon sampling period, minimum 250. Lower is fresher GPU data and more CPU. |

## Web UI
- `?wall` in the URL, or the "Wall display" button, switches to a wall-display layout: larger type, and the process table and shares card are hidden so the overview fits one screen.
- The access token is entered once in the browser and kept in `localStorage`. If storage is blocked it lives for the session only.
- Light and dark themes follow the OS setting. Animations are disabled under `prefers-reduced-motion`.
- By default the UI connects to `ws://<page host>:8787/ws`. Override at build time with `VITE_AGENT_URL`.
