package cpu

import (
	"context"
	"errors"
	"testing"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

type fake struct {
	cores []float64
	err   error
}

func (f fake) Percent(context.Context) ([]float64, error) { return f.cores, f.err }
func (fake) Load(context.Context) (Load, error)           { return Load{One: 1, Five: 2, Fifteen: 3}, nil }

func TestTotalIsMeanOfCores(t *testing.T) {
	d, err := NewWith(fake{cores: []float64{0, 50, 100, 50}}).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got := d.(Data).Total; got != 50 {
		t.Fatalf("total = %v, want 50", got)
	}
}

func TestErrorPropagates(t *testing.T) {
	if _, err := NewWith(fake{err: errors.New("x")}).Collect(context.Background()); err == nil {
		t.Fatal("want error")
	}
}

func TestMatchesContract(t *testing.T) {
	r := testutil.AssertMatchesContract(t, NewWith(fake{cores: []float64{10, 20}}))
	if !r.OK {
		t.Fatalf("collector failed: %s", r.Error)
	}
}

// Real OS smoke test: values are sane on whatever host runs the tests (no load assumptions).
func TestRealHostSane(t *testing.T) {
	r := testutil.AssertMatchesContract(t, New())
	d := r.Data.(Data)
	if !r.OK || len(d.Cores) == 0 || d.Total < 0 || d.Total > 100 {
		t.Fatalf("implausible: %+v", r)
	}
}
