// Package gputime reads cumulative GPU time per process from the IORegistry, without root.
//
// Every GPU client (class AGXDeviceUserClient) names the process that opened it in
// IOUserClientCreator ("pid N, name") and carries AppUsage[].accumulatedGPUTime, a counter in
// nanoseconds. The real reader forks ioreg and decodes its plist output (ADR 0015); a crash or
// hang stays in the child, which the timeout kills.
package gputime

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os/exec"
	"regexp"
	"strconv"
	"time"

	"howett.net/plist"
)

// Bounds on one read (spec NFR: everything parsed from the IORegistry is bounded).
const (
	Timeout    = time.Second // a slower ioreg is killed (FR-31)
	MaxOutput  = 4 << 20     // bytes; more is an error, never a truncated parse
	MaxClients = 4096        // GPU clients per read
	maxPID     = 99999
)

// Sample is one reading: the summed accumulatedGPUTime in nanoseconds for every pid that has
// at least one GPU client, taken at At. Skipped counts clients whose creator did not parse.
type Sample struct {
	At      time.Time
	Busy    map[int32]uint64
	Skipped int
}

// Reader takes one GPU time sample.
type Reader interface {
	Read(ctx context.Context) (Sample, error)
}

// ReaderFunc adapts a function to Reader (fakes in tests).
type ReaderFunc func(ctx context.Context) (Sample, error)

// Read implements Reader.
func (f ReaderFunc) Read(ctx context.Context) (Sample, error) { return f(ctx) }

// Errors a read can return. Their text is shown to the user as gpuError.
var (
	ErrTimeout        = errors.New("ioreg timed out")
	ErrOversized      = fmt.Errorf("ioreg output is over %d MiB", MaxOutput>>20)
	ErrTooManyClients = fmt.Errorf("ioreg listed more than %d GPU clients", MaxClients)
	ErrOverflow       = errors.New("GPU time sum overflows")
	ErrNoMatch        = errors.New("no GPU client names its process in the expected format")
)

// IOReg is the real Reader: it forks ioreg on every Read.
type IOReg struct {
	bin  string
	args []string
	now  func() time.Time
}

// New returns a Reader that runs /usr/sbin/ioreg.
func New() *IOReg {
	return &IOReg{bin: "/usr/sbin/ioreg", args: []string{"-r", "-c", "AGXDeviceUserClient", "-l", "-a"}, now: time.Now}
}

// Read implements Reader.
func (r *IOReg) Read(ctx context.Context) (Sample, error) {
	raw, err := r.run(ctx)
	if err != nil {
		return Sample{}, err
	}
	at := r.now()
	s, err := Parse(raw)
	if errors.Is(err, ErrNoMatch) {
		return Sample{}, fmt.Errorf("%w (macOS %s)", err, osVersion())
	}
	s.At = at
	return s, err
}

// run executes ioreg under the timeout and returns at most MaxOutput bytes of stdout.
func (r *IOReg) run(ctx context.Context) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, Timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, r.bin, r.args...)
	out, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("ioreg: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("ioreg: %w", err)
	}
	raw, readErr := io.ReadAll(io.LimitReader(out, MaxOutput+1))
	if len(raw) > MaxOutput {
		cancel() // stop the child instead of draining the rest
		_ = cmd.Wait()
		return nil, ErrOversized
	}
	waitErr := cmd.Wait()
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return nil, ErrTimeout
	}
	if readErr != nil {
		return nil, fmt.Errorf("ioreg: %w", readErr)
	}
	if waitErr != nil {
		return nil, fmt.Errorf("ioreg: %w", waitErr)
	}
	return raw, nil
}

// client holds the only keys the reader uses; every other key is ignored.
type client struct {
	Creator string `plist:"IOUserClientCreator"`
	Usage   []struct {
		GPUTime uint64 `plist:"accumulatedGPUTime"`
	} `plist:"AppUsage"`
}

// Parse decodes `ioreg -a` output for AGXDeviceUserClient and sums GPU time per pid. Empty
// output means no GPU clients. Clients with a malformed creator are skipped and counted; if
// clients exist but none parses, the format has changed and ErrNoMatch is returned.
func Parse(raw []byte) (Sample, error) {
	s := Sample{Busy: map[int32]uint64{}}
	if len(bytes.TrimSpace(raw)) == 0 {
		return s, nil
	}
	var clients []client
	if _, err := plist.Unmarshal(raw, &clients); err != nil {
		return Sample{}, fmt.Errorf("ioreg output is not a client list: %w", err)
	}
	if len(clients) > MaxClients {
		return Sample{}, ErrTooManyClients
	}
	for _, c := range clients {
		pid, ok := ParseCreator(c.Creator)
		if !ok {
			s.Skipped++
			continue
		}
		sum := s.Busy[pid]
		for _, u := range c.Usage {
			if u.GPUTime > math.MaxUint64-sum {
				return Sample{}, ErrOverflow
			}
			sum += u.GPUTime
		}
		s.Busy[pid] = sum
	}
	if len(clients) > 0 && len(s.Busy) == 0 {
		return Sample{}, ErrNoMatch
	}
	return s, nil
}

var creatorRE = regexp.MustCompile(`^pid (\d{1,6}), `)

// ParseCreator extracts the pid from an IOUserClientCreator value such as "pid 42, Finder".
// The name is not used: the process table keeps its own name for the pid.
func ParseCreator(s string) (int32, bool) {
	m := creatorRE.FindStringSubmatch(s)
	if m == nil {
		return 0, false
	}
	pid, err := strconv.Atoi(m[1])
	if err != nil || pid < 1 || pid > maxPID {
		return 0, false
	}
	return int32(pid), true
}
