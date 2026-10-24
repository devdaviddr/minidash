// Package snapshot defines the per-tick message and the aggregator that builds it.
// The wire shape is contracts/snapshot.schema.json.
package snapshot

import (
	"context"
	"errors"
	"sync"
	"time"
)

// SchemaVersion is the wire schema version carried in every snapshot.
const SchemaVersion = 1

// Result is one collector's output for a tick.
type Result struct {
	OK          bool   `json:"ok"`
	Unsupported bool   `json:"unsupported,omitempty"`
	Error       string `json:"error,omitempty"`
	Data        any    `json:"data,omitempty"`
}

// Host names the machine a snapshot came from (FR-40).
type Host struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	OS     string `json:"os"`
	Arch   string `json:"arch"`
	Model  string `json:"model,omitempty"`
	Kernel string `json:"kernel,omitempty"`
}

// UnsupportedError is returned by a collector that does not apply to this host, for
// example the Apple silicon collector on Linux. It is reported as unsupported, not as a
// failure (FR-43).
type UnsupportedError struct{ Reason string }

func (e *UnsupportedError) Error() string { return e.Reason }

// Unsupported returns the error a collector reports when it does not apply to this host.
func Unsupported(reason string) error { return &UnsupportedError{Reason: reason} }

// Snapshot is the message pushed to clients each tick.
type Snapshot struct {
	Schema     int               `json:"schema"`
	Seq        uint64            `json:"seq"`
	TS         time.Time         `json:"ts"`
	IntervalMS int64             `json:"intervalMs"`
	Host       *Host             `json:"host,omitempty"`
	Collectors map[string]Result `json:"collectors"`
}

// Collector samples one data source. Implementations must be read-only and safe to
// call once per tick; an error marks only that collector as failed.
type Collector interface {
	Name() string
	Collect(ctx context.Context) (any, error)
}

// Aggregator runs collectors each tick and publishes the combined snapshot.
type Aggregator struct {
	interval   time.Duration
	collectors []Collector
	host       *Host
	now        func() time.Time
	seq        uint64
}

// NewAggregator builds an aggregator ticking every interval.
func NewAggregator(interval time.Duration, cs ...Collector) *Aggregator {
	return &Aggregator{interval: interval, collectors: cs, now: time.Now}
}

// WithHost labels every snapshot with h (FR-40) and returns the aggregator.
func (a *Aggregator) WithHost(h Host) *Aggregator {
	a.host = &h
	return a
}

// Sample runs all collectors concurrently and returns the next snapshot.
func (a *Aggregator) Sample(ctx context.Context) Snapshot {
	a.seq++
	res := make(map[string]Result, len(a.collectors))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, c := range a.collectors {
		wg.Add(1)
		go func(c Collector) {
			defer wg.Done()
			data, err := safeCollect(ctx, c)
			r := result(data, err)
			mu.Lock()
			res[c.Name()] = r
			mu.Unlock()
		}(c)
	}
	wg.Wait()
	return Snapshot{Schema: SchemaVersion, Seq: a.seq, TS: a.now().UTC(), IntervalMS: a.interval.Milliseconds(), Host: a.host, Collectors: res}
}

// Run publishes a snapshot every interval until ctx is cancelled.
func (a *Aggregator) Run(ctx context.Context, publish func(Snapshot)) {
	t := time.NewTicker(a.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			publish(a.Sample(ctx))
		}
	}
}

// result turns one collector's output into its wire entry.
func result(data any, err error) Result {
	if err == nil {
		return Result{OK: true, Data: data}
	}
	var u *UnsupportedError
	if errors.As(err, &u) {
		return Result{Unsupported: true, Error: u.Reason}
	}
	return Result{Error: err.Error()}
}

// safeCollect isolates a panicking collector so it cannot take the agent down.
func safeCollect(ctx context.Context, c Collector) (data any, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = &panicError{c.Name()}
		}
	}()
	return c.Collect(ctx)
}

type panicError struct{ name string }

func (e *panicError) Error() string { return "collector " + e.name + " panicked" }
