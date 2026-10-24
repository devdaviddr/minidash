// Package hostinfo names the machine the agent runs on (spec 0.8.0 FR-40). It is read
// once at startup.
package hostinfo

import (
	"bufio"
	"io"
	"os"
	"runtime"
	"strings"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

// maxID and maxName are the contract's limits for host id and display name.
const (
	maxID   = 32
	maxName = 64
	maxText = 128
)

// fallbackID is used when the hostname has no usable characters at all.
const fallbackID = "host"

// Detect returns this host's identity. id and name override the defaults: a slug of the
// hostname for the id and the short hostname for the name. id must already be valid
// (config.ValidHostID); Detect does not check it again.
func Detect(id, name string) snapshot.Host {
	hn, _ := os.Hostname()
	short, _, _ := strings.Cut(hn, ".")
	if id == "" {
		id = Slug(short)
	}
	if name == "" {
		name = short
	}
	if name == "" {
		name = id
	}
	return snapshot.Host{
		ID:     id,
		Name:   truncate(name, maxName),
		OS:     runtime.GOOS,
		Arch:   runtime.GOARCH,
		Model:  truncate(model(), maxText),
		Kernel: truncate(kernel(), maxText),
	}
}

// Slug turns a hostname into a host id: lower case, every run of other characters becomes
// one "-", trimmed, at most 32 characters. "Alices-Mac-mini" becomes "alices-mac-mini".
func Slug(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	out := strings.TrimRight(b.String(), "-")
	if len(out) > maxID {
		out = strings.TrimRight(out[:maxID], "-")
	}
	if out == "" {
		return fallbackID
	}
	return out
}

// cpuModel returns the first "model name" in /proc/cpuinfo-style text, or "".
func cpuModel(r io.Reader) string {
	sc := bufio.NewScanner(io.LimitReader(r, 64<<10))
	for sc.Scan() {
		k, v, ok := strings.Cut(sc.Text(), ":")
		if ok && strings.TrimSpace(k) == "model name" {
			return strings.Join(strings.Fields(v), " ")
		}
	}
	return ""
}

// placeholders are firmware strings that name no real product.
var placeholders = []string{"to be filled by o.e.m.", "system product name", "default string", "not applicable", "none"}

// cleanProduct trims a DMI or device-tree product name and drops firmware placeholders.
func cleanProduct(s string) string {
	s = strings.TrimSpace(strings.TrimRight(s, "\x00\n"))
	for _, p := range placeholders {
		if strings.EqualFold(s, p) {
			return ""
		}
	}
	return s
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
