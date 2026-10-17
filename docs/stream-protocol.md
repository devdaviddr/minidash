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
