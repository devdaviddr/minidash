// Package network reports per-interface throughput for active interfaces.
package network

import (
	"context"
	"net"
	"sort"
	"sync"
	"time"

	gnet "github.com/shirou/gopsutil/v4/net"
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
func New() *Collector { return NewWith(realOS{}) }

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

type realOS struct{}

func (realOS) Interfaces(ctx context.Context) ([]Iface, error) {
	ifs, err := gnet.InterfacesWithContext(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Iface, 0, len(ifs))
	for _, i := range ifs {
		f := Iface{Name: i.Name}
		for _, fl := range i.Flags {
			switch fl {
			case "up":
				f.Up = true
			case "loopback":
				f.Loopback = true
			}
		}
		for _, a := range i.Addrs {
			ip, _, err := net.ParseCIDR(a.Addr)
			if err == nil && ip.To4() != nil {
				f.IPv4 = append(f.IPv4, ip.String())
			}
		}
		out = append(out, f)
	}
	return out, nil
}

func (realOS) Counters(ctx context.Context) (map[string]Counter, error) {
	cs, err := gnet.IOCountersWithContext(ctx, true)
	if err != nil {
		return nil, err
	}
	out := make(map[string]Counter, len(cs))
	for _, c := range cs {
		out[c.Name] = Counter{Rx: c.BytesRecv, Tx: c.BytesSent}
	}
	return out, nil
}
