package snapshot

import (
	"context"
	"sync"
	"time"
)

type throttled struct {
	Collector
	every time.Duration
	now   func() time.Time

	mu   sync.Mutex
	at   time.Time
	data any
	err  error
}

// Throttle wraps c so it runs at most once per every, serving the previous result in between.
// It keeps costly collectors inside the CPU budget while the stream stays at 1 Hz.
func Throttle(c Collector, every time.Duration) Collector {
	return &throttled{Collector: c, every: every, now: time.Now}
}

func (t *throttled) Collect(ctx context.Context) (any, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if !t.at.IsZero() && t.now().Sub(t.at) < t.every {
		return t.data, t.err
	}
	t.data, t.err = t.Collector.Collect(ctx)
	t.at = t.now()
	return t.data, t.err
}
