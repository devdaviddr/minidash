package hostinfo

import (
	"os"
	"runtime"
	"strings"
	"testing"

	"github.com/devdaviddr/minidash/agent/internal/config"
)

func TestSlug(t *testing.T) {
	for in, want := range map[string]string{
		"Alices-Mac-mini":         "alices-mac-mini",
		"llm_box 01":              "llm-box-01",
		"--Edge--":                "edge",
		"ÜBER host":               "ber-host",
		"":                        fallbackID,
		"!!!":                     fallbackID,
		strings.Repeat("ab-", 20): "ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-ab",
	} {
		got := Slug(in)
		if got != want {
			t.Errorf("Slug(%q) = %q, want %q", in, got, want)
		}
		if !config.ValidHostID(got) {
			t.Errorf("Slug(%q) = %q is not a valid host id", in, got)
		}
	}
}

// AC-40: overrides win; os and arch match the build target.
func TestDetectOverrides(t *testing.T) {
	h := Detect("llm", "LLM box")
	if h.ID != "llm" || h.Name != "LLM box" {
		t.Fatalf("overrides not used: %+v", h)
	}
	if h.OS != runtime.GOOS || h.Arch != runtime.GOARCH {
		t.Fatalf("os/arch %s/%s, want %s/%s", h.OS, h.Arch, runtime.GOOS, runtime.GOARCH)
	}
	if h.Kernel == "" {
		t.Error("kernel release should be readable without root")
	}
}

// AC-40: without overrides the id is the hostname's slug and the name the short hostname.
func TestDetectDefaults(t *testing.T) {
	hn, err := os.Hostname()
	if err != nil {
		t.Skip("no hostname")
	}
	short, _, _ := strings.Cut(hn, ".")
	h := Detect("", "")
	if h.ID != Slug(short) || !config.ValidHostID(h.ID) {
		t.Fatalf("id %q, want %q", h.ID, Slug(short))
	}
	if short != "" && h.Name != truncate(short, maxName) {
		t.Fatalf("name %q, want %q", h.Name, short)
	}
}

func TestCPUModel(t *testing.T) {
	const cpuinfo = "processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Example(R) CPU   X-1000 @ 3.00GHz\nflags\t\t: fpu\n\nprocessor\t: 1\nmodel name\t: other\n"
	if got := cpuModel(strings.NewReader(cpuinfo)); got != "Example(R) CPU X-1000 @ 3.00GHz" {
		t.Fatalf("got %q", got)
	}
	if got := cpuModel(strings.NewReader("processor\t: 0\nBogoMIPS\t: 108.00\n")); got != "" {
		t.Fatalf("arm cpuinfo without a model name should give \"\", got %q", got)
	}
}

func TestCleanProduct(t *testing.T) {
	for in, want := range map[string]string{
		"Example Board 9\n":          "Example Board 9",
		"Raspberry Pi 5 Model B\x00": "Raspberry Pi 5 Model B",
		"To Be Filled By O.E.M.\n":   "",
		"System Product Name":        "",
	} {
		if got := cleanProduct(in); got != want {
			t.Errorf("cleanProduct(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTruncateCountsRunes(t *testing.T) {
	if got := truncate(strings.Repeat("é", 70), maxName); len([]rune(got)) != maxName {
		t.Fatalf("got %d runes", len([]rune(got)))
	}
}
