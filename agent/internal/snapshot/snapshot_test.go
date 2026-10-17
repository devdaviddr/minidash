package snapshot

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

type fake struct {
	name string
	data any
	err  error
	boom bool
}

func (f fake) Name() string { return f.name }
func (f fake) Collect(context.Context) (any, error) {
	if f.boom {
		panic("x")
	}
	return f.data, f.err
}

// DD-1: one failing or panicking collector never blanks the others.
func TestCollectorsFailIndependently(t *testing.T) {
	a := NewAggregator(time.Second,
		fake{name: "good", data: map[string]int{"n": 1}},
		fake{name: "bad", err: errors.New("nope")},
		fake{name: "boom", boom: true})
	s := a.Sample(context.Background())
	if !s.Collectors["good"].OK || s.Collectors["bad"].OK || s.Collectors["boom"].OK {
		t.Fatalf("unexpected results: %+v", s.Collectors)
	}
	if s.Collectors["bad"].Error != "nope" {
		t.Fatalf("error not reported: %+v", s.Collectors["bad"])
	}
}

func TestSeqIncrements(t *testing.T) {
	a := NewAggregator(time.Second)
	if a.Sample(context.Background()).Seq != 1 || a.Sample(context.Background()).Seq != 2 {
		t.Fatal("seq should increase by one per sample")
	}
}

// The Go type must satisfy the shared wire contract.
func TestSnapshotMatchesSchema(t *testing.T) {
	path := filepath.Join("..", "..", "..", "contracts", "snapshot.schema.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	sch, err := jsonschema.NewCompiler().Compile(path)
	if err != nil {
		t.Fatal(err)
	}
	a := NewAggregator(time.Second, fake{name: "good", data: 1}, fake{name: "bad", err: errors.New("e")})
	raw, _ := json.Marshal(a.Sample(context.Background()))
	var v any
	if err := json.NewDecoder(strings.NewReader(string(raw))).Decode(&v); err != nil {
		t.Fatal(err)
	}
	if err := sch.Validate(v); err != nil {
		t.Fatalf("snapshot violates schema: %v\n%s", err, raw)
	}
}
