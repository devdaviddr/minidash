package gputime

// Rates is GPU use per pid over the interval between two successful samples (FR-29).
type Rates struct {
	known bool               // false before two samples exist, or when time did not advance
	pct   map[int32]*float64 // pids with GPU clients in the newer sample; nil value = unknown
}

// ComputeRates applies FR-29's rules to two samples. prev with a nil Busy map means there is
// no earlier sample. For a pid with clients in cur:
//   - not in prev, or its summed time went down (a client closed or the pid was reused): nil;
//   - otherwise Δns / Δt × 100, clamped to 0–100.
//
// The caller keeps cur as the next baseline whatever the result, so a drop resets it.
func ComputeRates(prev, cur Sample) Rates {
	dt := cur.At.Sub(prev.At)
	if prev.Busy == nil || dt <= 0 {
		return Rates{}
	}
	r := Rates{known: true, pct: make(map[int32]*float64, len(cur.Busy))}
	for pid, now := range cur.Busy {
		before, ok := prev.Busy[pid]
		if !ok || now < before {
			r.pct[pid] = nil
			continue
		}
		v := min(float64(now-before)/float64(dt.Nanoseconds())*100, 100)
		r.pct[pid] = &v
	}
	return r
}

// For returns the GPU % for pid, or nil when it cannot be known. A pid with no GPU clients
// reads 0 once two samples exist.
func (r Rates) For(pid int32) *float64 {
	if !r.known {
		return nil
	}
	if v, ok := r.pct[pid]; ok {
		return v
	}
	zero := 0.0
	return &zero
}
