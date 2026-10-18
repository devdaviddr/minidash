//go:build !darwin

package gputime

// osVersion is only meaningful on macOS; other platforms build for tests.
func osVersion() string { return "unknown" }
