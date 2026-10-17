// Package containers reports running containers for Docker, Podman and Colima.
//
// All three expose the Docker Engine API on a unix socket, so one client serves them. A runtime
// whose socket is missing or refuses connections is reported as "not-running", never as an error:
// being stopped is normal. Only an unexpected API failure is "error". The client is read-only
// (GET requests only).
package containers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Runtime statuses.
const (
	StatusRunning    = "running"
	StatusNotRunning = "not-running"
	StatusError      = "error"
)

const (
	requestTimeout = 3 * time.Second
	maxContainers  = 100
)

// Data is the containers collector payload (contracts/snapshot.schema.json#/$defs/containersData).
type Data struct {
	Runtimes []Runtime `json:"runtimes"`
}

// Runtime is one container runtime and what it is running.
type Runtime struct {
	Name       string      `json:"name"`
	Status     string      `json:"status"`
	Error      string      `json:"error,omitempty"`
	Containers []Container `json:"containers"`
}

// Container is one running container. CPU is percent of one core; memory in bytes; rates in bytes/s.
type Container struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Image    string  `json:"image"`
	State    string  `json:"state"`
	Status   string  `json:"status"`
	CPU      float64 `json:"cpu"`
	MemUsed  uint64  `json:"memUsed"`
	MemLimit uint64  `json:"memLimit"`
	RxBps    float64 `json:"rxBps"`
	TxBps    float64 `json:"txBps"`
}

// Endpoint names a runtime and the unix sockets it may listen on, in preference order.
type Endpoint struct {
	Name    string
	Sockets []string
}

// DefaultEndpoints returns the usual socket locations for a user's runtimes. Colima and Podman come
// before Docker so a /var/run/docker.sock symlink into Colima is not counted twice.
func DefaultEndpoints(home, tmpdir string) []Endpoint {
	glob := func(p string) []string { m, _ := filepath.Glob(p); sort.Strings(m); return m }
	colima := append([]string{filepath.Join(home, ".colima", "default", "docker.sock")}, glob(filepath.Join(home, ".colima", "*", "docker.sock"))...)
	podman := append([]string{filepath.Join(home, ".local", "share", "containers", "podman", "machine", "podman.sock")}, glob(filepath.Join(tmpdir, "podman", "*-api.sock"))...)
	podman = append(podman, "/var/run/podman/podman.sock")
	return []Endpoint{
		{Name: "colima", Sockets: colima},
		{Name: "podman", Sockets: podman},
		{Name: "docker", Sockets: []string{"/var/run/docker.sock", filepath.Join(home, ".docker", "run", "docker.sock")}},
	}
}

// Collector implements snapshot.Collector for containers.
type Collector struct {
	endpoints func() []Endpoint // re-evaluated each tick so newly started runtimes appear
	now       func() time.Time
	mu        sync.Mutex
	prev      map[string]sample // key: runtime/containerID
}

// New returns a collector for the default endpoints of the current user.
func New() *Collector {
	return NewWith(func() []Endpoint {
		home, _ := os.UserHomeDir()
		return DefaultEndpoints(home, os.TempDir())
	})
}

// NewWith returns a collector for the given endpoints (tests).
func NewWith(endpoints func() []Endpoint) *Collector {
	return &Collector{endpoints: endpoints, now: time.Now, prev: map[string]sample{}}
}

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "containers" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	now := c.now()
	eps := c.endpoints()
	out := make([]Runtime, len(eps))
	seen := map[string]bool{} // resolved socket paths already claimed by an earlier runtime
	nextPrev := map[string]sample{}
	var mu sync.Mutex

	c.mu.Lock()
	prev := c.prev
	c.mu.Unlock()

	var wg sync.WaitGroup
	for i, ep := range eps {
		sock := pickSocket(ep.Sockets, seen)
		out[i] = Runtime{Name: ep.Name, Status: StatusNotRunning, Containers: []Container{}}
		if sock == "" {
			continue
		}
		wg.Add(1)
		go func(i int, name, sock string) {
			defer wg.Done()
			r, samples := queryRuntime(ctx, name, sock, now, prev)
			out[i] = r
			mu.Lock()
			for k, v := range samples {
				nextPrev[k] = v
			}
			mu.Unlock()
		}(i, ep.Name, sock)
	}
	wg.Wait()

	c.mu.Lock()
	c.prev = nextPrev
	c.mu.Unlock()
	return Data{Runtimes: out}, nil
}

// pickSocket returns the first existing socket not already claimed (by resolved path), or "".
func pickSocket(candidates []string, seen map[string]bool) string {
	for _, s := range candidates {
		fi, err := os.Stat(s)
		if err != nil || fi.Mode()&os.ModeSocket == 0 {
			continue
		}
		real, err := filepath.EvalSymlinks(s)
		if err != nil {
			real = s
		}
		if seen[real] {
			continue
		}
		seen[real] = true
		return s
	}
	return ""
}

type sample struct {
	total, system uint64
	rx, tx        uint64
	at            time.Time
}

type apiContainer struct {
	ID     string   `json:"Id"`
	Names  []string `json:"Names"`
	Image  string   `json:"Image"`
	State  string   `json:"State"`
	Status string   `json:"Status"`
}

type apiStats struct {
	CPUStats struct {
		CPUUsage struct {
			Total uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		System uint64 `json:"system_cpu_usage"`
		Online uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	MemoryStats struct {
		Usage uint64            `json:"usage"`
		Limit uint64            `json:"limit"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		Rx uint64 `json:"rx_bytes"`
		Tx uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

func queryRuntime(ctx context.Context, name, sock string, now time.Time, prev map[string]sample) (Runtime, map[string]sample) {
	r := Runtime{Name: name, Status: StatusRunning, Containers: []Container{}}
	cl := newClient(sock)
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	var list []apiContainer
	if err := cl.get(ctx, "/containers/json", &list); err != nil {
		if isDown(err) {
			r.Status = StatusNotRunning
		} else {
			r.Status, r.Error = StatusError, err.Error()
		}
		return r, nil
	}
	if len(list) > maxContainers {
		list = list[:maxContainers]
	}
	r.Containers = make([]Container, len(list))
	samples := map[string]sample{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i, ac := range list {
		r.Containers[i] = Container{ID: short(ac.ID), Name: containerName(ac.Names), Image: ac.Image, State: ac.State, Status: ac.Status}
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			var st apiStats
			if err := cl.get(ctx, "/containers/"+id+"/stats?stream=false&one-shot=true", &st); err != nil {
				return // stats are best-effort; the container is still listed
			}
			key := name + "/" + id
			cur := sample{total: st.CPUStats.CPUUsage.Total, system: st.CPUStats.System, at: now}
			for _, n := range st.Networks {
				cur.rx += n.Rx
				cur.tx += n.Tx
			}
			mu.Lock()
			samples[key] = cur
			mu.Unlock()
			ct := &r.Containers[i]
			ct.MemUsed, ct.MemLimit = memUsed(st), st.MemoryStats.Limit
			if p, ok := prev[key]; ok {
				ct.CPU, ct.RxBps, ct.TxBps = rates(p, cur, st.CPUStats.Online)
			}
		}(i, ac.ID)
	}
	wg.Wait()
	return r, samples
}

// rates derives CPU percent (of one core) and network bytes/s from two samples.
func rates(p, c sample, online uint32) (cpu, rx, tx float64) {
	if dSys := c.system - p.system; c.system > p.system && c.total >= p.total {
		cores := float64(online)
		if cores == 0 {
			cores = 1
		}
		cpu = float64(c.total-p.total) / float64(dSys) * cores * 100
	}
	if secs := c.at.Sub(p.at).Seconds(); secs > 0 {
		if c.rx >= p.rx {
			rx = float64(c.rx-p.rx) / secs
		}
		if c.tx >= p.tx {
			tx = float64(c.tx-p.tx) / secs
		}
	}
	return cpu, rx, tx
}

// memUsed matches `docker stats`: usage minus reclaimable page cache.
func memUsed(st apiStats) uint64 {
	u := st.MemoryStats.Usage
	cache := st.MemoryStats.Stats["inactive_file"]
	if cache == 0 {
		cache = st.MemoryStats.Stats["cache"]
	}
	if cache > u {
		return u
	}
	return u - cache
}

func short(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func containerName(names []string) string {
	if len(names) == 0 {
		return ""
	}
	return strings.TrimPrefix(names[0], "/")
}

// isDown reports whether err means "nothing is listening" rather than a malfunction.
func isDown(err error) bool {
	return errors.Is(err, syscall.ECONNREFUSED) || errors.Is(err, syscall.ENOENT) || errors.Is(err, os.ErrNotExist)
}

type client struct{ http *http.Client }

func newClient(sock string) *client {
	return &client{http: &http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", sock)
		},
		DisableKeepAlives: true,
	}}}
}

// get issues a read-only request. Never add other methods here: the agent must not change state.
func (c *client) get(ctx context.Context, path string, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://runtime"+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: HTTP %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(into)
}
