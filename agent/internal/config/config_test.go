package config

import (
	"errors"
	"testing"
	"time"
)

func TestFromEnvRequiresToken(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "")
	if _, err := FromEnv(); !errors.Is(err, ErrNoToken) {
		t.Fatalf("want ErrNoToken, got %v", err)
	}
}

func TestFromEnvDefaults(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "x")
	t.Setenv("MINIDASH_ADDR", "")
	c, err := FromEnv()
	if err != nil || c.Addr != ":8787" {
		t.Fatalf("got %+v, %v", c, err)
	}
}

func TestSoCInterval(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "x")
	t.Setenv("MINIDASH_SOC_INTERVAL_MS", "")
	if c, _ := FromEnv(); c.SoCInterval != 2*time.Second {
		t.Fatalf("default = %v", c.SoCInterval)
	}
	t.Setenv("MINIDASH_SOC_INTERVAL_MS", "1000")
	if c, _ := FromEnv(); c.SoCInterval != time.Second {
		t.Fatalf("override = %v", c.SoCInterval)
	}
	for _, bad := range []string{"abc", "100", "-5"} {
		t.Setenv("MINIDASH_SOC_INTERVAL_MS", bad)
		if _, err := FromEnv(); !errors.Is(err, ErrBadInterval) {
			t.Fatalf("%q should be rejected, got %v", bad, err)
		}
	}
}

// T-36, plan DD-24: the GPU interval is 0 (off) or a multiple of the 3 s process refresh.
func TestProcGPUInterval(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "x")
	t.Setenv("MINIDASH_PROC_GPU_INTERVAL_MS", "")
	if c, _ := FromEnv(); c.ProcGPU != DefaultProcGPU {
		t.Fatalf("default = %v", c.ProcGPU)
	}
	for in, want := range map[string]time.Duration{"0": 0, "3000": 3 * time.Second, "9000": 9 * time.Second, "3600000": time.Hour} {
		t.Setenv("MINIDASH_PROC_GPU_INTERVAL_MS", in)
		if c, err := FromEnv(); err != nil || c.ProcGPU != want {
			t.Fatalf("%s: got %v, %v", in, c.ProcGPU, err)
		}
	}
	for _, bad := range []string{"abc", "-3000", "1000", "4500", "3000.0", "3603000", "99999999999999999999"} {
		t.Setenv("MINIDASH_PROC_GPU_INTERVAL_MS", bad)
		if _, err := FromEnv(); !errors.Is(err, ErrBadProcGPUInterval) {
			t.Fatalf("%q should be rejected, got %v", bad, err)
		}
	}
}

// T-43, AC-36: MINIDASH_RETENTION accepts the documented windows, defaults to 1h, and rejects
// anything else so the agent stops at startup.
func TestRetention(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "x")
	t.Setenv("MINIDASH_RETENTION", "")
	if c, _ := FromEnv(); c.Retention != DefaultRetention {
		t.Fatalf("default = %v", c.Retention)
	}
	for in, want := range map[string]time.Duration{
		"5m": 5 * time.Minute, "10m": 10 * time.Minute, "20m": 20 * time.Minute,
		"30m": 30 * time.Minute, "1h": time.Hour, "7h": 7 * time.Hour,
		"1d": 24 * time.Hour, "7d": 7 * 24 * time.Hour, "28d": 28 * 24 * time.Hour,
	} {
		t.Setenv("MINIDASH_RETENTION", in)
		if c, err := FromEnv(); err != nil || c.Retention != want {
			t.Fatalf("%s: got %v, %v", in, c.Retention, err)
		}
	}
	for _, bad := range []string{"abc", "0", "1h30m", "1H", "2d", "-1h", "60"} {
		t.Setenv("MINIDASH_RETENTION", bad)
		if _, err := FromEnv(); !errors.Is(err, ErrBadRetention) {
			t.Fatalf("%q should be rejected, got %v", bad, err)
		}
	}
}

// T-43: MINIDASH_HISTORY_DIR overrides the default history directory.
func TestHistoryDir(t *testing.T) {
	t.Setenv("MINIDASH_TOKEN", "x")
	t.Setenv("MINIDASH_HISTORY_DIR", "")
	if c, _ := FromEnv(); c.HistoryDir == "" {
		t.Fatalf("default history dir is empty")
	}
	t.Setenv("MINIDASH_HISTORY_DIR", "/tmp/minidash-hist")
	if c, _ := FromEnv(); c.HistoryDir != "/tmp/minidash-hist" {
		t.Fatalf("override = %v", c.HistoryDir)
	}
}
