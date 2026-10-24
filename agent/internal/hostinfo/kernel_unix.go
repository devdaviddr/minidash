//go:build darwin || linux

package hostinfo

import "golang.org/x/sys/unix"

// kernel is the kernel release, as uname -r prints it.
func kernel() string {
	var u unix.Utsname
	if unix.Uname(&u) != nil {
		return ""
	}
	return unix.ByteSliceToString(u.Release[:])
}
