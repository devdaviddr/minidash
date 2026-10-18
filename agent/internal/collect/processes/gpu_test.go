package processes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/collect/gputime"
	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

var gt0 = time.Unix(5000, 0)

// fakeGPU replays samples and errors in order, one per read, with a fake clock.
type fakeGPU struct {
	steps []gpuStep
	reads atomic.Int32
}

type gpuStep struct {
	at   float64 // seconds after gt0
	busy map[int32]uint64
	err  error
}

func (f *fakeGPU) Read(context.Context) (gputime.Sample, error) {
	i := int(f.reads.Add(1)) - 1
	if i >= len(f.steps) {
		return gputime.Sample{}, errors.New("fake: no more samples")
	}
	s := f.steps[i]
	if s.err != nil {
		return gputime.Sample{}, s.err
	}
	return gputime.Sample{At: gt0.Add(time.Duration(s.at * float64(time.Second))), Busy: s.busy}, nil
}

func procs(pids ...int32) []Raw {
	out := make([]Raw, len(pids))
	for i, p := range pids {
		out[i] = Raw{PID: p, RSS: 1, Threads: 1}
	}
	return out
}

func gpuOf(t *testing.T, d Data) map[int32]string {
	t.Helper()
	out := map[int32]string{}
	for _, p := range d.List {
		out[p.PID] = "null"
		if p.GPU != nil {
			out[p.PID] = fmt.Sprintf("%g", *p.GPU)
		}
	}
	return out
}

func collect(t *testing.T, c *Collector) Data {
	t.Helper()
	v, err := c.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return v.(Data)
}

// AC-29: through the collector, the first read is null everywhere, then delta / wall time
// over the interval between reads; no clients reads 0; a pid new to the GPU reads null.
func TestGPUPercentThroughCollector(t *testing.T) {
	os := &fakeOS{raw: procs(1, 2, 3)}
	gpu := &fakeGPU{steps: []gpuStep{
		{at: 0, busy: map[int32]uint64{1: 1e9}},
		{at: 3, busy: map[int32]uint64{1: 2.5e9, 3: 7e9}},
	}}
	c := NewWith(os, gpu, 1)
	d := collect(t, c)
	if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:null 2:null 3:null]" {
		t.Fatalf("first read: %s", got)
	}
	if d.GPUError != "" {
		t.Fatalf("gpuError = %q", d.GPUError)
	}
	d = collect(t, c)
	if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:50 2:0 3:null]" {
		t.Fatalf("second read: %s", got)
	}
}

// Plan DD-24: between GPU reads the last values are reused; a process that appeared since
// the last read is null until the next one.
func TestGPUIntervalReusesValues(t *testing.T) {
	os := &fakeOS{raw: procs(1)}
	gpu := &fakeGPU{steps: []gpuStep{
		{at: 0, busy: map[int32]uint64{1: 0}},
		{at: 6, busy: map[int32]uint64{1: 1.2e9}},
		{at: 12, busy: map[int32]uint64{1: 1.2e9}},
	}}
	c := NewWith(os, gpu, 2) // a 6 s interval with the 3 s refresh
	collect(t, c)            // read 1
	collect(t, c)            // no read
	d := collect(t, c)       // read 2: 1.2 s in 6 s = 20%
	if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:20]" {
		t.Fatalf("after read 2: %s", got)
	}
	os.raw = procs(1, 2)
	d = collect(t, c) // no read: pid 1 keeps 20, pid 2 is new
	if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:20 2:null]" {
		t.Fatalf("between reads: %s", got)
	}
	d = collect(t, c) // read 3: idle
	if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:0 2:0]" {
		t.Fatalf("after read 3: %s", got)
	}
	if n := gpu.reads.Load(); n != 3 {
		t.Fatalf("reads = %d, want 3", n)
	}
}

// AC-30: a GPU-heavy process outside both top-25 lists is added; 0 GPU adds nobody; no dups.
func TestListAddsTopGPU(t *testing.T) {
	raw := many(100, func(i int) uint64 { return uint64(i + 1) }, func(i int) float64 { return float64(100 - i) })
	raw = append(raw, Raw{PID: 500, RSS: 0, CPUSeconds: 0})
	os := &fakeOS{raw: raw}
	busy0 := map[int32]uint64{500: 0, 30: 0}
	busy1 := map[int32]uint64{500: 2e9, 30: 0}
	c := NewWith(os, &fakeGPU{steps: []gpuStep{{at: 0, busy: busy0}, {at: 3, busy: busy1}}}, 1)
	now := time.Unix(0, 0)
	c.now = func() time.Time { return now }
	collect(t, c)
	now = now.Add(3 * time.Second)
	os.raw = many(100, func(i int) uint64 { return uint64(i + 1) }, func(i int) float64 { return float64(100-i) * 2 })
	os.raw = append(os.raw, Raw{PID: 500})
	d := collect(t, c)
	if len(d.List) != 2*TopN+1 {
		t.Fatalf("list = %d, want %d", len(d.List), 2*TopN+1)
	}
	seen := map[int32]bool{}
	for _, p := range d.List {
		if seen[p.PID] {
			t.Fatalf("duplicate pid %d", p.PID)
		}
		seen[p.PID] = true
	}
	if !seen[500] {
		t.Fatal("GPU-heavy pid 500 is missing")
	}
}

func TestListAddsNobodyForZeroGPU(t *testing.T) {
	raw := many(100, func(i int) uint64 { return uint64(i + 1) }, func(int) float64 { return 0 })
	busy := map[int32]uint64{}
	for i := range int32(100) {
		busy[i+1] = 0
	}
	c := NewWith(&fakeOS{raw: raw}, &fakeGPU{steps: []gpuStep{{at: 0, busy: busy}, {at: 3, busy: busy}}}, 1)
	collect(t, c)
	if d := collect(t, c); len(d.List) != 2*TopN {
		t.Fatalf("list = %d, want %d", len(d.List), 2*TopN)
	}
}

// AC-31: every kind of reader failure leaves the list intact, nulls every gpu and names the
// reason; the next success measures from the last good baseline.
func TestGPUFailureKeepsListAndBaseline(t *testing.T) {
	_, parseErr := gputime.Parse([]byte("not a plist"))
	for name, fail := range map[string]error{
		"error":     errors.New("ioreg: exit status 1"),
		"timeout":   gputime.ErrTimeout,
		"oversized": gputime.ErrOversized,
		"malformed": parseErr,
	} {
		t.Run(name, func(t *testing.T) {
			gpu := &fakeGPU{steps: []gpuStep{
				{at: 0, busy: map[int32]uint64{1: 1e9}},
				{err: fail},
				{at: 6, busy: map[int32]uint64{1: 4e9}},
			}}
			c := NewWith(&fakeOS{raw: procs(1, 2)}, gpu, 1)
			collect(t, c)
			d := collect(t, c)
			if len(d.List) != 2 || d.Total != 2 {
				t.Fatalf("list = %d total = %d", len(d.List), d.Total)
			}
			if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:null 2:null]" {
				t.Fatalf("on failure: %s", got)
			}
			if d.GPUError != fail.Error() {
				t.Fatalf("gpuError = %q, want %q", d.GPUError, fail.Error())
			}
			d = collect(t, c) // 3 s of GPU over 6 s since the last good sample
			if got := fmt.Sprint(gpuOf(t, d)); got != "map[1:50 2:0]" || d.GPUError != "" {
				t.Fatalf("after recovery: %s %q", got, d.GPUError)
			}
		})
	}
}

// AC-31: a hung reader cannot hold up the process list past the timeout, and a reader that
// ignores its context is not started again while it still runs.
func TestGPUHungReader(t *testing.T) {
	release := make(chan struct{})
	defer close(release)
	hung := gputime.ReaderFunc(func(context.Context) (gputime.Sample, error) {
		<-release
		return gputime.Sample{}, nil
	})
	c := NewWith(&fakeOS{raw: procs(1)}, hung, 1)
	c.gpu.timeout = 200 * time.Millisecond
	start := time.Now()
	d := collect(t, c)
	if el := time.Since(start); el > c.gpu.timeout+300*time.Millisecond {
		t.Fatalf("collect took %v", el)
	}
	if d.GPUError != gputime.ErrTimeout.Error() || len(d.List) != 1 || d.List[0].GPU != nil {
		t.Fatalf("data = %+v", d)
	}
	if d = collect(t, c); d.GPUError != errStillRunning.Error() {
		t.Fatalf("second gpuError = %q", d.GPUError)
	}
}

// AC-31 with the real reader's timeout: the collector returns within gputime.Timeout.
func TestGPUTimeoutWithinReaderTimeout(t *testing.T) {
	slow := gputime.ReaderFunc(func(ctx context.Context) (gputime.Sample, error) {
		<-ctx.Done()
		return gputime.Sample{}, ctx.Err()
	})
	c := NewWith(&fakeOS{raw: procs(1)}, slow, 1)
	start := time.Now()
	d := collect(t, c)
	if el := time.Since(start); el > gputime.Timeout+300*time.Millisecond {
		t.Fatalf("collect took %v", el)
	}
	if d.GPUError != gputime.ErrTimeout.Error() {
		t.Fatalf("gpuError = %q", d.GPUError)
	}
}

// Plan DD-24: with the interval at 0 the reader is never called and the card says why.
func TestGPUOff(t *testing.T) {
	gpu := &fakeGPU{}
	c := NewWith(&fakeOS{raw: procs(1)}, gpu, 0)
	for range 3 {
		d := collect(t, c)
		if d.GPUError != GPUOff || d.List[0].GPU != nil {
			t.Fatalf("data = %+v", d)
		}
	}
	if gpu.reads.Load() != 0 {
		t.Fatal("reader called while off")
	}
}

// AC-34: the 0.6.0 collector's output, with numbers, nulls and gpuError, matches the schema,
// and a null gpu is sent explicitly.
func TestGPUMatchesContract(t *testing.T) {
	gpu := &fakeGPU{steps: []gpuStep{
		{at: 0, busy: map[int32]uint64{1: 0}},
		{at: 3, busy: map[int32]uint64{1: 9e9, 3: 1}},
		{err: gputime.ErrTimeout},
	}}
	c := NewWith(&fakeOS{raw: procs(1, 2, 3)}, gpu, 1)
	collect(t, c)
	r := testutil.AssertMatchesContract(t, c)
	if got := fmt.Sprint(gpuOf(t, r.Data.(Data))); got != "map[1:100 2:0 3:null]" {
		t.Fatalf("values: %s", got)
	}
	raw, err := json.Marshal(r.Data)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"gpu":null`) {
		t.Fatalf("null gpu not sent: %s", raw)
	}
	if r = testutil.AssertMatchesContract(t, c); r.Data.(Data).GPUError == "" {
		t.Fatal("want gpuError in the failing round")
	}
}
