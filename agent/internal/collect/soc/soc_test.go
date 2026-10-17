package soc

import (
	"context"
	"os"
	"testing"

	"github.com/devdaviddr/minidash/agent/internal/macmon"
	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

type src struct {
	s   macmon.Sample
	err error
}

func (f src) Latest() (macmon.Sample, error) { return f.s, f.err }

func fixture(t *testing.T) macmon.Sample {
	t.Helper()
	b, err := os.ReadFile("../../macmon/testdata/sample.json")
	if err != nil {
		t.Fatal(err)
	}
	s, err := macmon.Parse(b)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// AC-2 (collector half): GPU figures follow the source, as percent.
func TestGPUUsageIsPercent(t *testing.T) {
	v, err := New(src{s: macmon.Sample{GPUActive: 0.42, GPUFreqMHz: 900}}).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if g := v.(Data).GPU; g.Usage != 42 || g.FreqMHz != 900 {
		t.Fatalf("gpu = %+v", g)
	}
}

func TestMatchesContractWithRealSample(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, New(src{s: fixture(t)})); !r.OK {
		t.Fatal(r.Error)
	}
}

func TestMissingMacmonDegradesCleanly(t *testing.T) {
	r := testutil.AssertMatchesContract(t, New(src{err: macmon.ErrUnavailable}))
	if r.OK || r.Error == "" {
		t.Fatalf("want ok=false with error, got %+v", r)
	}
}
