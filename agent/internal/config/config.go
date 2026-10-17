// Package config loads agent settings from the environment.
package config

import (
	"errors"
	"os"
)

// Config holds the agent's runtime settings.
type Config struct {
	Addr  string // listen address, LAN-reachable by design (spec NFR network exposure)
	Token string // shared access token; required
}

// ErrNoToken is returned when no access token is configured.
var ErrNoToken = errors.New("MINIDASH_TOKEN is required: the agent refuses to start without an access token")

// FromEnv reads MINIDASH_ADDR (default :8787) and MINIDASH_TOKEN (required).
func FromEnv() (Config, error) {
	c := Config{Addr: os.Getenv("MINIDASH_ADDR"), Token: os.Getenv("MINIDASH_TOKEN")}
	if c.Addr == "" {
		c.Addr = ":8787"
	}
	if c.Token == "" {
		return Config{}, ErrNoToken
	}
	return c, nil
}
