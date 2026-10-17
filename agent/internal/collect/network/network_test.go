package network

import (
	"context"
	"encoding/binary"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

type fakeOS struct {
	ifs []Iface
	cs  map[string]Counter
}

func (f *fakeOS) Interfaces(context.Context) ([]Iface, error)          { return f.ifs, nil }
func (f *fakeOS) Counters(context.Context) (map[string]Counter, error) { return f.cs, nil }

func newFake() *fakeOS {
	return &fakeOS{
		ifs: []Iface{
			{Name: "lo0", Up: true, Loopback: true, IPv4: []string{"127.0.0.1"}},
			{Name: "en0", Up: true, IPv4: []string{"192.0.2.10"}},
			{Name: "en1", Up: false, IPv4: []string{"192.0.2.11"}},
			{Name: "awdl0", Up: true}, // IPv6 only
		},
		cs: map[string]Counter{"en0": {}, "lo0": {}},
	}
}

// AC-4: only active interfaces are listed, each with its own throughput.
func TestOnlyActiveInterfacesWithRates(t *testing.T) {
	f := newFake()
	c := NewWith(f)
	now := time.Unix(100, 0)
	c.now = func() time.Time { return now }
	first, _ := c.Collect(context.Background())
	if len(first.(Data).Interfaces) != 1 || first.(Data).Interfaces[0].RxBps != 0 {
		t.Fatalf("first tick: %+v", first)
	}
	now = now.Add(2 * time.Second)
	f.cs = map[string]Counter{"en0": {Rx: 4000, Tx: 1000}}
	v, _ := c.Collect(context.Background())
	d := v.(Data)
	if d.Interfaces[0].Name != "en0" || d.Interfaces[0].RxBps != 2000 || d.Interfaces[0].TxBps != 500 {
		t.Fatalf("rates wrong: %+v", d.Interfaces)
	}
	if d.Total.RxBps != 2000 {
		t.Fatalf("total = %+v", d.Total)
	}
}

func TestCounterResetReadsZero(t *testing.T) {
	f := newFake()
	c := NewWith(f)
	now := time.Unix(100, 0)
	c.now = func() time.Time { return now }
	f.cs = map[string]Counter{"en0": {Rx: 9000, Tx: 9000}}
	_, _ = c.Collect(context.Background())
	now = now.Add(time.Second)
	f.cs = map[string]Counter{"en0": {Rx: 5, Tx: 5}}
	v, _ := c.Collect(context.Background())
	if v.(Data).Interfaces[0].RxBps != 0 {
		t.Fatalf("got %+v", v)
	}
}

func TestMatchesContract(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, NewWith(newFake())); !r.OK {
		t.Fatal(r.Error)
	}
}

func TestRealHostSane(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, New()); !r.OK {
		t.Fatal(r.Error)
	}
}

func ifmib(rx, tx uint64) []byte {
	b := make([]byte, minIfmibLen)
	binary.NativeEndian.PutUint64(b[offIBytes:], rx)
	binary.NativeEndian.PutUint64(b[offOBytes:], tx)
	return b
}

func TestParseIfMibKeeps64Bits(t *testing.T) {
	const big = 55_397_471_690 // > 2^32: the old IFLIST2 path wrapped values like this
	c, ok := parseIfMib(ifmib(big, big+7))
	if !ok || c.Rx != big || c.Tx != big+7 {
		t.Fatalf("got %+v ok=%v", c, ok)
	}
	if _, ok := parseIfMib(make([]byte, 10)); ok {
		t.Fatal("a short blob must be rejected")
	}
}

// Cross-check the kernel table against `netstat -ib` on a real Mac: same interface, nearly same bytes.
func TestKernelCountersAgreeWithNetstat(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS only")
	}
	got, err := newRealOS().Counters(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("netstat", "-ib").Output()
	if err != nil {
		t.Skip("netstat unavailable")
	}
	checked := 0
	for _, line := range strings.Split(string(out), "\n")[1:] {
		f := strings.Fields(line)
		if len(f) < 10 || !strings.HasPrefix(f[2], "<Link#") {
			continue
		}
		ib, err1 := strconv.ParseUint(f[6], 10, 64)
		if err1 != nil || ib < 1<<20 {
			continue // only compare busy interfaces; tiny counters are noisy
		}
		c, ok := got[f[0]]
		if !ok {
			t.Fatalf("interface %s missing from kernel table", f[0])
		}
		if c.Rx < ib || c.Rx-ib > 64<<20 { // netstat ran first, so the kernel value is >= it, within a modest window
			t.Fatalf("%s: kernel rx %d vs netstat %d (32-bit wrap?)", f[0], c.Rx, ib)
		}
		checked++
	}
	if checked == 0 {
		t.Skip("no busy interface to compare")
	}
}
