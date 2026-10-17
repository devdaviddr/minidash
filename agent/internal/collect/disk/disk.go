// Package disk reports local volumes (internal and external) and per-disk I/O throughput.
// Network shares are excluded here; the shares collector owns them.
package disk

import (
	"context"
	"os/exec"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/disk"
	"howett.net/plist"
)

// Data is the disks collector payload (contracts/snapshot.schema.json#/$defs/disksData).
type Data struct {
	Volumes []Volume `json:"volumes"`
	Devices []Device `json:"devices"`
}

// Volume is a mounted local filesystem. Bytes.
type Volume struct {
	Name     string `json:"name"`
	Mount    string `json:"mount"`
	FSType   string `json:"fsType"`
	Total    uint64 `json:"total"`
	Used     uint64 `json:"used"`
	Free     uint64 `json:"free"`
	External bool   `json:"external"`
	Device   string `json:"device"` // physical disk the volume lives on, e.g. "disk0"
}

// Device is a physical disk with throughput in bytes per second since the previous tick.
type Device struct {
	Name     string  `json:"name"`
	ReadBps  float64 `json:"readBps"`
	WriteBps float64 `json:"writeBps"`
}

// Part describes one mounted partition as reported by the OS.
type Part struct{ Device, Mount, FSType string }

// Usage is capacity for a mount.
type Usage struct{ Total, Used, Free uint64 }

// Info is what `diskutil info` says about a partition.
type Info struct {
	Name     string
	Physical string // physical disk name, e.g. "disk0"
	Internal bool
}

// IOCount is cumulative bytes for a physical disk.
type IOCount struct{ Read, Write uint64 }

// OS abstracts the host so tests can supply fixed readings.
type OS interface {
	Partitions(ctx context.Context) ([]Part, error)
	Usage(ctx context.Context, mount string) (Usage, error)
	IO(ctx context.Context) (map[string]IOCount, error)
	Info(ctx context.Context, device string) (Info, error)
}

// Collector implements snapshot.Collector for disks.
type Collector struct {
	os    OS
	now   func() time.Time
	mu    sync.Mutex
	prev  map[string]IOCount
	prevT time.Time
	info  map[string]Info // diskutil results rarely change; cached per device node
}

// New returns a disks collector using the real OS.
func New() *Collector { return NewWith(realOS{}) }

// NewWith returns a collector using the given OS (tests).
func NewWith(o OS) *Collector {
	return &Collector{os: o, now: time.Now, info: map[string]Info{}}
}

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "disks" }

// localFS are the filesystem types shown as volumes.
var localFS = map[string]bool{"apfs": true, "hfs": true, "exfat": true, "msdos": true, "ntfs": true, "ufsd_NTFS": true}

// dataVolume is the user-visible internal volume on a modern macOS install.
const dataVolume = "/System/Volumes/Data"

// wanted reports whether a partition should be listed: the internal Data volume and
// anything mounted under /Volumes. System-internal volumes (VM, Preboot...) are noise.
func wanted(p Part) bool {
	return localFS[p.FSType] && (p.Mount == dataVolume || strings.HasPrefix(p.Mount, "/Volumes/"))
}

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	parts, err := c.os.Partitions(ctx)
	if err != nil {
		return nil, err
	}
	d := Data{Volumes: []Volume{}, Devices: []Device{}}
	for _, p := range parts {
		if !wanted(p) {
			continue
		}
		u, err := c.os.Usage(ctx, p.Mount)
		if err != nil {
			continue // a volume vanishing mid-tick is not an error
		}
		inf := c.lookup(ctx, p.Device)
		name := inf.Name
		if name == "" {
			name = lastPath(p.Mount)
		}
		d.Volumes = append(d.Volumes, Volume{
			Name: name, Mount: p.Mount, FSType: p.FSType, Total: u.Total, Used: u.Used, Free: u.Free,
			External: !inf.Internal, Device: inf.Physical,
		})
	}
	sort.Slice(d.Volumes, func(i, j int) bool { return d.Volumes[i].Mount < d.Volumes[j].Mount })
	d.Devices = c.throughput(ctx)
	return d, nil
}

func (c *Collector) lookup(ctx context.Context, device string) Info {
	c.mu.Lock()
	defer c.mu.Unlock()
	if i, ok := c.info[device]; ok {
		return i
	}
	i, err := c.os.Info(ctx, device)
	if err != nil {
		// Unknown: treat as external so an unrecognised drive is still shown, and retry next tick.
		return Info{Physical: wholeDisk(device)}
	}
	c.info[device] = i
	return i
}

func (c *Collector) throughput(ctx context.Context) []Device {
	cur, err := c.os.IO(ctx)
	now := c.now()
	out := []Device{}
	if err != nil {
		return out
	}
	c.mu.Lock()
	prev, prevT := c.prev, c.prevT
	c.prev, c.prevT = cur, now
	c.mu.Unlock()
	secs := now.Sub(prevT).Seconds()
	names := make([]string, 0, len(cur))
	for n := range cur {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		dev := Device{Name: n}
		if p, ok := prev[n]; ok && secs > 0 && cur[n].Read >= p.Read && cur[n].Write >= p.Write {
			dev.ReadBps = float64(cur[n].Read-p.Read) / secs
			dev.WriteBps = float64(cur[n].Write-p.Write) / secs
		}
		out = append(out, dev)
	}
	return out
}

var wholeRe = regexp.MustCompile(`disk\d+`)

// wholeDisk returns "disk4" for "/dev/disk4s1" (best effort when diskutil fails).
func wholeDisk(device string) string { return wholeRe.FindString(device) }

func lastPath(p string) string {
	if i := strings.LastIndex(p, "/"); i >= 0 {
		return p[i+1:]
	}
	return p
}

// ParseDiskutil extracts Info from `diskutil info -plist` output.
func ParseDiskutil(raw []byte) (Info, error) {
	var v struct {
		VolumeName      string `plist:"VolumeName"`
		ParentWholeDisk string `plist:"ParentWholeDisk"`
		Internal        bool   `plist:"Internal"`
		Stores          []struct {
			Store string `plist:"APFSPhysicalStore"`
		} `plist:"APFSPhysicalStores"`
	}
	if _, err := plist.Unmarshal(raw, &v); err != nil {
		return Info{}, err
	}
	phys := v.ParentWholeDisk
	if len(v.Stores) > 0 { // APFS volumes live in a synthesized container disk; I/O is on the store
		phys = wholeDisk(v.Stores[0].Store)
	}
	return Info{Name: v.VolumeName, Physical: phys, Internal: v.Internal}, nil
}

type realOS struct{}

func (realOS) Partitions(ctx context.Context) ([]Part, error) {
	ps, err := disk.PartitionsWithContext(ctx, true)
	if err != nil {
		return nil, err
	}
	out := make([]Part, 0, len(ps))
	for _, p := range ps {
		out = append(out, Part{Device: p.Device, Mount: p.Mountpoint, FSType: p.Fstype})
	}
	return out, nil
}

func (realOS) Usage(ctx context.Context, mount string) (Usage, error) {
	u, err := disk.UsageWithContext(ctx, mount)
	if err != nil {
		return Usage{}, err
	}
	return Usage{Total: u.Total, Used: u.Used, Free: u.Free}, nil
}

func (realOS) IO(ctx context.Context) (map[string]IOCount, error) {
	m, err := disk.IOCountersWithContext(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]IOCount, len(m))
	for n, s := range m {
		out[n] = IOCount{Read: s.ReadBytes, Write: s.WriteBytes}
	}
	return out, nil
}

func (realOS) Info(ctx context.Context, device string) (Info, error) {
	raw, err := exec.CommandContext(ctx, "diskutil", "info", "-plist", device).Output()
	if err != nil {
		return Info{}, err
	}
	return ParseDiskutil(raw)
}
