// Package testutil holds helpers shared by collector tests.
package testutil

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

// AssertMatchesContract runs the collector once through the aggregator and validates the
// resulting snapshot against contracts/snapshot.schema.json, so Go output can never drift
// from the types the web app is generated from.
func AssertMatchesContract(t *testing.T, c snapshot.Collector) snapshot.Result {
	t.Helper()
	sch, err := jsonschema.NewCompiler().Compile(filepath.Join("..", "..", "..", "..", "contracts", "snapshot.schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	snap := snapshot.NewAggregator(time.Second, c).Sample(context.Background())
	raw, err := json.Marshal(snap)
	if err != nil {
		t.Fatal(err)
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}
	if err := sch.Validate(v); err != nil {
		t.Fatalf("%s violates contract: %v\n%s", c.Name(), err, raw)
	}
	return snap.Collectors[c.Name()]
}
