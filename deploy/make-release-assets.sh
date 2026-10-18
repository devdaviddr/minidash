#!/usr/bin/env bash
# Builds the files attached to a GitHub Release into dist/release/:
#   minidash-agent-<version>-darwin-arm64   the agent, built for Apple Silicon (no cgo, so Linux can build it)
#   minidash-web-<version>.tar.gz           the built web UI (serve it with any static server)
#   SHA256SUMS                              checksums of both
# Usage: deploy/make-release-assets.sh v1.2.0
set -euo pipefail

TAG="${1:?usage: $0 vX.Y.Z}"
VERSION="${TAG#v}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/release"

rm -rf "$OUT" && mkdir -p "$OUT"

(cd "$ROOT/agent" && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 \
  go build -trimpath -ldflags "-s -w" -o "$OUT/minidash-agent-$VERSION-darwin-arm64" ./cmd/minidash-agent)

(cd "$ROOT/web" && npm ci --no-audit --no-fund && npm run build)
tar -czf "$OUT/minidash-web-$VERSION.tar.gz" -C "$ROOT/web/dist" .

cd "$OUT"
if command -v sha256sum >/dev/null; then sha256sum -- * > SHA256SUMS; else shasum -a 256 -- * > SHA256SUMS; fi
ls -la
