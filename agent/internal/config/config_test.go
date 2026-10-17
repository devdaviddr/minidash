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
