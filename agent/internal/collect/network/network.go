// Package network reports per-interface throughput for active interfaces.
package network

import (
	"context"
	"net"
	"sort"
	"sync"
	"time"
)

// Data is the network collector payload (contracts/snapshot.schema.json#/$defs/networkData).
type Data struct {
	Interfaces []Interface `json:"interfaces"`
	Total      Rate        `json:"total"`
}

// Rate is bytes per second.
type Rate struct {
	RxBps float64 `json:"rxBps"`
	TxBps float64 `json:"txBps"`
}

// Interface is one active network interface.
type Interface struct {
	Name string   `json:"name"`
	IPv4 []string `json:"ipv4"`
	Rate
	RxBytes uint64 `json:"rxBytes"` // cumulative since boot
	TxBytes uint64 `json:"txBytes"`
}

// Iface is an interface as reported by the OS.
type Iface struct {
	Name     string
	Up       bool
	Loopback bool
	IPv4     []string
}

// Counter is cumulative bytes for an interface.
type Counter struct{ Rx, Tx uint64 }

// OS abstracts the host so tests can supply fixed readings.
type OS interface {
	Interfaces(ctx context.Context) ([]Iface, error)
	Counters(ctx context.Context) (map[string]Counter, error)
}

// Collector implements snapshot.Collector for networking.
type Collector struct {
	os    OS
	now   func() time.Time
	mu    sync.Mutex
	prev  map[string]Counter
	prevT time.Time
}

// New returns a network collector using the real OS.
func New() *Collector { return NewWith(newRealOS()) }

// NewWith returns a collector using the given OS (tests).
func NewWith(o OS) *Collector { return &Collector{os: o, now: time.Now} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "network" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	ifs, err := c.os.Interfaces(ctx)
	if err != nil {
		return nil, err
	}
	cur, err := c.os.Counters(ctx)
	if err != nil {
		return nil, err
	}
	now := c.now()
	c.mu.Lock()
	prev, prevT := c.prev, c.prevT
	c.prev, c.prevT = cur, now
	c.mu.Unlock()
	secs := now.Sub(prevT).Seconds()

	d := Data{Interfaces: []Interface{}}
	for _, i := range ifs {
		if !i.Up || i.Loopback || len(i.IPv4) == 0 {
			continue // "active" = up, not loopback, has an IPv4 address
		}
		cn := cur[i.Name]
		it := Interface{Name: i.Name, IPv4: i.IPv4, RxBytes: cn.Rx, TxBytes: cn.Tx}
		if p, ok := prev[i.Name]; ok && secs > 0 && cn.Rx >= p.Rx && cn.Tx >= p.Tx {
			it.RxBps = float64(cn.Rx-p.Rx) / secs
			it.TxBps = float64(cn.Tx-p.Tx) / secs
		}
		d.Total.RxBps += it.RxBps
		d.Total.TxBps += it.TxBps
		d.Interfaces = append(d.Interfaces, it)
	}
	sort.Slice(d.Interfaces, func(a, b int) bool { return d.Interfaces[a].Name < d.Interfaces[b].Name })
	return d, nil
}

// ifaceCacheTTL is how long the interface list (flags, addresses) is reused. It changes rarely;
// byte counters are still read every tick.
const ifaceCacheTTL = 5 * time.Second

type realOS struct {
	mu    sync.Mutex
	ifs   []Iface
	ifsAt time.Time
	byIdx map[int]string // interface index -> name, for the kernel counter table
	nowFn func() time.Time
}

func newRealOS() *realOS { return &realOS{byIdx: map[int]string{}, nowFn: time.Now} }

func (r *realOS) Interfaces(context.Context) ([]Iface, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.ifs != nil && r.nowFn().Sub(r.ifsAt) < ifaceCacheTTL {
		return r.ifs, nil
	}
	all, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	out := make([]Iface, 0, len(all))
	for _, i := range all {
		f := Iface{Name: i.Name, Up: i.Flags&net.FlagUp != 0, Loopback: i.Flags&net.FlagLoopback != 0}
		r.byIdx[i.Index] = i.Name
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil {
				f.IPv4 = append(f.IPv4, ipn.IP.String())
			}
		}
		out = append(out, f)
	}
	r.ifs, r.ifsAt = out, r.nowFn()
	return out, nil
}
