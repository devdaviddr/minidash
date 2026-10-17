#!/usr/bin/env node
// Dev probe: connect to a running agent and print snapshots.
// Usage: MINIDASH_TOKEN=... node tools/probe.mjs [url] [count] [collector]
const url = process.argv[2] ?? 'ws://127.0.0.1:8787/ws'
const count = Number(process.argv[3] ?? 1)
const only = process.argv[4]
const ws = new WebSocket(url)
let n = 0
ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: process.env.MINIDASH_TOKEN }))
ws.onmessage = (e) => {
  const s = JSON.parse(e.data)
  console.log(JSON.stringify(only ? { seq: s.seq, [only]: s.collectors[only] } : s, null, 2))
  if (++n >= count) process.exit(0)
}
ws.onclose = (e) => {
  console.error(`closed ${e.code}`)
  process.exit(1)
}
