package snapshot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

var contracts = filepath.Join("..", "..", "..", "contracts")

func compile(t *testing.T, name string) *jsonschema.Schema {
	t.Helper()
	sch, err := jsonschema.NewCompiler().Compile(filepath.Join(contracts, name))
	if err != nil {
		t.Fatal(err)
	}
	return sch
}

func example(t *testing.T, name string) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(contracts, "examples", name))
	if err != nil {
		t.Fatal(err)
	}
	var v map[string]any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}
	return v
}

func collectorsOf(v map[string]any) map[string]any { return v["collectors"].(map[string]any) }

func dataOf(v map[string]any, collector string) map[string]any {
	return collectorsOf(v)[collector].(map[string]any)["data"].(map[string]any)
}

// AC-59: 0.7.0, 0.8.0 macOS and 0.8.0 Linux snapshots and the stream messages validate.
func TestExamplesValidate(t *testing.T) {
	snap, stream := compile(t, "snapshot.schema.json"), compile(t, "stream.schema.json")
	for name, sch := range map[string]*jsonschema.Schema{
		"snapshot-0.7.0.json":        snap,
		"snapshot-0.8.0-darwin.json": snap,
		"snapshot-0.8.0-linux.json":  snap,
		"stream-auth.json":           stream,
		"stream-auth-all.json":       stream,
		"stream-hosts.json":          stream,
	} {
		if err := sch.Validate(any(example(t, name))); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
}

// AC-59: a Linux snapshot that also sends the macOS memory fields still validates.
func TestLinuxMemoryWithWiredValidates(t *testing.T) {
	v := example(t, "snapshot-0.8.0-linux.json")
	dataOf(v, "memory")["wired"] = 1.0
	if err := compile(t, "snapshot.schema.json").Validate(any(v)); err != nil {
		t.Fatal(err)
	}
}

// The new shapes are bounded and typed: each mutation must be rejected.
func TestContractRejects(t *testing.T) {
	snap := compile(t, "snapshot.schema.json")
	cases := map[string]func(v map[string]any){
		"host id with capitals": func(v map[string]any) { v["host"].(map[string]any)["id"] = "Mini" },
		"host id too long":      func(v map[string]any) { v["host"].(map[string]any)["id"] = "a23456789012345678901234567890123" },
		"host os unknown":       func(v map[string]any) { v["host"].(map[string]any)["os"] = "windows" },
		"host without name":     func(v map[string]any) { delete(v["host"].(map[string]any), "name") },
		"more than 16 gpus": func(v map[string]any) {
			d := dataOf(v, "gpus")
			gpu := d["list"].([]any)[0]
			list := make([]any, 17)
			for i := range list {
				list[i] = gpu
			}
			d["list"] = list
		},
		"gpu util over 100": func(v map[string]any) { dataOf(v, "gpus")["list"].([]any)[0].(map[string]any)["util"] = 101.0 },
		"gpu missing field": func(v map[string]any) { delete(dataOf(v, "gpus")["list"].([]any)[0].(map[string]any), "fanPct") },
		"negative fan rpm":  func(v map[string]any) { dataOf(v, "thermal")["fans"].([]any)[0].(map[string]any)["rpm"] = -1.0 },
		"unsupported not boolean": func(v map[string]any) {
			collectorsOf(v)["soc"].(map[string]any)["unsupported"] = "yes"
		},
	}
	for name, mutate := range cases {
		v := example(t, "snapshot-0.8.0-linux.json")
		mutate(v)
		if snap.Validate(any(v)) == nil {
			t.Errorf("%s: accepted", name)
		}
	}

	stream := compile(t, "stream.schema.json")
	for name, raw := range map[string]string{
		"auth hosts other than all": `{"type":"auth","token":"t","hosts":"some"}`,
		"auth without token":        `{"type":"auth"}`,
		"unknown host state":        `{"type":"hosts","hosts":[{"id":"llm","name":"LLM","state":"asleep"}]}`,
		"unknown message type":      `{"type":"hello"}`,
	} {
		var v any
		if err := json.Unmarshal([]byte(raw), &v); err != nil {
			t.Fatal(err)
		}
		if stream.Validate(v) == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

// FR-43: a collector that does not apply reports unsupported with its reason, not a failure,
// also when the error is wrapped, and the entry is contract-valid.
func TestUnsupportedCollector(t *testing.T) {
	a := NewAggregator(time.Second,
		fake{name: "soc", err: Unsupported("Apple silicon only")},
		fake{name: "gpus", err: fmt.Errorf("probe: %w", Unsupported("no NVIDIA driver"))},
		fake{name: "cpu", err: errors.New("boom")})
	s := a.Sample(context.Background())
	for name, reason := range map[string]string{"soc": "Apple silicon only", "gpus": "no NVIDIA driver"} {
		r := s.Collectors[name]
		if r.OK || !r.Unsupported || r.Error != reason {
			t.Errorf("%s: got %+v", name, r)
		}
	}
	if s.Collectors["cpu"].Unsupported {
		t.Error("an ordinary failure must not read as unsupported")
	}
	assertValid(t, s)
}

// FR-40: a snapshot labelled with its host is contract-valid; without one, host is left out.
func TestHostOnTheWire(t *testing.T) {
	s := NewAggregator(time.Second).Sample(context.Background())
	raw, _ := json.Marshal(s)
	var v map[string]any
	_ = json.Unmarshal(raw, &v)
	if _, ok := v["host"]; ok {
		t.Fatal("host must be omitted when unset")
	}
	s = NewAggregator(time.Second).WithHost(Host{ID: "llm", Name: "LLM box", OS: "linux", Arch: "amd64"}).Sample(context.Background())
	if s.Host == nil || s.Host.ID != "llm" {
		t.Fatalf("host not carried: %+v", s.Host)
	}
	assertValid(t, s)
}

func assertValid(t *testing.T, s Snapshot) {
	t.Helper()
	raw, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}
	if err := compile(t, "snapshot.schema.json").Validate(v); err != nil {
		t.Fatalf("snapshot violates schema: %v\n%s", err, raw)
	}
}
