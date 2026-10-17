//go:build darwin

package network

import (
	"context"

	"golang.org/x/sys/unix"
)

const ifdataGeneral = 1 // IFDATA_GENERAL

// Counters reads each known interface's 64-bit byte counters from the kernel.
func (r *realOS) Counters(ctx context.Context) (map[string]Counter, error) {
	if _, err := r.Interfaces(ctx); err != nil { // fills the index -> name table (cached)
		return nil, err
	}
	r.mu.Lock()
	idx := make(map[int]string, len(r.byIdx))
	for i, n := range r.byIdx {
		idx[i] = n
	}
	r.mu.Unlock()

	out := make(map[string]Counter, len(idx))
	for i, name := range idx {
		b, err := unix.SysctlRaw("net.link.generic.ifdata", i, ifdataGeneral)
		if err != nil {
			continue // interface vanished since the cache was filled
		}
		if c, ok := parseIfMib(b); ok {
			out[name] = c
		}
	}
	return out, nil
}
