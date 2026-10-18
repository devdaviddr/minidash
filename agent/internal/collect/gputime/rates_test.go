package gputime

import (
	"fmt"
	"math"
	"testing"
	"time"
)

var t0 = time.Unix(1000, 0)

func at(sec float64, busy map[int32]uint64) Sample {
	return Sample{At: t0.Add(time.Duration(sec * float64(time.Second))), Busy: busy}
}

func show(v *float64) string {
	if v == nil {
		return "null"
	}
	return fmt.Sprintf("%g", *v)
}

// AC-29: every FR-29 rule, as a table over a fake clock.
func TestComputeRates(t *testing.T) {
	cases := []struct {
		name      string
		prev, cur Sample
		pid       int32
		want      string
	}{
		{"1.5 s of GPU in 3 s is 50%", at(0, map[int32]uint64{1: 1e9}), at(3, map[int32]uint64{1: 2.5e9}), 1, "50"},
		{"first sample: no baseline", Sample{}, at(3, map[int32]uint64{1: 5e9}), 1, "null"},
		{"first sample: no clients is still null", Sample{}, at(3, map[int32]uint64{}), 2, "null"},
		{"pid first seen in the second sample", at(0, map[int32]uint64{1: 0}), at(3, map[int32]uint64{1: 0, 2: 1e9}), 2, "null"},
		{"sum went down", at(0, map[int32]uint64{1: 5e9}), at(3, map[int32]uint64{1: 1e9}), 1, "null"},
		{"no GPU clients reads 0", at(0, map[int32]uint64{1: 0}), at(3, map[int32]uint64{1: 0}), 7, "0"},
		{"clients but idle reads 0", at(0, map[int32]uint64{1: 4e9}), at(3, map[int32]uint64{1: 4e9}), 1, "0"},
		{"above 100 is clamped", at(0, map[int32]uint64{1: 0}), at(3, map[int32]uint64{1: 9e9}), 1, "100"},
		{"exactly 100", at(0, map[int32]uint64{1: 0}), at(3, map[int32]uint64{1: 3e9}), 1, "100"},
		{"time did not advance", at(3, map[int32]uint64{1: 0}), at(3, map[int32]uint64{1: 1e9}), 1, "null"},
		{"clock went back", at(3, map[int32]uint64{1: 0}), at(0, map[int32]uint64{1: 1e9}), 1, "null"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := show(ComputeRates(tc.prev, tc.cur).For(tc.pid)); got != tc.want {
				t.Fatalf("got %s, want %s", got, tc.want)
			}
		})
	}
}

// AC-29: after a drop, the next interval is measured from the new (lower) baseline.
func TestDropResetsBaseline(t *testing.T) {
	s1 := at(0, map[int32]uint64{1: 5e9})
	s2 := at(3, map[int32]uint64{1: 1e9}) // a client closed
	s3 := at(6, map[int32]uint64{1: 1.3e9})
	if got := show(ComputeRates(s1, s2).For(1)); got != "null" {
		t.Fatalf("drop: got %s", got)
	}
	if got := show(ComputeRates(s2, s3).For(1)); got != "10" {
		t.Fatalf("after drop: got %s, want 10", got)
	}
}

// AC-29: a value below 0 is never reported, for any pair of counters.
func TestNeverNegative(t *testing.T) {
	for _, before := range []uint64{0, 1, 1e9, 1 << 63} {
		for _, now := range []uint64{0, 1, 1e9, 1 << 63} {
			v := ComputeRates(at(0, map[int32]uint64{1: before}), at(3, map[int32]uint64{1: now})).For(1)
			if v != nil && (*v < 0 || *v > 100) {
				t.Fatalf("%d -> %d gave %v", before, now, *v)
			}
		}
	}
}

// The recorded Mac mini samples, 3 s apart: WindowServer drew the desktop, the rest idled.
func TestRatesOnRecordedSamples(t *testing.T) {
	a, err := Parse(fixture(t, "recorded-1.plist"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := Parse(fixture(t, "recorded-2.plist"))
	if err != nil {
		t.Fatal(err)
	}
	a.At, b.At = t0, t0.Add(3*time.Second)
	r := ComputeRates(a, b)
	if got := r.For(110); got == nil || math.Abs(*got-4.0045764) > 1e-6 {
		t.Fatalf("WindowServer = %s, want about 4.0046", show(got))
	}
	if got := show(r.For(120)); got != "0" {
		t.Fatalf("idle app = %s", got)
	}
}
