// Package cpu reports total and per-core CPU utilisation and load average.
package cpu

import (
	"context"

	gcpu "github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/load"
)

// Data is the cpu collector payload (contracts/snapshot.schema.json#/$defs/cpuData).
type Data struct {
	Total float64   `json:"total"` // percent, 0-100, across all cores
	Cores []float64 `json:"cores"` // percent per logical core
	Load  Load      `json:"load"`
}

// Load is the 1/5/15 minute load average.
type Load struct {
	One     float64 `json:"one"`
	Five    float64 `json:"five"`
	Fifteen float64 `json:"fifteen"`
}

// Sampler abstracts the OS so tests can supply fixed readings.
type Sampler interface {
	Percent(ctx context.Context) ([]float64, error)
	Load(ctx context.Context) (Load, error)
}

// Collector implements snapshot.Collector for CPU.
type Collector struct{ s Sampler }

// New returns a CPU collector using the real OS. It primes the delta counters so the
// first tick is meaningful.
func New() *Collector {
	s := osSampler{}
	_, _ = s.Percent(context.Background())
	return &Collector{s: s}
}

// NewWith returns a collector using the given sampler (tests).
func NewWith(s Sampler) *Collector { return &Collector{s: s} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "cpu" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	cores, err := c.s.Percent(ctx)
	if err != nil {
		return nil, err
	}
	l, err := c.s.Load(ctx)
	if err != nil {
		return nil, err
	}
	var sum float64
	for _, v := range cores {
		sum += v
	}
	d := Data{Cores: cores, Load: l}
	if len(cores) > 0 {
		d.Total = sum / float64(len(cores))
	}
	return d, nil
}

type osSampler struct{}

// Percent returns utilisation per logical core since the previous call (interval 0).
func (osSampler) Percent(ctx context.Context) ([]float64, error) {
	return gcpu.PercentWithContext(ctx, 0, true)
}

func (osSampler) Load(ctx context.Context) (Load, error) {
	a, err := load.AvgWithContext(ctx)
	if err != nil {
		return Load{}, err
	}
	return Load{One: a.Load1, Five: a.Load5, Fifteen: a.Load15}, nil
}
