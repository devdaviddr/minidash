package processes

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

type fakeOS struct{ raw []Raw }

func (f *fakeOS) List(context.Context) ([]Raw, error) { return f.raw, nil }
func (f *fakeOS) Detail(_ context.Context, pid int32) (string, string) {
	return fmt.Sprintf("proc%d", pid), "tester"
}

func many(n int, rss func(i int) uint64, cpu func(i int) float64) []Raw {
	out := make([]Raw, n)
	for i := range out {
		out[i] = Raw{PID: int32(i + 1), RSS: rss(i), CPUSeconds: cpu(i), Threads: 1}
	}
	return out
}

func TestCPUFromDeltaOverElapsedTime(t *testing.T) {
	f := &fakeOS{raw: []Raw{{PID: 1, CPUSeconds: 10, RSS: 1}}}
	c := NewWith(f)
	now := time.Unix(0, 0)
	c.now = func() time.Time { return now }
	_, _ = c.Collect(context.Background())
	now = now.Add(2 * time.Second)
	f.raw = []Raw{{PID: 1, CPUSeconds: 13, RSS: 1}} // 3 CPU-seconds in 2 s = 150% of one core
	v, _ := c.Collect(context.Background())
	if got := v.(Data).List[0].CPU; got != 150 {
		t.Fatalf("cpu = %v, want 150", got)
	}
}

func TestListIsUnionOfTopCPUAndTopMemoryWithoutDuplicates(t *testing.T) {
	// pid 1..100: rss grows with pid, cpu shrinks with pid -> the two top-25 sets are disjoint.
	f := &fakeOS{raw: many(100, func(i int) uint64 { return uint64(i + 1) }, func(int) float64 { return 0 })}
	c := NewWith(f)
	now := time.Unix(0, 0)
	c.now = func() time.Time { return now }
	_, _ = c.Collect(context.Background())
	now = now.Add(time.Second)
	f.raw = many(100, func(i int) uint64 { return uint64(i + 1) }, func(i int) float64 { return float64(100 - i) })
	v, _ := c.Collect(context.Background())
	d := v.(Data)
	if d.Total != 100 || len(d.List) != 2*TopN {
		t.Fatalf("total=%d list=%d", d.Total, len(d.List))
	}
	seen := map[int32]bool{}
	for _, p := range d.List {
		if seen[p.PID] {
			t.Fatalf("duplicate pid %d", p.PID)
		}
		seen[p.PID] = true
	}
	if d.List[0].PID != 1 {
		t.Fatalf("list should be CPU-sorted, first = %d", d.List[0].PID)
	}
}

func TestDetailOnlyForListedProcesses(t *testing.T) {
	calls := 0
	f := &countingOS{fakeOS: fakeOS{raw: many(500, func(i int) uint64 { return uint64(i) }, func(int) float64 { return 0 })}, calls: &calls}
	_, _ = NewWith(f).Collect(context.Background())
	if calls > 2*TopN {
		t.Fatalf("Detail called %d times for 500 processes; want <= %d", calls, 2*TopN)
	}
}

type countingOS struct {
	fakeOS
	calls *int
}

func (c *countingOS) Detail(ctx context.Context, pid int32) (string, string) {
	*c.calls++
	return c.fakeOS.Detail(ctx, pid)
}

func TestMatchesContract(t *testing.T) {
	f := &fakeOS{raw: many(5, func(i int) uint64 { return uint64(i) }, func(int) float64 { return 0 })}
	if r := testutil.AssertMatchesContract(t, NewWith(f)); !r.OK {
		t.Fatal(r.Error)
	}
}

// AC-5: the top-memory process the collector reports matches `ps` within one sample.
func TestTopMemoryMatchesPS(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("uses BSD ps -m")
	}
	c := New()
	r := testutil.AssertMatchesContract(t, c)
	if !r.OK {
		t.Fatal(r.Error)
	}
	list := r.Data.(Data).List
	top := list[0]
	for _, p := range list {
		if p.RSS > top.RSS {
			top = p
		}
	}
	out, err := exec.Command("ps", "-Ao", "pid=,rss=", "-m").Output() // -m sorts by memory
	if err != nil {
		t.Skip("ps unavailable")
	}
	var psTop []string
	for i, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if i >= 3 {
			break
		}
		psTop = append(psTop, strings.Fields(line)[0])
	}
	want := strconv.Itoa(int(top.PID))
	for _, id := range psTop {
		if id == want {
			return
		}
	}
	t.Fatalf("collector top-memory pid %s not in ps top 3 %v", want, psTop)
}
