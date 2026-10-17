package macmon

import (
	"os"
	"testing"
	"time"
)

func TestParseRealSample(t *testing.T) {
	b, err := os.ReadFile("testdata/sample.json")
	if err != nil {
		t.Fatal(err)
	}
	s, err := Parse(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.CPUTiers) == 0 || s.Memory.RAMTotal == 0 || s.GPUActive < 0 || s.GPUActive > 1 {
		t.Fatalf("implausible sample: %+v", s)
	}
}

func TestParseRejectsGarbage(t *testing.T) {
	if _, err := Parse([]byte("not json")); err == nil {
		t.Fatal("want error")
	}
}

func TestStaleSampleIsUnavailable(t *testing.T) {
	r := NewRunner("macmon")
	if _, err := r.Latest(); err != ErrUnavailable {
		t.Fatalf("empty runner: %v", err)
	}
	base := time.Now()
	r.now = func() time.Time { return base }
	r.set(Sample{AllPower: 1})
	if _, err := r.Latest(); err != nil {
		t.Fatal(err)
	}
	r.now = func() time.Time { return base.Add(MaxAge + time.Second) }
	if _, err := r.Latest(); err != ErrUnavailable {
		t.Fatalf("stale sample must be unavailable, got %v", err)
	}
}
