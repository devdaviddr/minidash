package containers

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"context"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

// fakeDaemon serves a minimal Docker Engine API on a unix socket.
type fakeDaemon struct {
	sock    string
	mu      sync.Mutex
	methods []string
	cpu     uint64 // cumulative container cpu ns
	sys     uint64
	rx, tx  uint64
	fail    bool
}

func shortDir(t *testing.T) string {
	t.Helper()
	d, err := os.MkdirTemp("/tmp", "md")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(d) })
	return d // unix socket paths are limited to ~104 bytes, so avoid t.TempDir()
}

func startDaemon(t *testing.T, dir, file string) *fakeDaemon {
	t.Helper()
	f := &fakeDaemon{sock: filepath.Join(dir, file)}
	ln, err := net.Listen("unix", f.sock)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/containers/json", func(w http.ResponseWriter, r *http.Request) {
		f.record(r)
		if f.fail {
			http.Error(w, "boom", http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(`[{"Id":"abcdef1234567890","Names":["/web"],"Image":"nginx:1","State":"running","Status":"Up 2 hours"}]`))
	})
	mux.HandleFunc("/containers/abcdef1234567890/stats", func(w http.ResponseWriter, r *http.Request) {
		f.record(r)
		f.mu.Lock()
		defer f.mu.Unlock()
		_, _ = fmt.Fprintf(w, `{"cpu_stats":{"cpu_usage":{"total_usage":%d},"system_cpu_usage":%d,"online_cpus":4},
			"memory_stats":{"usage":1000,"limit":4000,"stats":{"inactive_file":200}},
			"networks":{"eth0":{"rx_bytes":%d,"tx_bytes":%d}}}`, f.cpu, f.sys, f.rx, f.tx)
	})
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: time.Second}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })
	return f
}

func (f *fakeDaemon) record(r *http.Request) {
	f.mu.Lock()
	f.methods = append(f.methods, r.Method)
	f.mu.Unlock()
}

func collect(t *testing.T, c *Collector) Data {
	t.Helper()
	v, err := c.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return v.(Data)
}

func byName(d Data, n string) Runtime {
	for _, r := range d.Runtimes {
		if r.Name == n {
			return r
		}
	}
	return Runtime{}
}

// AC-6: with only Colima running, Docker and Podman are "not-running", not errors.
func TestOnlyColimaRunning(t *testing.T) {
	dir := shortDir(t)
	startDaemon(t, dir, "colima.sock")
	c := NewWith(func() []Endpoint {
		return []Endpoint{
			{Name: "colima", Sockets: []string{filepath.Join(dir, "colima.sock")}},
			{Name: "podman", Sockets: []string{filepath.Join(dir, "podman.sock")}},
			{Name: "docker", Sockets: []string{filepath.Join(dir, "docker.sock")}},
		}
	})
	d := collect(t, c)
	if r := byName(d, "colima"); r.Status != StatusRunning || len(r.Containers) != 1 || r.Containers[0].Name != "web" || r.Containers[0].ID != "abcdef123456" {
		t.Fatalf("colima: %+v", r)
	}
	for _, n := range []string{"docker", "podman"} {
		if r := byName(d, n); r.Status != StatusNotRunning || r.Error != "" || len(r.Containers) != 0 {
			t.Fatalf("%s should be quietly not-running: %+v", n, r)
		}
	}
}

// A socket file left behind by a stopped runtime (connection refused) is "not-running".
func TestStaleSocketIsNotRunning(t *testing.T) {
	dir := shortDir(t)
	sock := filepath.Join(dir, "docker.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	ln.(*net.UnixListener).SetUnlinkOnClose(false)
	_ = ln.Close()
	d := collect(t, NewWith(func() []Endpoint { return []Endpoint{{Name: "docker", Sockets: []string{sock}}} }))
	if r := byName(d, "docker"); r.Status != StatusNotRunning || r.Error != "" {
		t.Fatalf("got %+v", r)
	}
}

func TestUnexpectedAPIFailureIsError(t *testing.T) {
	dir := shortDir(t)
	f := startDaemon(t, dir, "docker.sock")
	f.fail = true
	d := collect(t, NewWith(func() []Endpoint { return []Endpoint{{Name: "docker", Sockets: []string{f.sock}}} }))
	if r := byName(d, "docker"); r.Status != StatusError || r.Error == "" {
		t.Fatalf("got %+v", r)
	}
}

func TestRatesFromTwoTicks(t *testing.T) {
	dir := shortDir(t)
	f := startDaemon(t, dir, "docker.sock")
	c := NewWith(func() []Endpoint { return []Endpoint{{Name: "docker", Sockets: []string{f.sock}}} })
	now := time.Unix(100, 0)
	c.now = func() time.Time { return now }
	f.cpu, f.sys, f.rx, f.tx = 1_000, 10_000, 0, 0
	first := byName(collect(t, c), "docker").Containers[0]
	if first.CPU != 0 || first.RxBps != 0 {
		t.Fatalf("first tick must be 0: %+v", first)
	}
	now = now.Add(2 * time.Second)
	// container used 1/10 of system time on a 4-cpu VM = 40% of one core; 4000 bytes in 2 s = 2000 B/s
	f.cpu, f.sys, f.rx, f.tx = 2_000, 20_000, 4_000, 2_000
	got := byName(collect(t, c), "docker").Containers[0]
	if got.CPU != 40 || got.RxBps != 2000 || got.TxBps != 1000 {
		t.Fatalf("rates: %+v", got)
	}
	if got.MemUsed != 800 || got.MemLimit != 4000 { // usage 1000 - inactive_file 200
		t.Fatalf("memory: %+v", got)
	}
}

// Docker's usual /var/run/docker.sock is often a symlink into Colima: count it once.
func TestSymlinkedSocketNotCountedTwice(t *testing.T) {
	dir := shortDir(t)
	f := startDaemon(t, dir, "colima.sock")
	link := filepath.Join(dir, "docker.sock")
	if err := os.Symlink(f.sock, link); err != nil {
		t.Fatal(err)
	}
	d := collect(t, NewWith(func() []Endpoint {
		return []Endpoint{{Name: "colima", Sockets: []string{f.sock}}, {Name: "docker", Sockets: []string{link}}}
	}))
	if byName(d, "colima").Status != StatusRunning || byName(d, "docker").Status != StatusNotRunning {
		t.Fatalf("got %+v", d)
	}
}

// The agent is read-only: every request to a runtime must be a GET.
func TestOnlyGETRequests(t *testing.T) {
	dir := shortDir(t)
	f := startDaemon(t, dir, "docker.sock")
	collect(t, NewWith(func() []Endpoint { return []Endpoint{{Name: "docker", Sockets: []string{f.sock}}} }))
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.methods) == 0 {
		t.Fatal("no requests seen")
	}
	for _, m := range f.methods {
		if m != http.MethodGet {
			t.Fatalf("non-GET request: %s", m)
		}
	}
}

func TestMatchesContract(t *testing.T) {
	dir := shortDir(t)
	f := startDaemon(t, dir, "docker.sock")
	r := testutil.AssertMatchesContract(t, NewWith(func() []Endpoint {
		return []Endpoint{{Name: "docker", Sockets: []string{f.sock}}, {Name: "podman", Sockets: nil}}
	}))
	if !r.OK {
		t.Fatal(r.Error)
	}
}

func TestDefaultEndpointsOrderAvoidsDoubleCounting(t *testing.T) {
	eps := DefaultEndpoints("/home/u", "/tmp")
	if eps[0].Name != "colima" || eps[len(eps)-1].Name != "docker" {
		t.Fatalf("docker must come last: %+v", eps)
	}
}
