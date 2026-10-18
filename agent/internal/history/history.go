// Package history stores collected snapshots for a configurable retention window (FR-34..FR-37).
//
// To stay inside the CPU and memory budget, history is downsampled by age: recent ticks are kept
// raw, and older data is coalesced into progressively coarser buckets. Buckets are computed when a
// bucket closes, not every tick, so retention adds no measurable per-tick cost (NFR budget).
//
// Only the lightweight time-series collectors are stored long-term; the heavy, slow-changing lists
// (processes, containers, shares) are dropped from stored history to keep the footprint small.
package history

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

// point is one stored time-series entry: a timestamp and the (possibly averaged) collector results.
type point struct {
	TS         time.Time                  `json:"ts"`
	Collectors map[string]snapshot.Result `json:"collectors"`
}

// bucketSpec is a resolution level and the age from which it applies.
type bucketSpec struct {
	period time.Duration
	minAge time.Duration
}

// bucketSpecs are the age-based resolutions, finest first (plan §0.7.0, FR-36):
// raw 1s -> 10s (from 10 min) -> 1 min (from 1 h) -> 5 min (from 24 h) -> 1 h (from 7 d).
var bucketSpecs = []bucketSpec{
	{period: time.Second, minAge: 0},
	{period: 10 * time.Second, minAge: 10 * time.Minute},
	{period: time.Minute, minAge: time.Hour},
	{period: 5 * time.Minute, minAge: 24 * time.Hour},
	{period: time.Hour, minAge: 7 * 24 * time.Hour},
}

// storedCollectors are the lightweight time-series kept long-term (FR-36).
var storedCollectors = map[string]bool{
	"cpu": true, "memory": true, "soc": true, "disk": true, "network": true,
}

// Store keeps a bounded, age-downsampled history of snapshots. It is the source the
// /history endpoint reads. Snapshots older than the retention window are pruned.
//
// History is persisted to a JSONL file under dir so it survives an agent restart (FR-34).
// The in-memory points are the working set; the file is rewritten on Compact, which runs on
// a slow cadence, not every tick, so persistence adds no measurable per-tick cost (NFR budget).
type Store struct {
	window time.Duration
	now    func() time.Time
	dir    string
	points []point
}

// New returns a Store that keeps history for window, persisted under dir. An empty dir
// disables persistence (used by tests); history then lives only in memory. Call Load() to
// read any existing history from disk; main does this once at startup.
func New(window time.Duration, dir string) *Store {
	return &Store{window: window, now: time.Now, dir: dir}
}

// Add records one snapshot. Ticks arrive in chronological order at age ~0, so each is stored raw.
// Coalescing happens in Compact, which re-buckets points as they age (FR-36).
func (s *Store) Add(snap snapshot.Snapshot) {
	ts := snap.TS
	if s.window > 0 && s.now().Sub(ts) > s.window {
		return
	}
	s.points = append(s.points, point{TS: ts, Collectors: keep(snap.Collectors)})
	s.prune()
}

// Compact re-buckets stored points by age: points older than a bucket's minAge are merged into
// period-aligned buckets. It is called on a slow cadence, not every tick, so retention adds no
// measurable per-tick CPU (NFR budget).
func (s *Store) Compact() {
	now := s.now()
	out := make([]point, 0, len(s.points))
	for _, p := range s.points {
		period := periodForAge(now.Sub(p.TS))
		if n := len(out); n > 0 && inBucket(out[n-1].TS, p.TS, period) {
			out[n-1] = point{TS: out[n-1].TS, Collectors: merge(out[n-1].Collectors, p.Collectors)}
			continue
		}
		out = append(out, p)
	}
	s.points = out
	s.save()
}

// periodForAge returns the bucket period for a given age.
func periodForAge(age time.Duration) time.Duration {
	spec := bucketSpecs[0]
	for _, b := range bucketSpecs {
		if age >= b.minAge {
			spec = b
		}
	}
	return spec.period
}

// Query returns stored points within the requested window, clamped to the retention window.
func (s *Store) Query(window time.Duration) []point {
	if window <= 0 || window > s.window {
		window = s.window
	}
	cutoff := s.now().Add(-window)
	out := make([]point, 0, len(s.points))
	for _, p := range s.points {
		if p.TS.After(cutoff) || p.TS.Equal(cutoff) {
			out = append(out, p)
		}
	}
	return out
}

// prune drops points older than the retention window.
func (s *Store) prune() {
	if s.window <= 0 {
		return
	}
	cutoff := s.now().Add(-s.window)
	i := 0
	for i < len(s.points) && !s.points[i].TS.After(cutoff) {
		i++
	}
	if i > 0 {
		s.points = s.points[i:]
	}
}

// historyFile is the JSONL file that persists stored history under dir (FR-34).
func (s *Store) historyFile() string {
	return filepath.Join(s.dir, "history.jsonl")
}

// Load reads persisted history from disk into the working set, dropping points older than the
// window. It is called once at startup so history survives a restart. A missing or unreadable
// file is treated as empty rather than fatal, so a bad history directory never stops the agent.
func (s *Store) Load() {
	if s.dir == "" {
		return
	}
	data, err := os.ReadFile(s.historyFile())
	if err != nil {
		return
	}
	cutoff := s.now().Add(-s.window)
	for _, line := range splitLines(data) {
		var p point
		if err := json.Unmarshal(line, &p); err != nil {
			continue
		}
		if s.window > 0 && p.TS.Before(cutoff) {
			continue
		}
		s.points = append(s.points, p)
	}
}

// save writes the current working set to disk as JSONL. It is called on the Compact cadence,
// not every tick. Persistence failures are logged to stderr and never crash the agent, since
// retention is best-effort and the in-memory history still serves /history.
func (s *Store) save() {
	if s.dir == "" {
		return
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "history: cannot create %s: %v\n", s.dir, err)
		return
	}
	var b []byte
	for _, p := range s.points {
		line, err := json.Marshal(p)
		if err != nil {
			continue
		}
		b = append(b, line...)
		b = append(b, '\n')
	}
	if err := os.WriteFile(s.historyFile(), b, 0o600); err != nil {
		fmt.Fprintf(os.Stderr, "history: cannot write %s: %v\n", s.historyFile(), err)
	}
}

// splitLines splits a JSONL blob into non-empty lines, tolerating a trailing newline.
func splitLines(data []byte) [][]byte {
	out := make([][]byte, 0, len(data)+1)
	start := 0
	for i := 0; i < len(data); i++ {
		if data[i] == '\n' {
			if i > start {
				out = append(out, data[start:i])
			}
			start = i + 1
		}
	}
	if start < len(data) {
		out = append(out, data[start:])
	}
	return out
}

// inBucket reports whether ts falls in the same period-aligned bucket as base.
func inBucket(base, ts time.Time, period time.Duration) bool {
	if period <= 0 {
		return false
	}
	return ts.Unix()/int64(period.Seconds()) == base.Unix()/int64(period.Seconds())
}

// keep drops the heavy collectors that are not stored long-term.
func keep(collectors map[string]snapshot.Result) map[string]snapshot.Result {
	out := make(map[string]snapshot.Result, len(collectors))
	for k, v := range collectors {
		if storedCollectors[k] {
			out[k] = v
		}
	}
	return out
}

// merge combines two collector results into one averaged point (FR-36). Numeric values inside each
// collector's Data are averaged; non-numeric values keep the newer reading.
func merge(a, b map[string]snapshot.Result) map[string]snapshot.Result {
	out := make(map[string]snapshot.Result, len(b))
	for k, br := range b {
		ar, ok := a[k]
		if !ok {
			out[k] = br
			continue
		}
		out[k] = snapshot.Result{OK: br.OK, Error: br.Error, Data: avg(ar.Data, br.Data)}
	}
	return out
}

// avg averages two values when both are numeric, otherwise keeps the newer one. Nested maps are
// averaged field by field so collector structs (e.g. cpu.Data) downsample correctly.
func avg(a, b any) any {
	af, aok := toFloat(a)
	bf, bok := toFloat(b)
	if aok && bok {
		return (af + bf) / 2
	}
	am, aIsMap := a.(map[string]any)
	bm, bIsMap := b.(map[string]any)
	if aIsMap && bIsMap {
		out := make(map[string]any, len(bm))
		for k, bv := range bm {
			if av, ok := am[k]; ok {
				out[k] = avg(av, bv)
			} else {
				out[k] = bv
			}
		}
		return out
	}
	return b
}

func toFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}
