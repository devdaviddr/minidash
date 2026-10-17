package disk

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

type fakeOS struct {
	parts []Part
	io    map[string]IOCount
	info  map[string]Info
}

func (f *fakeOS) Partitions(context.Context) ([]Part, error) { return f.parts, nil }
func (f *fakeOS) Usage(_ context.Context, m string) (Usage, error) {
	return Usage{Total: 1000, Used: 400, Free: 600}, nil
}
func (f *fakeOS) IO(context.Context) (map[string]IOCount, error) { return f.io, nil }
func (f *fakeOS) Info(_ context.Context, d string) (Info, error) {
	if i, ok := f.info[d]; ok {
		return i, nil
	}
	return Info{}, errors.New("no info")
}

func newFake() *fakeOS {
	return &fakeOS{
		parts: []Part{
			{"/dev/disk3s1s1", "/", "apfs"},
			{"/dev/disk3s6", "/System/Volumes/VM", "apfs"},
			{"/dev/disk3s5", "/System/Volumes/Data", "apfs"},
			{"/dev/disk5s1", "/Volumes/Backup", "exfat"},
			{"//user@server/share", "/Volumes/Share", "smbfs"},
		},
		io: map[string]IOCount{"disk0": {Read: 0, Write: 0}, "disk4": {Read: 0, Write: 0}},
		info: map[string]Info{
			"/dev/disk3s5": {Name: "Macintosh HD - Data", Physical: "disk0", Internal: true},
			"/dev/disk5s1": {Name: "Backup", Physical: "disk4", Internal: false},
		},
	}
}

func vols(t *testing.T, c *Collector) Data {
	t.Helper()
	v, err := c.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return v.(Data)
}

// AC-3: an external drive appears with capacity/usage; unmounting removes it.
func TestExternalDriveAppearsAndDisappears(t *testing.T) {
	f := newFake()
	c := NewWith(f)
	d := vols(t, c)
	if len(d.Volumes) != 2 {
		t.Fatalf("want Data + Backup only, got %+v", d.Volumes)
	}
	var ext Volume
	for _, v := range d.Volumes {
		if v.External {
			ext = v
		}
	}
	if ext.Name != "Backup" || ext.Total != 1000 || ext.Used != 400 || ext.Device != "disk4" {
		t.Fatalf("external volume wrong: %+v", ext)
	}
	f.parts = f.parts[:3] // unmount
	if d = vols(t, c); len(d.Volumes) != 1 {
		t.Fatalf("unmounted drive must disappear: %+v", d.Volumes)
	}
}

// AC-3: throughput is bytes/sec over the elapsed time; first tick and counter resets are 0.
func TestThroughput(t *testing.T) {
	f := newFake()
	c := NewWith(f)
	now := time.Unix(1000, 0)
	c.now = func() time.Time { return now }
	if d := vols(t, c); d.Devices[0].ReadBps != 0 {
		t.Fatalf("first tick must be 0: %+v", d.Devices)
	}
	now = now.Add(2 * time.Second)
	f.io = map[string]IOCount{"disk0": {}, "disk4": {Read: 2000, Write: 4000}}
	d := vols(t, c)
	var got Device
	for _, dev := range d.Devices {
		if dev.Name == "disk4" {
			got = dev
		}
	}
	if got.ReadBps != 1000 || got.WriteBps != 2000 {
		t.Fatalf("rates = %+v", got)
	}
	now = now.Add(time.Second)
	f.io = map[string]IOCount{"disk0": {}, "disk4": {Read: 10, Write: 10}} // counter went backwards (device re-attached)
	for _, dev := range vols(t, c).Devices {
		if dev.Name == "disk4" && (dev.ReadBps != 0 || dev.WriteBps != 0) {
			t.Fatalf("counter reset must read 0, got %+v", dev)
		}
	}
}

func TestUnknownDeviceTreatedAsExternal(t *testing.T) {
	f := newFake()
	f.parts = []Part{{"/dev/disk9s2", "/Volumes/Mystery", "apfs"}}
	d := vols(t, NewWith(f))
	if len(d.Volumes) != 1 || !d.Volumes[0].External || d.Volumes[0].Name != "Mystery" {
		t.Fatalf("got %+v", d.Volumes)
	}
}

func TestParseDiskutilFixture(t *testing.T) {
	raw, err := os.ReadFile("testdata/apfs-data.plist")
	if err != nil {
		t.Fatal(err)
	}
	i, err := ParseDiskutil(raw)
	if err != nil {
		t.Fatal(err)
	}
	// APFS volume: I/O lives on the physical store (disk0), not the synthesized container (disk3).
	if i.Physical != "disk0" || !i.Internal || i.Name == "" {
		t.Fatalf("got %+v", i)
	}
}

func TestMatchesContract(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, NewWith(newFake())); !r.OK {
		t.Fatal(r.Error)
	}
}

func TestRealHostSane(t *testing.T) {
	r := testutil.AssertMatchesContract(t, New())
	d := r.Data.(Data)
	if !r.OK || len(d.Volumes) == 0 {
		t.Fatalf("implausible: %+v", r)
	}
}
