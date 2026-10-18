package processes

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/collect/gputime"
)

// errStillRunning guards against piling up reads behind a reader that ignores its context.
var errStillRunning = errors.New("the previous GPU read is still running")

// gpuState runs the GPU reader every few refreshes and keeps what the process table needs
// between reads (FR-29, FR-31, plan DD-24).
type gpuState struct {
	reader  gputime.Reader
	every   int           // read on every n-th refresh; 0 = off
	timeout time.Duration // the collector stops waiting after this, whatever the reader does
	busy    atomic.Bool   // a read is in flight

	mu    sync.Mutex
	calls int
	base  gputime.Sample // last successful sample; kept on error, so the next success spans the gap
	rates gputime.Rates  // computed at the last read
	pids  map[int32]bool // processes that existed at the last read
	err   string         // non-empty while every value is null
}

// gpuView is what one refresh uses: a GPU % per pid, or the reason none is known.
type gpuView struct {
	rates gputime.Rates
	pids  map[int32]bool
	err   string
}

// For returns pid's GPU %. A process that appeared since the last read is unknown.
func (v gpuView) For(pid int32) *float64 {
	if v.err != "" || !v.pids[pid] {
		return nil
	}
	return v.rates.For(pid)
}

type gpuResult struct {
	s   gputime.Sample
	err error
}

func newGPUState(r gputime.Reader, every int) *gpuState {
	g := &gpuState{reader: r, every: every, timeout: gputime.Timeout}
	if every <= 0 {
		g.err = GPUOff
	}
	return g
}

// start begins a GPU read if one is due this refresh, and returns nil if not.
func (g *gpuState) start(ctx context.Context) <-chan gpuResult {
	if g.every <= 0 {
		return nil
	}
	g.mu.Lock()
	due := g.calls%g.every == 0
	g.calls++
	g.mu.Unlock()
	if !due {
		return nil
	}
	out := make(chan gpuResult, 1)
	if !g.busy.CompareAndSwap(false, true) {
		out <- gpuResult{err: errStillRunning}
		return out
	}
	ctx, cancel := context.WithTimeout(ctx, g.timeout)
	in := make(chan gpuResult, 1)
	go func() {
		defer g.busy.Store(false)
		s, err := g.reader.Read(ctx)
		in <- gpuResult{s, err}
	}()
	go func() {
		defer cancel()
		select {
		case r := <-in:
			out <- r
		case <-ctx.Done():
			out <- gpuResult{err: timeoutErr(ctx.Err())}
		}
	}()
	return out
}

// timeoutErr reports the collector's own deadline the same way as the reader's.
func timeoutErr(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return gputime.ErrTimeout
	}
	return err
}

// finish joins a read started this refresh (if any), updates the state and returns the view
// for this refresh. pids are the processes in this refresh's scan.
func (g *gpuState) finish(read <-chan gpuResult, pids map[int32]bool) gpuView {
	if read != nil {
		r := <-read
		g.apply(r, pids)
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return gpuView{rates: g.rates, pids: g.pids, err: g.err}
}

func (g *gpuState) apply(r gpuResult, pids map[int32]bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if r.err != nil {
		g.rates, g.err = gputime.Rates{}, r.err.Error()
		return
	}
	g.rates = gputime.ComputeRates(g.base, r.s)
	g.base, g.pids, g.err = r.s, pids, ""
}
