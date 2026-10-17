package config

import (
	"errors"
	"testing"
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
