package network

import (
	"context"
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
