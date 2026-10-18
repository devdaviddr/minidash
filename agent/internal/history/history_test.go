package history

import (
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

// fakeClock advances by one second per tick so bucket ages are deterministic.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time { return c.t }
func (c *fakeClock) tick()          { c.t = c.t.Add(time.Second) }

func snap(ts time.Time, total float64) snapshot.Snapshot {
	return snapshot.Snapshot{
		Seq: 1, TS: ts, IntervalMS: 1000,
		Collectors: map[string]snapshot.Result{
			"cpu":    {OK: true, Data: map[string]any{"total": total}},
			"memory": {OK: true, Data: map[string]any{"used": 100.0}},
		},
	}
}

// AC-37: recent ticks are kept raw; after Compact, older ticks coalesce into coarser buckets.
func TestAddRawThenCoalesce(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(24 * time.Hour)
	s.now = clock.now

	// 180 ticks spanning 3 hours, all added raw.
	for i := 0; i < 180; i++ {
		s.Add(snap(clock.now(), float64(i)))
		clock.tick()
	}
	if len(s.points) != 180 {
		t.Fatalf("expected 180 raw points before compact, got %d", len(s.points))
	}

	s.Compact()
	// Ages range 0..179 s. All are under 10 min, so all stay raw (1 s buckets).
	if len(s.points) != 180 {
		t.Fatalf("expected 180 points (all raw, ages < 10 min), got %d", len(s.points))
	}
}

// AC-37: Compact coalesces points older than 10 min into 10 s buckets.
func TestCompactCoalesces(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(24 * time.Hour)
	s.now = clock.now

	// Add 120 ticks at t=0..119, then advance the clock so those ticks are 12 min old.
	for i := 0; i < 120; i++ {
		s.Add(snap(clock.now(), float64(i)))
		clock.tick()
	}
	clock.t = clock.t.Add(12 * time.Minute) // now = 120s + 12 min; all ticks are > 10 min old
	s.Compact()
	// 120 s of data in 10 s buckets = 12 points.
	if len(s.points) != 12 {
		t.Fatalf("expected 12 coalesced points, got %d", len(s.points))
	}
}

// AC-37: averaging within a bucket uses the mean of numeric fields.
func TestBucketAverages(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(time.Hour)
	s.now = clock.now
	// Make the ticks 11 min old so they fall in 10 s buckets; t=0 and t=1 share bucket 0.
	s.Add(snap(time.Unix(0, 0), 10))
	s.Add(snap(time.Unix(1, 0), 20))
	clock.t = time.Unix(11*60, 0)
	s.Compact()
	if len(s.points) != 1 {
		t.Fatalf("expected 1 merged point, got %d", len(s.points))
	}
	data, _ := s.points[0].Collectors["cpu"].Data.(map[string]any)
	if data["total"] != 15.0 {
		t.Fatalf("expected averaged total 15, got %v", data["total"])
	}
}

// AC-37: snapshots older than the retention window are pruned.
func TestPrune(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(10 * time.Second)
	s.now = clock.now
	for i := 0; i < 30; i++ {
		s.Add(snap(clock.now(), float64(i)))
		clock.tick()
	}
	if len(s.points) > 10 {
		t.Fatalf("expected at most 10 points within a 10 s window, got %d", len(s.points))
	}
}

// AC-37: heavy collectors (processes, containers, shares) are not stored.
func TestHeavyCollectorsDropped(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(time.Hour)
	s.now = clock.now
	snapFull := snapshot.Snapshot{
		Seq: 1, TS: clock.now(), IntervalMS: 1000,
		Collectors: map[string]snapshot.Result{
			"cpu":       {OK: true, Data: map[string]any{"total": 1.0}},
			"processes": {OK: true, Data: map[string]any{"list": []any{}}},
		},
	}
	s.Add(snapFull)
	if _, ok := s.points[0].Collectors["processes"]; ok {
		t.Fatalf("processes collector should not be stored")
	}
	if _, ok := s.points[0].Collectors["cpu"]; !ok {
		t.Fatalf("cpu collector should be stored")
	}
}

// AC-38: Query clamps a window larger than retention to the retention window.
func TestQueryClampsWindow(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	s := New(10 * time.Second)
	s.now = clock.now
	for i := 0; i < 20; i++ {
		s.Add(snap(clock.now(), float64(i)))
		clock.tick()
	}
	got := s.Query(24 * time.Hour) // larger than window -> clamped to 10 s
	if len(got) > 10 {
		t.Fatalf("expected clamped query to return at most 10 points, got %d", len(got))
	}
}
