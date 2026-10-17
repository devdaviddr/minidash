package memory

import (
	"context"
	"testing"

	"github.com/shirou/gopsutil/v4/mem"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

const vmstat = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    12151.
Pages occupied by compressor:                  50000.
`

type fakeOS struct{ stat string }

func (fakeOS) VM(context.Context) (*mem.VirtualMemoryStat, error) {
	return &mem.VirtualMemoryStat{Total: 16 << 30, Available: 6 << 30, Wired: 2 << 30, Active: 5 << 30, Inactive: 3 << 30}, nil
}
func (fakeOS) Swap(context.Context) (*mem.SwapMemoryStat, error) {
	return &mem.SwapMemoryStat{Total: 2 << 30, Used: 1 << 30}, nil
}
func (f fakeOS) VMStat(context.Context) ([]byte, error) { return []byte(f.stat), nil }

func TestParseCompressed(t *testing.T) {
	if got := ParseCompressed([]byte(vmstat)); got != 16384*50000 {
		t.Fatalf("got %d", got)
	}
	if ParseCompressed([]byte("garbage")) != 0 {
		t.Fatal("garbage must yield 0")
	}
}

func TestUsedIsActivePlusWiredPlusCompressed(t *testing.T) {
	v, err := NewWith(fakeOS{stat: vmstat}).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	d := v.(Data)
	want := uint64(5<<30) + uint64(2<<30) + 16384*50000
	if d.Used != want || d.SwapUsed != 1<<30 {
		t.Fatalf("used = %d want %d; %+v", d.Used, want, d)
	}
}

func TestMatchesContract(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, NewWith(fakeOS{stat: vmstat})); !r.OK {
		t.Fatal(r.Error)
	}
}

func TestRealHostSane(t *testing.T) {
	r := testutil.AssertMatchesContract(t, New())
	d := r.Data.(Data)
	if !r.OK || d.Total == 0 || d.Used > d.Total {
		t.Fatalf("implausible: %+v", r)
	}
}
