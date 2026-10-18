package gputime

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// AC-29: several clients and several AppUsage entries for one pid are summed; clients with
// no usage read 0; unknown keys are ignored; malformed creators are skipped and counted.
func TestParseSumsPerPID(t *testing.T) {
	s, err := Parse(fixture(t, "synthetic-sums.plist"))
	if err != nil {
		t.Fatal(err)
	}
	want := map[int32]uint64{10: 600, 20: 0, 30: 50, 40: 0}
	if fmt.Sprint(s.Busy) != fmt.Sprint(want) {
		t.Fatalf("busy = %v, want %v", s.Busy, want)
	}
	if s.Skipped != 4 {
		t.Fatalf("skipped = %d, want 4", s.Skipped)
	}
}

// AC-29: the recorded (sanitised) Mac mini output decodes, with the system services present.
func TestParseRecorded(t *testing.T) {
	a, err := Parse(fixture(t, "recorded-1.plist"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := Parse(fixture(t, "recorded-2.plist"))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Busy) != 26 || a.Skipped != 0 {
		t.Fatalf("pids = %d skipped = %d, want 26 and 0", len(a.Busy), a.Skipped)
	}
	// pid 100 is runningboardd: two clients, both with an empty AppUsage list.
	if v, ok := a.Busy[100]; !ok || v != 0 {
		t.Fatalf("runningboardd = %d, %v; want 0, true", v, ok)
	}
	// pid 110 is WindowServer: it drew the desktop between the two samples, 3 s apart.
	if a.Busy[110] != 25891067625833 || b.Busy[110] != 25891187763125 {
		t.Fatalf("WindowServer = %d then %d", a.Busy[110], b.Busy[110])
	}
}

func TestParseEmptyOutputMeansNoClients(t *testing.T) {
	for _, raw := range [][]byte{nil, []byte("\n")} {
		s, err := Parse(raw)
		if err != nil || len(s.Busy) != 0 {
			t.Fatalf("Parse(%q) = %v, %v", raw, s.Busy, err)
		}
	}
}

// AC-31: malformed output and a format change are errors, never silent zeros.
func TestParseErrors(t *testing.T) {
	cases := map[string]struct {
		raw  []byte
		want error
	}{
		"text output":    {fixture(t, "not-plist.txt"), nil},
		"truncated":      {fixture(t, "recorded-1.plist")[:500], nil},
		"wrong shape":    {[]byte(`<plist version="1.0"><dict><key>a</key><string>b</string></dict></plist>`), nil},
		"format changed": {fixture(t, "synthetic-nomatch.plist"), ErrNoMatch},
		"too many":       {clients(MaxClients+1, 1), ErrTooManyClients},
		"overflow":       {overflow(), ErrOverflow},
	}
	for name, tc := range cases {
		t.Run(strings.ReplaceAll(name, " ", "_"), func(t *testing.T) {
			_, err := Parse(tc.raw)
			if err == nil {
				t.Fatal("want an error")
			}
			if tc.want != nil && !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestParseAcceptsMaxClients(t *testing.T) {
	s, err := Parse(clients(MaxClients, 2))
	if err != nil || s.Busy[1] != 2*MaxClients {
		t.Fatalf("busy = %d, err = %v", s.Busy[1], err)
	}
}

func clients(n int, gpu uint64) []byte {
	var b bytes.Buffer
	b.WriteString(`<plist version="1.0"><array>`)
	for range n {
		fmt.Fprintf(&b, `<dict><key>IOUserClientCreator</key><string>pid 1, ExampleApp1</string><key>AppUsage</key><array><dict><key>accumulatedGPUTime</key><integer>%d</integer></dict></array></dict>`, gpu)
	}
	b.WriteString(`</array></plist>`)
	return b.Bytes()
}

func overflow() []byte {
	return []byte(`<plist version="1.0"><array><dict><key>IOUserClientCreator</key><string>pid 1, ExampleApp1</string><key>AppUsage</key><array>` +
		`<dict><key>accumulatedGPUTime</key><integer>18446744073709551615</integer></dict>` +
		`<dict><key>accumulatedGPUTime</key><integer>1</integer></dict></array></dict></array></plist>`)
}

func TestParseCreator(t *testing.T) {
	cases := map[string]int32{
		"pid 1, a":                1,
		"pid 99999, a":            99999,
		"pid 42, Example App":     42,
		"pid 42, ":                42,
		"pid 0, kernel_task":      0,
		"pid 100000, a":           0,
		"pid 1234567, a":          0,
		"pid -1, a":               0,
		"pid 42 ExampleApp1":      0,
		"pid 42,ExampleApp1":      0,
		" pid 42, ExampleApp1":    0,
		"PID 42, ExampleApp1":     0,
		"pid ٤٢, ExampleApp1":     0,
		"":                        0,
		"process 42, ExampleApp1": 0,
	}
	for in, want := range cases {
		got, ok := ParseCreator(in)
		if ok != (want != 0) || got != want {
			t.Errorf("ParseCreator(%q) = %d, %v; want %d", in, got, ok, want)
		}
	}
}

func script(bin string, args ...string) *IOReg {
	return &IOReg{bin: bin, args: args, now: time.Now}
}

// AC-31: a hung ioreg is killed at the timeout.
func TestReadTimeout(t *testing.T) {
	start := time.Now()
	_, err := script("sleep", "5").Read(context.Background())
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout", err)
	}
	if d := time.Since(start); d > Timeout+500*time.Millisecond {
		t.Fatalf("read took %v, want about %v", d, Timeout)
	}
}

// AC-31: output over the cap is an error, and the child is stopped rather than drained.
func TestReadOversized(t *testing.T) {
	start := time.Now()
	_, err := script("yes").Read(context.Background())
	if !errors.Is(err, ErrOversized) {
		t.Fatalf("err = %v, want ErrOversized", err)
	}
	if d := time.Since(start); d > Timeout {
		t.Fatalf("read took %v", d)
	}
}

// AC-31: a failing or missing ioreg is an error.
func TestReadCommandFails(t *testing.T) {
	for _, r := range []*IOReg{script("false"), script("/nonexistent/ioreg")} {
		if _, err := r.Read(context.Background()); err == nil || !strings.HasPrefix(err.Error(), "ioreg") {
			t.Fatalf("%s: err = %v", r.bin, err)
		}
	}
}

func TestReadDecodesAndStampsTime(t *testing.T) {
	at := time.Unix(1000, 0)
	r := &IOReg{bin: "cat", args: []string{filepath.Join("testdata", "synthetic-sums.plist")}, now: func() time.Time { return at }}
	s, err := r.Read(context.Background())
	if err != nil || !s.At.Equal(at) || s.Busy[10] != 600 {
		t.Fatalf("sample = %+v, err = %v", s, err)
	}
}

func TestReadNamesOSVersionOnFormatChange(t *testing.T) {
	r := script("cat", filepath.Join("testdata", "synthetic-nomatch.plist"))
	_, err := r.Read(context.Background())
	if !errors.Is(err, ErrNoMatch) || !strings.Contains(err.Error(), "(macOS ") {
		t.Fatalf("err = %v", err)
	}
}

// The real ioreg on this Mac: no root needed and the output decodes.
func TestReadLive(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("needs macOS ioreg")
	}
	if _, err := New().Read(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func FuzzParse(f *testing.F) {
	for _, name := range []string{"recorded-1.plist", "synthetic-sums.plist", "synthetic-nomatch.plist", "not-plist.txt"} {
		raw, err := os.ReadFile(filepath.Join("testdata", name))
		if err != nil {
			f.Fatal(err)
		}
		f.Add(raw)
	}
	f.Fuzz(func(t *testing.T, raw []byte) {
		s, err := Parse(raw)
		if err != nil {
			return
		}
		for pid := range s.Busy {
			if pid < 1 || pid > maxPID {
				t.Fatalf("pid %d out of range", pid)
			}
		}
	})
}

func FuzzParseCreator(f *testing.F) {
	for _, s := range []string{"pid 1, a", "pid 99999, WindowServer", "pid 0, x", "x"} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, s string) {
		if pid, ok := ParseCreator(s); ok && (pid < 1 || pid > maxPID) {
			t.Fatalf("ParseCreator(%q) = %d", s, pid)
		}
	})
}
