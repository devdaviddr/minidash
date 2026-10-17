package snapshot

import (
	"context"
	"testing"
	"time"
)

type counting struct{ n int }

func (*counting) Name() string { return "cpu" }
func (c *counting) Collect(context.Context) (any, error) {
	c.n++
	return c.n, nil
}

func TestThrottleRunsAtMostOncePerInterval(t *testing.T) {
	inner := &counting{}
	th := Throttle(inner, 2*time.Second).(*throttled)
	now := time.Unix(0, 0)
	th.now = func() time.Time { return now }
	ctx := context.Background()
	for i := 0; i < 3; i++ { // t=0,1,1.9 : one real call
		_, _ = th.Collect(ctx)
		now = now.Add(950 * time.Millisecond)
	}
	if inner.n != 1 {
		t.Fatalf("inner ran %d times, want 1", inner.n)
	}
	now = now.Add(time.Second)
	v, _ := th.Collect(ctx)
	if inner.n != 2 || v != 2 {
		t.Fatalf("expected refresh, n=%d v=%v", inner.n, v)
	}
	if th.Name() != "cpu" {
		t.Fatal("wrapper must keep the collector name")
	}
}
