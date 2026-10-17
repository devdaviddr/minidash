// Package config loads agent settings from the environment.
package config

import (
	"errors"
	"os"
	"strings"
)

// Config holds the agent's runtime settings.
type Config struct {
	Addr      string   // listen address, LAN-reachable by design (spec NFR network exposure)
	Token     string   // shared access token; required
	MacmonBin string   // macmon binary for GPU/power/thermal data
	Origins   []string // extra allowed WebSocket Origin host patterns for the dashboard UI
}

// ErrNoToken is returned when no access token is configured.
var ErrNoToken = errors.New("MINIDASH_TOKEN is required: the agent refuses to start without an access token")

// FromEnv reads MINIDASH_ADDR (default :8787), MINIDASH_TOKEN (required) and
// MINIDASH_ORIGINS (optional comma-separated allowed Origin host patterns) and
// MINIDASH_MACMON (macmon binary, default "macmon").
func FromEnv() (Config, error) {
	c := Config{Addr: os.Getenv("MINIDASH_ADDR"), Token: os.Getenv("MINIDASH_TOKEN")}
	if o := os.Getenv("MINIDASH_ORIGINS"); o != "" {
		c.Origins = strings.Split(o, ",")
	}
	if c.MacmonBin = os.Getenv("MINIDASH_MACMON"); c.MacmonBin == "" {
		c.MacmonBin = "macmon"
	}
	if c.Addr == "" {
		c.Addr = ":8787"
	}
	if c.Token == "" {
		return Config{}, ErrNoToken
	}
	return c, nil
}
