package processes

import (
	"strings"
	"testing"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

func snapshotWith(processes string) []byte {
	return []byte(`{"schema":1,"seq":1,"ts":"2026-10-18T00:00:00Z","intervalMs":1000,"collectors":{"processes":{"ok":true,"data":` + processes + `}}}`)
}

const proc = `"pid":1,"name":"a","user":"u","cpu":1,"rss":1,"threads":1`

// AC-34: the 0.6.0 schema accepts 0.5.x payloads and the new GPU fields, and bounds gpu to 0-100.
func TestSchemaGPUFields(t *testing.T) {
	cases := []struct {
		name string
		data string
		ok   bool
	}{
		{"0.5.x payload without gpu", `{"total":1,"list":[{` + proc + `}]}`, true},
		{"numbers, nulls and gpuError", `{"total":3,"list":[{` + proc + `,"gpu":0},{` + proc + `,"gpu":100},{` + proc + `,"gpu":null}],"gpuError":"ioreg timed out"}`, true},
		{"fractional gpu", `{"total":1,"list":[{` + proc + `,"gpu":42.5}]}`, true},
		{"gpu below 0", `{"total":1,"list":[{` + proc + `,"gpu":-1}]}`, false},
		{"gpu above 100", `{"total":1,"list":[{` + proc + `,"gpu":101}]}`, false},
		{"gpu as string", `{"total":1,"list":[{` + proc + `,"gpu":"5"}]}`, false},
		{"gpuError not a string", `{"total":1,"list":[],"gpuError":1}`, false},
	}
	for _, tc := range cases {
		t.Run(strings.ReplaceAll(tc.name, " ", "_"), func(t *testing.T) {
			err := testutil.ValidateSnapshot(t, snapshotWith(tc.data))
			if (err == nil) != tc.ok {
				t.Fatalf("valid=%v, want %v (err %v)", err == nil, tc.ok, err)
			}
		})
	}
}
