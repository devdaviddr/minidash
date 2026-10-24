package hostinfo

import "golang.org/x/sys/unix"

// model is the chip and the Mac model identifier, for example "Apple M4 (Mac16,10)".
func model() string {
	chip, _ := unix.Sysctl("machdep.cpu.brand_string")
	hw, _ := unix.Sysctl("hw.model")
	switch {
	case chip != "" && hw != "":
		return chip + " (" + hw + ")"
	case chip != "":
		return chip
	}
	return hw
}
