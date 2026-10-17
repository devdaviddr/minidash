#!/usr/bin/env bash
# Launched by launchd. Loads settings from the env file so the secret token never sits in the plist.
set -euo pipefail
ENV_FILE="${MINIDASH_ENV_FILE:-$HOME/.config/minidash/agent.env}"
BIN="${MINIDASH_BIN:-$HOME/.local/share/minidash/minidash-agent}"
[ -r "$ENV_FILE" ] || { echo "minidash: missing $ENV_FILE" >&2; exit 78; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
# launchd's PATH is minimal; macmon and the container CLIs live in Homebrew.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec "$BIN"
