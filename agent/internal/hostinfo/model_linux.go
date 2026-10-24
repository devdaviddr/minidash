package hostinfo

import (
	"io"
	"os"
)

// model is the CPU model from /proc/cpuinfo, else the DMI product name, else the device
// tree model (single-board computers whose cpuinfo names no model).
func model() string {
	if f, err := os.Open("/proc/cpuinfo"); err == nil {
		m := cpuModel(f)
		_ = f.Close()
		if m != "" {
			return m
		}
	}
	for _, p := range []string{"/sys/class/dmi/id/product_name", "/proc/device-tree/model"} {
		if m := cleanProduct(readSmall(p)); m != "" {
			return m
		}
	}
	return ""
}

func readSmall(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer func() { _ = f.Close() }()
	b, _ := io.ReadAll(io.LimitReader(f, 256))
	return string(b)
}
