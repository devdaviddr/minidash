// Package shares reports network shares this Mac has mounted (SMB, NFS), the shares it offers,
// and the clients currently connected to it. "Accounts" are the remote account used by each
// mount and the owner of each incoming session.
//
// Privacy: credentials are never read. Apple ID style SMB usernames are shown as "Apple ID".
package shares

import (
	"bufio"
	"bytes"
	"context"
	"net/url"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/disk"
)

// usageTimeout bounds statfs on a mount; a dead server can otherwise hang the call forever.
const usageTimeout = 2 * time.Second

// Data is the shares collector payload (contracts/snapshot.schema.json#/$defs/sharesData).
type Data struct {
	Mounts   []Mount   `json:"mounts"`
	Sharing  []Offered `json:"sharing"`
	Sessions []Session `json:"sessions"`
}

// Mount is a remote share mounted on this Mac.
type Mount struct {
	Protocol  string `json:"protocol"` // "smb" or "nfs"
	Server    string `json:"server"`
	Share     string `json:"share"`
	Mount     string `json:"mount"`
	Account   string `json:"account"`   // account used to authenticate to the server, if known
	MountedBy string `json:"mountedBy"` // local user who mounted it
	Reachable bool   `json:"reachable"`
	Total     uint64 `json:"total"`
	Used      uint64 `json:"used"`
	Free      uint64 `json:"free"`
}

// Offered is a folder this Mac shares over the network.
type Offered struct {
	Name      string   `json:"name"`
	Protocols []string `json:"protocols"`
}

// Session is a client connected to this Mac's file sharing.
type Session struct {
	Protocol string `json:"protocol"`
	Remote   string `json:"remote"`  // client IP
	Account  string `json:"account"` // owner of the serving process; empty when not visible
}

// Usage is capacity for a mount.
type Usage struct{ Total, Used, Free uint64 }

// OS abstracts the host so tests can supply recorded command output.
type OS interface {
	Mount(ctx context.Context) ([]byte, error)
	Usage(ctx context.Context, mount string) (Usage, error)
	Sharing(ctx context.Context) ([]byte, error)
	Netstat(ctx context.Context) ([]byte, error)
	ProcessUser(ctx context.Context, pid int) string
}

// Collector implements snapshot.Collector for shares.
type Collector struct{ os OS }

// New returns a shares collector using the real OS.
func New() *Collector { return NewWith(&realOS{inflight: map[string]bool{}}) }

// NewWith returns a collector using the given OS (tests).
func NewWith(o OS) *Collector { return &Collector{os: o} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "shares" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(ctx context.Context) (any, error) {
	d := Data{Mounts: []Mount{}, Sharing: []Offered{}, Sessions: []Session{}}
	out, err := c.os.Mount(ctx)
	if err != nil {
		return nil, err
	}
	for _, m := range ParseMounts(out) {
		if u, err := c.os.Usage(ctx, m.Mount); err == nil {
			m.Reachable, m.Total, m.Used, m.Free = true, u.Total, u.Used, u.Free
		}
		d.Mounts = append(d.Mounts, m)
	}
	// The sharing config and session list are best-effort: absence just means "none".
	if raw, err := c.os.Sharing(ctx); err == nil {
		d.Sharing = ParseSharing(raw)
	}
	if raw, err := c.os.Netstat(ctx); err == nil {
		for _, s := range ParseSessions(raw) {
			if s.pid > 0 {
				s.Account = c.os.ProcessUser(ctx, s.pid)
				if s.Account == "root" { // root means the real user is not visible without privileges
					s.Account = ""
				}
			}
			d.Sessions = append(d.Sessions, s.Session)
		}
	}
	return d, nil
}

// ParseMounts extracts SMB and NFS mounts from `mount` output.
func ParseMounts(out []byte) []Mount {
	var res []Mount
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		line := sc.Text()
		i := strings.Index(line, " on ")
		j := strings.LastIndex(line, " (")
		if i < 0 || j < i || !strings.HasSuffix(line, ")") {
			continue
		}
		device, mount, opts := line[:i], line[i+4:j], line[j+2:len(line)-1]
		fields := strings.Split(opts, ", ")
		if len(fields) == 0 {
			continue
		}
		m := Mount{Mount: mount, MountedBy: mountedBy(fields)}
		switch fields[0] {
		case "smbfs":
			m.Protocol = "smb"
			m.Server, m.Share, m.Account = parseSMB(device)
		case "nfs":
			m.Protocol = "nfs"
			m.Server, m.Share = parseNFS(device)
		default:
			continue
		}
		res = append(res, m)
	}
	sort.Slice(res, func(a, b int) bool { return res[a].Mount < res[b].Mount })
	return res
}

func mountedBy(opts []string) string {
	for _, o := range opts {
		if u, ok := strings.CutPrefix(o, "mounted by "); ok {
			return u
		}
	}
	return ""
}

// parseSMB splits //[user[:password]@]server/share. The password, if any, is dropped.
func parseSMB(dev string) (server, share, account string) {
	rest := strings.TrimPrefix(dev, "//")
	auth, path, _ := strings.Cut(rest, "/")
	if at := strings.LastIndex(auth, "@"); at >= 0 {
		account = auth[:at]
		auth = auth[at+1:]
		account, _, _ = strings.Cut(account, ":") // never keep a password
	}
	server = cleanHost(unescape(auth))
	return server, unescape(path), redactAccount(unescape(account))
}

func parseNFS(dev string) (server, share string) {
	h, p, _ := strings.Cut(dev, ":")
	return h, p
}

func unescape(s string) string {
	if u, err := url.PathUnescape(s); err == nil {
		return u
	}
	return s
}

// cleanHost turns a Bonjour name like "My Mac._smb._tcp.local" into "My Mac".
func cleanHost(h string) string {
	for _, suf := range []string{"._smb._tcp.local", "._afpovertcp._tcp.local"} {
		h = strings.TrimSuffix(h, suf)
	}
	return h
}

// redactAccount hides opaque Apple ID service identifiers that carry account UUIDs.
func redactAccount(a string) string {
	if strings.HasPrefix(a, "com.apple.idms.") {
		return "Apple ID"
	}
	return a
}

var (
	protoOpenRe = regexp.MustCompile(`^(smb|afp|ftp):\s*\{$`)
	sharedOnRe  = regexp.MustCompile(`^shared:\s+1$`)
)

// ParseSharing extracts shares offered over SMB from `sharing -l` output. Shares start at a
// column-0 "name:" line; each protocol is a "smb: {" ... "}" block holding "shared: 1" when on.
func ParseSharing(out []byte) []Offered {
	res := []Offered{}
	proto, idx := "", -1
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		raw := sc.Text()
		t := strings.TrimSpace(raw)
		switch {
		case strings.HasPrefix(raw, "name:"):
			res = append(res, Offered{Name: strings.TrimSpace(strings.TrimPrefix(raw, "name:")), Protocols: []string{}})
			idx, proto = len(res)-1, ""
		case protoOpenRe.MatchString(t):
			proto = protoOpenRe.FindStringSubmatch(t)[1]
		case t == "}":
			proto = ""
		case idx >= 0 && proto == "smb" && sharedOnRe.MatchString(t): // spec scope: SMB and NFS only
			res[idx].Protocols = append(res[idx].Protocols, "smb")
		}
	}
	kept := res[:0]
	for _, o := range res {
		if len(o.Protocols) > 0 {
			kept = append(kept, o)
		}
	}
	return kept
}

type session struct {
	Session
	pid int
}

var portProto = map[string]string{"445": "smb", "2049": "nfs"}

// ParseSessions extracts established inbound SMB/NFS connections from `netstat -anv -p tcp`.
func ParseSessions(out []byte) []session {
	var res []session
	sc := bufio.NewScanner(bytes.NewReader(out))
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		f := strings.Fields(sc.Text())
		if len(f) < 12 || !strings.HasPrefix(f[0], "tcp") || f[5] != "ESTABLISHED" {
			continue
		}
		lp := f[3][strings.LastIndex(f[3], ".")+1:]
		proto, ok := portProto[lp]
		if !ok {
			continue
		}
		fi := strings.LastIndex(f[4], ".")
		if fi < 0 {
			continue
		}
		s := session{Session: Session{Protocol: proto, Remote: f[4][:fi]}}
		// Process token is "name:pid" (name may hold spaces) followed by two flag columns.
		tok := strings.Join(f[10:len(f)-2], " ")
		if c := strings.LastIndex(tok, ":"); c >= 0 {
			s.pid, _ = strconv.Atoi(tok[c+1:])
		}
		res = append(res, s)
	}
	return res
}

type realOS struct {
	mu       sync.Mutex
	inflight map[string]bool
}

func (*realOS) Mount(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "mount").Output()
}

func (*realOS) Sharing(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "sharing", "-l").Output()
}

func (*realOS) Netstat(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, "netstat", "-anv", "-p", "tcp").Output()
}

func (*realOS) ProcessUser(ctx context.Context, pid int) string {
	out, err := exec.CommandContext(ctx, "ps", "-o", "user=", "-p", strconv.Itoa(pid)).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// Usage runs statfs with a timeout and never lets more than one call per mount hang around.
func (r *realOS) Usage(ctx context.Context, mount string) (Usage, error) {
	r.mu.Lock()
	if r.inflight[mount] {
		r.mu.Unlock()
		return Usage{}, context.DeadlineExceeded
	}
	r.inflight[mount] = true
	r.mu.Unlock()

	type res struct {
		u   Usage
		err error
	}
	ch := make(chan res, 1)
	go func() {
		u, err := disk.Usage(mount)
		r.mu.Lock()
		delete(r.inflight, mount)
		r.mu.Unlock()
		if err != nil {
			ch <- res{err: err}
			return
		}
		ch <- res{u: Usage{Total: u.Total, Used: u.Used, Free: u.Free}}
	}()
	select {
	case v := <-ch:
		return v.u, v.err
	case <-time.After(usageTimeout):
		return Usage{}, context.DeadlineExceeded
	case <-ctx.Done():
		return Usage{}, ctx.Err()
	}
}
