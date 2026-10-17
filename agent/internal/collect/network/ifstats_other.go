//go:build !darwin

package network

import (
	"context"

	gnet "github.com/shirou/gopsutil/v4/net"
)

// Counters falls back to gopsutil off macOS (development and CI on Linux).
func (r *realOS) Counters(ctx context.Context) (map[string]Counter, error) {
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
