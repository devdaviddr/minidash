// Package processes lists the busiest processes by CPU and by memory.
//
// The agent sends the union of the top N by CPU and the top N by resident memory, so the
// browser can sort either way without the full process table crossing the wire.
package processes

import (
	"context"
	"os/user"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/process"
)

// TopN is how many processes are kept per ranking.
const TopN = 25

// Data is the processes collector payload (contracts/snapshot.schema.json#/$defs/processesData).
type Data struct {
	Total int    `json:"total"` // processes visible to the agent
	List  []Proc `json:"list"`
}

// Proc is one process. CPU is percent of a single core (can exceed 100). RSS is bytes.
// Only the executable name is reported, never arguments, which can hold secrets.
type Proc struct {
	PID     int32   `json:"pid"`
	Name    string  `json:"name"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	RSS     uint64  `json:"rss"`
	Threads int32   `json:"threads"`
}

// Raw is the cheap per-process reading taken for every process each tick.
// CPUSeconds is cumulative user+system time.
type Raw struct {
	PID        int32
	CPUSeconds float64
	RSS        uint64
	Threads    int32
}

// OS abstracts the host so tests can supply fixed readings. List is cheap and runs for every
// process; Detail (name and owner) is costly, so it runs only for processes that make the list.
type OS interface {
	List(ctx context.Context) ([]Raw, error)
	Detail(ctx context.Context, pid int32) (name, user string)
}

// Collector implements snapshot.Collector for processes.
type Collector struct {
	os    OS
	now   func() time.Time
	mu    sync.Mutex
	prev  map[int32]float64
	prevT time.Time
}

// New returns a processes collector using the real OS.
func New() *Collector { return NewWith(newRealOS()) }

// NewWith returns a collector using the given OS (tests).
func NewWith(o OS) *Collector { return &Collector{os: o, now: time.Now} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "processes" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	raw, err := c.os.List(ctx)
	if err != nil {
		return nil, err
	}
	now := c.now()
	c.mu.Lock()
	prev, prevT := c.prev, c.prevT
	cur := make(map[int32]float64, len(raw))
	c.prev, c.prevT = cur, now
	c.mu.Unlock()
	secs := now.Sub(prevT).Seconds()

	all := make([]Proc, 0, len(raw))
	for _, r := range raw {
		cur[r.PID] = r.CPUSeconds
		p := Proc{PID: r.PID, RSS: r.RSS, Threads: r.Threads}
		if before, ok := prev[r.PID]; ok && secs > 0 && r.CPUSeconds >= before {
			p.CPU = (r.CPUSeconds - before) / secs * 100
		}
		all = append(all, p)
	}
	top := topUnion(all)
	for i := range top {
		top[i].Name, top[i].User = c.os.Detail(ctx, top[i].PID)
	}
	return Data{Total: len(all), List: top}, nil
}

// topUnion returns the top TopN by CPU plus the top TopN by RSS, each process once.
func topUnion(all []Proc) []Proc {
	byCPU := append([]Proc(nil), all...)
	sort.Slice(byCPU, func(i, j int) bool { return byCPU[i].CPU > byCPU[j].CPU })
	byRSS := append([]Proc(nil), all...)
	sort.Slice(byRSS, func(i, j int) bool { return byRSS[i].RSS > byRSS[j].RSS })

	seen := map[int32]bool{}
	out := []Proc{}
	for _, list := range [][]Proc{byCPU, byRSS} {
		for i := 0; i < TopN && i < len(list); i++ {
			if !seen[list[i].PID] {
				seen[list[i].PID] = true
				out = append(out, list[i])
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CPU > out[j].CPU })
	return out
}

type realOS struct {
	mu    sync.Mutex
	users map[uint32]string
}

func newRealOS() *realOS { return &realOS{users: map[uint32]string{}} }

func (r *realOS) username(uid uint32) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if n, ok := r.users[uid]; ok {
		return n
	}
	name := ""
	if u, err := user.LookupId(strconv.FormatUint(uint64(uid), 10)); err == nil {
		name = u.Username
	}
	r.users[uid] = name
	return name
}

func (r *realOS) List(ctx context.Context) ([]Raw, error) {
	pids, err := process.PidsWithContext(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Raw, 0, len(pids))
	for _, pid := range pids {
		// Build the handle directly: process.NewProcess would sysctl each PID for its start
		// time, a cost we do not need since we key on PID alone.
		p := &process.Process{Pid: pid}
		mi, err := p.MemoryInfoWithContext(ctx)
		if err != nil {
			continue // other users' processes may be unreadable
		}
		t, err := p.TimesWithContext(ctx)
		if err != nil {
			continue
		}
		th, _ := p.NumThreadsWithContext(ctx)
		out = append(out, Raw{PID: p.Pid, CPUSeconds: t.User + t.System, RSS: mi.RSS, Threads: th})
	}
	return out, nil
}

func (r *realOS) Detail(ctx context.Context, pid int32) (string, string) {
	p, err := process.NewProcessWithContext(ctx, pid)
	if err != nil {
		return "", ""
	}
	name, _ := p.NameWithContext(ctx)
	var usr string
	if uids, err := p.UidsWithContext(ctx); err == nil && len(uids) > 0 {
		usr = r.username(uint32(uids[0]))
	}
	return name, usr
}
