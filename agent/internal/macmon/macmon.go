// Package macmon runs the `macmon pipe` helper and keeps its latest sample.
// macmon reads Apple Silicon GPU, power, temperature and fan data without root.
package macmon

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"time"
)

// MaxAge is how old a sample may be before it is treated as missing.
const MaxAge = 5 * time.Second

// ErrUnavailable means macmon is not installed or has produced no recent sample.
var ErrUnavailable = errors.New("macmon unavailable (install with: brew install macmon)")

// Sample mirrors the subset of `macmon pipe` JSON that minidash uses.
type Sample struct {
	AllPower   float64 `json:"all_power"`
	CPUPower   float64 `json:"cpu_power"`
	GPUPower   float64 `json:"gpu_power"`
	ANEPower   float64 `json:"ane_power"`
	RAMPower   float64 `json:"ram_power"`
	SysPower   float64 `json:"sys_power"`
	GPUFreqMHz float64 `json:"gpu_freq_mhz"`
	GPUActive  float64 `json:"gpu_active_ratio"` // 0..1
	CPUTiers   []Tier  `json:"cpu_tiers"`
	Fans       []Fan   `json:"fans"`
	Temp       Temp    `json:"temp"`
	Memory     Memory  `json:"memory"`
}

// Tier is a CPU cluster (E or P).
type Tier struct {
	Label       string  `json:"label"`
	ActiveRatio float64 `json:"active_ratio"`
	FreqMHz     float64 `json:"freq_mhz"`
}

// Fan is one fan reading.
type Fan struct {
	Name   string  `json:"name"`
	RPM    float64 `json:"rpm"`
	MaxRPM float64 `json:"max_rpm"`
}

// Temp holds average die temperatures in Celsius.
type Temp struct {
	CPU float64 `json:"cpu_temp_avg"`
	GPU float64 `json:"gpu_temp_avg"`
}

// Memory is macmon's view of RAM and swap, in bytes.
type Memory struct {
	RAMTotal  float64 `json:"ram_total"`
	RAMUsage  float64 `json:"ram_usage"`
	SwapTotal float64 `json:"swap_total"`
	SwapUsage float64 `json:"swap_usage"`
}

// Parse decodes one line of `macmon pipe` output.
func Parse(line []byte) (Sample, error) {
	var s Sample
	if err := json.Unmarshal(line, &s); err != nil {
		return Sample{}, fmt.Errorf("parse macmon sample: %w", err)
	}
	return s, nil
}

// Source supplies the latest sample.
type Source interface {
	Latest() (Sample, error)
}

// Runner keeps a `macmon pipe` subprocess alive and remembers its newest sample.
type Runner struct {
	bin string
	mu  sync.RWMutex
	cur Sample
	at  time.Time
	now func() time.Time
}

// NewRunner returns a Runner for the given macmon binary path (or name on PATH).
func NewRunner(bin string) *Runner { return &Runner{bin: bin, now: time.Now} }

// Latest returns the newest sample, or ErrUnavailable if none is recent.
func (r *Runner) Latest() (Sample, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.at.IsZero() || r.now().Sub(r.at) > MaxAge {
		return Sample{}, ErrUnavailable
	}
	return r.cur, nil
}

func (r *Runner) set(s Sample) {
	r.mu.Lock()
	r.cur, r.at = s, r.now()
	r.mu.Unlock()
}

// Run starts macmon and restarts it with a delay if it exits, until ctx ends.
func (r *Runner) Run(ctx context.Context) {
	for ctx.Err() == nil {
		_ = r.runOnce(ctx)
		select {
		case <-ctx.Done():
		case <-time.After(5 * time.Second):
		}
	}
}

func (r *Runner) runOnce(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, r.bin, "pipe", "-i", "1000")
	out, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	sc := bufio.NewScanner(out)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		if s, err := Parse(sc.Bytes()); err == nil {
			r.set(s)
		}
	}
	return cmd.Wait()
}
