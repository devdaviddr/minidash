package shares

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/devdaviddr/minidash/agent/internal/testutil"
)

// All names below are invented.
const mountOut = `/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)
//alice@NAS%20One._smb._tcp.local/Media on /Volumes/Media (smbfs, nodev, nosuid, mounted by admin)
//com.apple.idms.appleid.prd.0000-1111-2222@Mini%E2%80%99s%20Mac._smb._tcp.local/Docs%20Share on /Volumes/Docs Share (smbfs, nodev, nosuid, mounted by admin)
//bob:hunter2@files.example.lan/Backups on /Volumes/Backups (smbfs, nodev, nosuid, mounted by bob)
nas.example.lan:/export/music on /Volumes/music (nfs, nodev, nosuid, mounted by admin)
map auto_home on /System/Volumes/Data/home (autofs, automounted, nobrowse)
`

const sharingOut = `
			List of Share Points
name:	Public Files
path:	/Users/x/Public
	smb:	{
    		name:	Public Files
    		shared:	1
    		guest access:	1
	}
name:	Old Stuff
path:	/Users/x/Old
	smb:	{
    		name:	Old Stuff
    		shared:	0
	}
	afp:	{
    		name:	Old Stuff
    		shared:	1
	}
`

const netstatOut = `Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)          rxbytes      txbytes  rhiwat  shiwat    process:pid   state    options
tcp4       0      0  192.0.2.5.445          192.0.2.77.51234       ESTABLISHED         9000         9000  131072  131072     smbd:4242 00102 00000008
tcp4       0      0  192.0.2.5.50622        23.192.239.222.443     ESTABLISHED         4424         2857  131072  131712 Google Chrome He:63176  00102 00000008
tcp4       0      0  192.0.2.5.445          192.0.2.78.40000       ESTABLISHED         1            1  131072  131072     smbd:4243 00102 00000008
tcp4       0      0  *.445                  *.*                    LISTEN              0            0  131072  131072     launchd:1 00100 00000000
`

func TestParseMounts(t *testing.T) {
	ms := ParseMounts([]byte(mountOut))
	if len(ms) != 4 {
		t.Fatalf("want 4 SMB/NFS mounts, got %d: %+v", len(ms), ms)
	}
	by := map[string]Mount{}
	for _, m := range ms {
		by[m.Mount] = m
	}
	media := by["/Volumes/Media"]
	if media.Protocol != "smb" || media.Server != "NAS One" || media.Share != "Media" || media.Account != "alice" || media.MountedBy != "admin" {
		t.Fatalf("media: %+v", media)
	}
	// AC-7: an SMB share is listed with its server and mount point.
	docs := by["/Volumes/Docs Share"]
	if docs.Server != "Mini’s Mac" || docs.Share != "Docs Share" {
		t.Fatalf("docs: %+v", docs)
	}
	if docs.Account != "Apple ID" {
		t.Fatalf("Apple ID identifiers must be redacted, got %q", docs.Account)
	}
	if nfs := by["/Volumes/music"]; nfs.Protocol != "nfs" || nfs.Server != "nas.example.lan" || nfs.Share != "/export/music" {
		t.Fatalf("nfs: %+v", nfs)
	}
}

func TestPasswordsNeverSurface(t *testing.T) {
	for _, m := range ParseMounts([]byte(mountOut)) {
		if strings.Contains(m.Account+m.Server+m.Share, "hunter2") {
			t.Fatalf("password leaked: %+v", m)
		}
	}
}

func TestParseSharingOnlySMBThatIsOn(t *testing.T) {
	got := ParseSharing([]byte(sharingOut))
	if len(got) != 1 || got[0].Name != "Public Files" || got[0].Protocols[0] != "smb" {
		t.Fatalf("got %+v", got)
	}
}

func TestParseSessions(t *testing.T) {
	ss := ParseSessions([]byte(netstatOut))
	if len(ss) != 2 || ss[0].Remote != "192.0.2.77" || ss[0].pid != 4242 || ss[0].Protocol != "smb" {
		t.Fatalf("got %+v", ss)
	}
}

type fakeOS struct{ unreachable map[string]bool }

func (fakeOS) Mount(context.Context) ([]byte, error)   { return []byte(mountOut), nil }
func (fakeOS) Sharing(context.Context) ([]byte, error) { return []byte(sharingOut), nil }
func (fakeOS) Netstat(context.Context) ([]byte, error) { return []byte(netstatOut), nil }
func (fakeOS) ProcessUser(_ context.Context, pid int) string {
	if pid == 4242 {
		return "carol"
	}
	return "root"
}
func (f fakeOS) Usage(_ context.Context, m string) (Usage, error) {
	if f.unreachable[m] {
		return Usage{}, errors.New("timeout")
	}
	return Usage{Total: 100, Used: 40, Free: 60}, nil
}

func TestCollect(t *testing.T) {
	v, err := NewWith(fakeOS{unreachable: map[string]bool{"/Volumes/Backups": true}}).Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	d := v.(Data)
	var backups, media Mount
	for _, m := range d.Mounts {
		switch m.Mount {
		case "/Volumes/Backups":
			backups = m
		case "/Volumes/Media":
			media = m
		}
	}
	if backups.Reachable || media.Total != 100 || !media.Reachable {
		t.Fatalf("reachability wrong: backups=%+v media=%+v", backups, media)
	}
	if len(d.Sessions) != 2 || d.Sessions[0].Account != "carol" || d.Sessions[1].Account != "" {
		t.Fatalf("sessions (root must be hidden): %+v", d.Sessions)
	}
}

func TestMatchesContract(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, NewWith(fakeOS{})); !r.OK {
		t.Fatal(r.Error)
	}
}

func TestRealHostSane(t *testing.T) {
	if r := testutil.AssertMatchesContract(t, New()); !r.OK {
		t.Fatal(r.Error)
	}
}
