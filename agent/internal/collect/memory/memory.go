// Package memory reports unified memory and swap on macOS.
package memory

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/mem"
)

// Data is the memory collector payload (contracts/snapshot.schema.json#/$defs/memoryData).
// All values are bytes. Used = active + wired + compressed.
type Data struct {
	Total      uint64 `json:"total"`
	Used       uint64 `json:"used"`
	Available  uint64 `json:"available"`
	Wired      uint64 `json:"wired"`
	Active     uint64 `json:"active"`
	Inactive   uint64 `json:"inactive"`
	Compressed uint64 `json:"compressed"`
	SwapUsed   uint64 `json:"swapUsed"`
	SwapTotal  uint64 `json:"swapTotal"`
}

// OS abstracts the host so tests can supply fixed readings.
type OS interface {
	VM(ctx context.Context) (*mem.VirtualMemoryStat, error)
	Swap(ctx context.Context) (*mem.SwapMemoryStat, error)
	VMStat(ctx context.Context) ([]byte, error)
}

// compressedTTL is how long the compressed-memory figure is reused. It comes from forking
// vm_stat, which dominated this collector's cost, and it moves slowly.
const compressedTTL = 5 * time.Second

// Collector implements snapshot.Collector for memory.
type Collector struct {
	os  OS
	now func() time.Time

	mu         sync.Mutex
	compressed uint64
	at         time.Time
}

// New returns a memory collector using the real OS.
func New() *Collector { return NewWith(realOS{}) }

// NewWith returns a collector using the given OS (tests).
func NewWith(o OS) *Collector { return &Collector{os: o, now: time.Now} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "memory" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	vm, err := c.os.VM(ctx)
	if err != nil {
		return nil, err
	}
	sw, err := c.os.Swap(ctx)
	if err != nil {
		return nil, err
	}
	compressed := c.compressedBytes(ctx)
	return Data{
		Total: vm.Total, Available: vm.Available, Wired: vm.Wired, Active: vm.Active, Inactive: vm.Inactive,
		Compressed: compressed, Used: vm.Active + vm.Wired + compressed,
		SwapUsed: sw.Used, SwapTotal: sw.Total,
	}, nil
}

// compressedBytes returns bytes held by the compressor, refreshed at most every compressedTTL.
// It is best-effort: a vm_stat failure keeps the previous value.
func (c *Collector) compressedBytes(ctx context.Context) uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.at.IsZero() && c.now().Sub(c.at) < compressedTTL {
		return c.compressed
	}
	if out, err := c.os.VMStat(ctx); err == nil {
		c.compressed = ParseCompressed(out)
	}
	c.at = c.now()
	return c.compressed
}

var (
	pageSizeRe   = regexp.MustCompile(`page size of (\d+) bytes`)
	compressorRe = regexp.MustCompile(`Pages occupied by compressor:\s+(\d+)\.`)
)

// ParseCompressed returns bytes held by the memory compressor from `vm_stat` output, or 0.
func ParseCompressed(out []byte) uint64 {
	ps := pageSizeRe.FindSubmatch(out)
	pages := compressorRe.FindSubmatch(out)
	if ps == nil || pages == nil {
		return 0
	}
	size, err1 := strconv.ParseUint(string(ps[1]), 10, 64)
	n, err2 := strconv.ParseUint(string(pages[1]), 10, 64)
	if err1 != nil || err2 != nil {
		return 0
	}
	return size * n
}

type realOS struct{}

func (realOS) VM(ctx context.Context) (*mem.VirtualMemoryStat, error) {
	return mem.VirtualMemoryWithContext(ctx)
}
func (realOS) Swap(ctx context.Context) (*mem.SwapMemoryStat, error) {
	return mem.SwapMemoryWithContext(ctx)
}
func (realOS) VMStat(ctx context.Context) ([]byte, error) {
	out, err := exec.CommandContext(ctx, "vm_stat").Output()
	if err != nil {
		return nil, fmt.Errorf("vm_stat: %w", err)
	}
	return out, nil
}
