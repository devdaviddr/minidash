// Package config loads agent settings from the environment.
package config

import (
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Config holds the agent's runtime settings.
type Config struct {
	Addr        string        // listen address, LAN-reachable by design (spec NFR network exposure)
	Token       string        // shared access token; required
	MacmonBin   string        // macmon binary for GPU/power/thermal data
	SoCInterval time.Duration // how often macmon samples; each sample costs CPU
	ProcGPU     time.Duration // how often per-process GPU time is read; 0 = off
	Origins     []string      // extra allowed WebSocket Origin host patterns for the dashboard UI
	Retention   time.Duration // how long collected history is kept (FR-34, FR-35)
	HistoryDir  string        // directory for stored history JSONL files
	HostID      string        // stable host id; empty = derived from the hostname (FR-40)
	HostName    string        // display name; empty = the hostname (FR-40)
}

// hostIDPattern is the contract's host id: 1 to 32 of a-z, 0-9 and - (FR-40).
var hostIDPattern = regexp.MustCompile(`^[a-z0-9-]{1,32}$`)

// ValidHostID reports whether id is a usable host id.
func ValidHostID(id string) bool { return hostIDPattern.MatchString(id) }

// maxHostName is the contract's longest host display name.
const maxHostName = 64

// ErrBadHostID is returned for an unusable MINIDASH_HOST_ID.
var ErrBadHostID = errors.New("MINIDASH_HOST_ID must be 1 to 32 characters of a-z, 0-9 and -")

// ErrBadHostName is returned for an unusable MINIDASH_HOST_NAME.
var ErrBadHostName = errors.New("MINIDASH_HOST_NAME must be at most 64 characters")

// DefaultProcGPU is the per-process GPU interval, set from the measurement on the Mac mini
// (spec 0.6.0 plan DD-24, docs/collectors.md).
const DefaultProcGPU = 3 * time.Second

// procRefreshMS is the process list refresh; the GPU interval must be a multiple of it.
const procRefreshMS = 3000

// maxProcGPUMS bounds MINIDASH_PROC_GPU_INTERVAL_MS (one hour) so the value cannot overflow.
const maxProcGPUMS = 3_600_000

// ErrBadInterval is returned for an unusable MINIDASH_SOC_INTERVAL_MS.
var ErrBadInterval = errors.New("MINIDASH_SOC_INTERVAL_MS must be an integer >= 250")

// ErrBadProcGPUInterval is returned for an unusable MINIDASH_PROC_GPU_INTERVAL_MS.
var ErrBadProcGPUInterval = errors.New("MINIDASH_PROC_GPU_INTERVAL_MS must be 0 (off) or a multiple of 3000 up to 3600000")

// ErrNoToken is returned when no access token is configured.
var ErrNoToken = errors.New("MINIDASH_TOKEN is required: the agent refuses to start without an access token")

// DefaultRetention is how long history is kept when MINIDASH_RETENTION is unset (FR-35).
const DefaultRetention = time.Hour

// retentionValues maps the accepted MINIDASH_RETENTION tokens to durations (FR-34).
var retentionValues = map[string]time.Duration{
	"5m":  5 * time.Minute,
	"10m": 10 * time.Minute,
	"20m": 20 * time.Minute,
	"30m": 30 * time.Minute,
	"1h":  time.Hour,
	"7h":  7 * time.Hour,
	"1d":  24 * time.Hour,
	"7d":  7 * 24 * time.Hour,
	"28d": 28 * 24 * time.Hour,
}

// ErrBadRetention is returned for an unusable MINIDASH_RETENTION value.
var ErrBadRetention = errors.New("MINIDASH_RETENTION must be one of 5m, 10m, 20m, 30m, 1h, 7h, 1d, 7d, 28d")

// parseRetention maps a retention token to a duration, or returns ErrBadRetention.
func parseRetention(v string) (time.Duration, error) {
	d, ok := retentionValues[v]
	if !ok {
		return 0, ErrBadRetention
	}
	return d, nil
}

// defaultHistoryDir returns ~/.config/minidash/history (FR-36).
func defaultHistoryDir() string {
	if home := os.Getenv("HOME"); home != "" {
		return home + "/.config/minidash/history"
	}
	return ".minidash/history"
}

// FromEnv reads MINIDASH_ADDR (default :8787), MINIDASH_TOKEN (required) and
// MINIDASH_ORIGINS (optional comma-separated allowed Origin host patterns) and
// MINIDASH_MACMON (macmon binary, default "macmon"), MINIDASH_SOC_INTERVAL_MS
// (macmon sampling period, default 2000, minimum 250) and MINIDASH_PROC_GPU_INTERVAL_MS
// (per-process GPU read period, 0 = off or a multiple of 3000, default DefaultProcGPU),
// MINIDASH_RETENTION (history retention window, default 1h), MINIDASH_HISTORY_DIR
// (history directory, default ~/.config/minidash/history), and MINIDASH_HOST_ID and
// MINIDASH_HOST_NAME (host identity, default derived from the hostname).
func FromEnv() (Config, error) {
	c := Config{Addr: os.Getenv("MINIDASH_ADDR"), Token: os.Getenv("MINIDASH_TOKEN")}
	if o := os.Getenv("MINIDASH_ORIGINS"); o != "" {
		c.Origins = strings.Split(o, ",")
	}
	if c.MacmonBin = os.Getenv("MINIDASH_MACMON"); c.MacmonBin == "" {
		c.MacmonBin = "macmon"
	}
	c.SoCInterval = 2 * time.Second
	if v := os.Getenv("MINIDASH_SOC_INTERVAL_MS"); v != "" {
		ms, err := strconv.Atoi(v)
		if err != nil || ms < 250 {
			return Config{}, ErrBadInterval
		}
		c.SoCInterval = time.Duration(ms) * time.Millisecond
	}
	c.ProcGPU = DefaultProcGPU
	if v := os.Getenv("MINIDASH_PROC_GPU_INTERVAL_MS"); v != "" {
		ms, err := strconv.Atoi(v)
		if err != nil || ms < 0 || ms > maxProcGPUMS || ms%procRefreshMS != 0 {
			return Config{}, ErrBadProcGPUInterval
		}
		c.ProcGPU = time.Duration(ms) * time.Millisecond
	}
	c.Retention = DefaultRetention
	if v := os.Getenv("MINIDASH_RETENTION"); v != "" {
		d, err := parseRetention(v)
		if err != nil {
			return Config{}, err
		}
		c.Retention = d
	}
	c.HistoryDir = os.Getenv("MINIDASH_HISTORY_DIR")
	if c.HistoryDir == "" {
		c.HistoryDir = defaultHistoryDir()
	}
	c.HostID, c.HostName = os.Getenv("MINIDASH_HOST_ID"), os.Getenv("MINIDASH_HOST_NAME")
	if c.HostID != "" && !ValidHostID(c.HostID) {
		return Config{}, ErrBadHostID
	}
	if len([]rune(c.HostName)) > maxHostName {
		return Config{}, ErrBadHostName
	}
	if c.Addr == "" {
		c.Addr = ":8787"
	}
	if c.Token == "" {
		return Config{}, ErrNoToken
	}
	return c, nil
}
