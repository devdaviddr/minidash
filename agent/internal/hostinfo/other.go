//go:build !darwin && !linux

package hostinfo

// The agent supports macOS and Linux; elsewhere the model and kernel are unknown.
func model() string  { return "" }
func kernel() string { return "" }
