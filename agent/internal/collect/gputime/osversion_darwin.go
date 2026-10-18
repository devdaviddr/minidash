package gputime

import "golang.org/x/sys/unix"

// osVersion names the macOS release, so a format change is reported against it.
func osVersion() string {
	v, err := unix.Sysctl("kern.osproductversion")
	if err != nil || v == "" {
		return "unknown"
	}
	return v
}
